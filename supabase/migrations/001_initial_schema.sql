-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create enums
CREATE TYPE ticket_status AS ENUM ('open', 'closed', 'resolved');
CREATE TYPE ticket_category AS ENUM ('bug_report', 'support_question', 'feature_request', 'product_question');

-- Create tickets table
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category ticket_category NOT NULL,
  status ticket_status NOT NULL DEFAULT 'open',
  canonical_key TEXT,
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  slack_channel_id TEXT NOT NULL,
  slack_ts TEXT NOT NULL,
  root_thread_ts TEXT NOT NULL, -- Always present: event.thread_ts ?? event.ts
  slack_user_id TEXT NOT NULL,
  slack_team_id TEXT,
  slack_event_id TEXT,
  text TEXT NOT NULL,
  permalink TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (slack_channel_id, slack_ts)
);

-- Indexes for tickets
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_canonical_key ON tickets(canonical_key) WHERE canonical_key IS NOT NULL;
CREATE INDEX idx_tickets_status_updated_at ON tickets(status, updated_at DESC);
-- Partial unique index to prevent duplicate open tickets
CREATE UNIQUE INDEX idx_tickets_canonical_key_open ON tickets(canonical_key) 
  WHERE status = 'open' AND canonical_key IS NOT NULL;
-- Vector similarity index using cosine distance
CREATE INDEX idx_tickets_embedding ON tickets USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100) WHERE embedding IS NOT NULL;

-- Indexes for messages
CREATE INDEX idx_messages_ticket_id ON messages(ticket_id);
CREATE INDEX idx_messages_root_thread_ts ON messages(root_thread_ts);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ticket_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE tickets SET updated_at = NOW() WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update ticket.updated_at when messages are inserted
CREATE TRIGGER trigger_update_ticket_updated_at
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_updated_at();

-- RPC function for vector similarity search using cosine distance
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
    (t.embedding <=> query_embedding)::float as distance
  FROM tickets t
  WHERE 
    t.status::text = ticket_status
    AND t.created_at > NOW() - (days_back || ' days')::interval
    AND t.embedding IS NOT NULL
  ORDER BY t.embedding <=> query_embedding
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;
