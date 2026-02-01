-- Add embedding column to messages for semantic matching by message content
ALTER TABLE messages ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Index for vector similarity search on messages (cosine distance)
CREATE INDEX IF NOT EXISTS idx_messages_embedding ON messages
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
  WHERE embedding IS NOT NULL;

-- RPC: find ticket that has a message most similar to the query embedding
-- Returns the ticket_id of the ticket containing the most similar message
CREATE OR REPLACE FUNCTION find_similar_message(
  query_embedding vector(1536),
  days_back int DEFAULT 14,
  ticket_status_filter text DEFAULT 'open',
  result_limit int DEFAULT 1
)
RETURNS TABLE (
  ticket_id uuid,
  distance float
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.ticket_id,
    (m.embedding <=> query_embedding)::float AS distance
  FROM messages m
  JOIN tickets t ON t.id = m.ticket_id
  WHERE
    m.embedding IS NOT NULL
    AND t.status::text = ticket_status_filter
    AND m.created_at > NOW() - (days_back || ' days')::interval
  ORDER BY m.embedding <=> query_embedding
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;
