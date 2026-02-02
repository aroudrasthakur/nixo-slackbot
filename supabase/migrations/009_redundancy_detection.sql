-- Migration: Add redundancy detection fields to messages table
-- This enables collapsing same-meaning messages within tickets while preserving feature specificity

-- Add redundancy metadata columns
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS is_redundant BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS redundant_of_message_id UUID NULL REFERENCES messages(id),
  ADD COLUMN IF NOT EXISTS intent_key TEXT NULL,
  ADD COLUMN IF NOT EXISTS intent_object TEXT NULL,
  ADD COLUMN IF NOT EXISTS intent_action TEXT NULL,
  ADD COLUMN IF NOT EXISTS intent_value TEXT NULL;

-- Index for efficient querying of visible messages by ticket (excludes redundant)
CREATE INDEX IF NOT EXISTS idx_messages_ticket_redundant 
  ON messages(ticket_id, is_redundant, created_at);

-- Index for intent_key lookups within tickets
CREATE INDEX IF NOT EXISTS idx_messages_ticket_intent 
  ON messages(ticket_id, intent_key) 
  WHERE intent_key IS NOT NULL;

-- Comment on columns for documentation
COMMENT ON COLUMN messages.is_redundant IS 'True if this message repeats the same intent as a prior message in the ticket';
COMMENT ON COLUMN messages.redundant_of_message_id IS 'Reference to the first message that established this intent_key';
COMMENT ON COLUMN messages.intent_key IS 'Composite key: intent_action|intent_object|intent_value. Null if intent_object missing.';
COMMENT ON COLUMN messages.intent_object IS 'Primary object/component (button, dashboard, etc.). Required for intent_key.';
COMMENT ON COLUMN messages.intent_action IS 'Action type: style_change, access_control, add_feature, bug, etc.';
COMMENT ON COLUMN messages.intent_value IS 'Value: color (for style_change), role (for access_control), etc.';
