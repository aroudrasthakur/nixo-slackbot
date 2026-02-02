-- Add summary_embedding column to tickets table
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS summary_embedding vector(1536);

-- Create ivfflat cosine index for summary_embedding
CREATE INDEX IF NOT EXISTS tickets_summary_embedding_ivfflat
  ON tickets USING ivfflat (summary_embedding vector_cosine_ops)
  WITH (lists = 100)
  WHERE summary_embedding IS NOT NULL;

-- Update find_similar_ticket to prefer summary_embedding over embedding
CREATE OR REPLACE FUNCTION find_similar_ticket(
  query_embedding vector(1536),
  days_back int DEFAULT 14,
  ticket_status text DEFAULT 'open',
  result_limit int DEFAULT 1
)
RETURNS TABLE (
  ticket_id uuid,
  distance float
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id as ticket_id,
    (COALESCE(t.summary_embedding, t.embedding) <=> query_embedding)::float as distance
  FROM tickets t
  WHERE 
    t.status::text = ticket_status
    AND t.created_at > NOW() - (days_back || ' days')::interval
    AND COALESCE(t.summary_embedding, t.embedding) IS NOT NULL
  ORDER BY COALESCE(t.summary_embedding, t.embedding) <=> query_embedding
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Update find_similar_tickets_candidates to prefer summary_embedding
CREATE OR REPLACE FUNCTION find_similar_tickets_candidates(
  query_embedding vector(1536),
  days_back int DEFAULT 14,
  ticket_status text DEFAULT 'open',
  result_limit int DEFAULT 5
)
RETURNS TABLE (
  ticket_id uuid,
  distance float,
  category ticket_category,
  updated_at timestamptz,
  canonical_key text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id as ticket_id,
    (COALESCE(t.summary_embedding, t.embedding) <=> query_embedding)::float as distance,
    t.category,
    t.updated_at,
    t.canonical_key
  FROM tickets t
  WHERE 
    t.status::text = ticket_status
    AND t.created_at > NOW() - (days_back || ' days')::interval
    AND COALESCE(t.summary_embedding, t.embedding) IS NOT NULL
  ORDER BY COALESCE(t.summary_embedding, t.embedding) <=> query_embedding
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Update find_cross_channel_ticket_candidates to prefer summary_embedding
CREATE OR REPLACE FUNCTION find_cross_channel_ticket_candidates(
  query_embedding vector(1536),
  days_back int DEFAULT 14,
  ticket_status text DEFAULT 'open',
  result_limit int DEFAULT 15
)
RETURNS TABLE (
  ticket_id uuid,
  distance float,
  category ticket_category,
  updated_at timestamptz,
  canonical_key text,
  slack_channel_id text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id as ticket_id,
    (COALESCE(t.summary_embedding, t.embedding) <=> query_embedding)::float as distance,
    t.category,
    t.updated_at,
    t.canonical_key,
    COALESCE(
      (SELECT m.slack_channel_id FROM messages m WHERE m.ticket_id = t.id ORDER BY m.created_at DESC LIMIT 1),
      ''
    ) as slack_channel_id
  FROM tickets t
  WHERE 
    t.status::text = ticket_status
    AND (t.created_at > NOW() - (days_back || ' days')::interval OR t.updated_at > NOW() - (days_back || ' days')::interval)
    AND COALESCE(t.summary_embedding, t.embedding) IS NOT NULL
  ORDER BY COALESCE(t.summary_embedding, t.embedding) <=> query_embedding
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Update get_ticket_context_for_classification to prefer summary_embedding
CREATE OR REPLACE FUNCTION get_ticket_context_for_classification(
  query_embedding vector(1536),
  days_back int DEFAULT 14,
  ticket_limit int DEFAULT 3,
  message_limit int DEFAULT 5
)
RETURNS JSON AS $$
DECLARE
  ticket_results JSON;
  message_results JSON;
BEGIN
  -- Get top similar tickets with title, summary, last 2 messages (subquery avoids GROUP BY / embedding in aggregate)
  SELECT json_agg(
    json_build_object(
      'ticket_id', sub.id,
      'title', sub.title,
      'category', sub.category,
      'summary', sub.summary,
      'distance', sub.distance,
      'messages', (
        SELECT json_agg(json_build_object('text', m2.text, 'username', m2.slack_username))
        FROM (
          SELECT m2.text, m2.slack_username
          FROM messages m2
          WHERE m2.ticket_id = sub.id
          ORDER BY m2.created_at DESC
          LIMIT 2
        ) m2
      )
    )
  ) INTO ticket_results
  FROM (
    SELECT t.id, t.title, t.category, t.summary,
      (COALESCE(t.summary_embedding, t.embedding) <=> query_embedding)::float AS distance
    FROM tickets t
    WHERE
      t.status = 'open'
      AND (t.created_at > NOW() - (days_back || ' days')::interval OR t.updated_at > NOW() - (days_back || ' days')::interval)
      AND COALESCE(t.summary_embedding, t.embedding) IS NOT NULL
    ORDER BY COALESCE(t.summary_embedding, t.embedding) <=> query_embedding
    LIMIT ticket_limit
  ) sub;

  -- Get top similar messages (subquery avoids GROUP BY / embedding in aggregate)
  SELECT json_agg(
    json_build_object(
      'ticket_id', sub.ticket_id,
      'text', sub.text,
      'username', sub.slack_username,
      'distance', sub.distance,
      'ticket_title', sub.ticket_title
    )
  ) INTO message_results
  FROM (
    SELECT m.ticket_id, m.text, m.slack_username,
      (m.embedding <=> query_embedding)::float AS distance,
      t.title AS ticket_title
    FROM messages m
    JOIN tickets t ON t.id = m.ticket_id
    WHERE
      m.embedding IS NOT NULL
      AND t.status = 'open'
      AND m.created_at > NOW() - (days_back || ' days')::interval
    ORDER BY m.embedding <=> query_embedding
    LIMIT message_limit
  ) sub;

  RETURN json_build_object(
    'tickets', COALESCE(ticket_results, '[]'::json),
    'messages', COALESCE(message_results, '[]'::json)
  );
END;
$$ LANGUAGE plpgsql;
