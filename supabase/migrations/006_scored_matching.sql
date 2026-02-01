-- RPC function for vector similarity search returning multiple candidates with metadata
-- Returns top N candidates (default 5) for scoring-based matching
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
    (t.embedding <=> query_embedding)::float as distance,
    t.category,
    t.updated_at,
    t.canonical_key
  FROM tickets t
  WHERE 
    t.status::text = ticket_status
    AND t.created_at > NOW() - (days_back || ' days')::interval
    AND t.embedding IS NOT NULL
  ORDER BY t.embedding <=> query_embedding
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- RPC function for finding tickets via message similarity, returning multiple candidates
CREATE OR REPLACE FUNCTION find_similar_messages_candidates(
  query_embedding vector(1536),
  days_back int DEFAULT 14,
  ticket_status_filter text DEFAULT 'open',
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
  SELECT DISTINCT ON (m.ticket_id)
    m.ticket_id,
    (m.embedding <=> query_embedding)::float AS distance,
    t.category,
    t.updated_at,
    t.canonical_key
  FROM messages m
  JOIN tickets t ON t.id = m.ticket_id
  WHERE
    m.embedding IS NOT NULL
    AND t.status::text = ticket_status_filter
    AND m.created_at > NOW() - (days_back || ' days')::interval
  ORDER BY m.ticket_id, (m.embedding <=> query_embedding)
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;
