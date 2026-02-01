-- Add assignees and summary columns to tickets table

-- Assignees: array of user identifiers (Slack user IDs or usernames)
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS assignees TEXT[] DEFAULT '{}';

-- Reporter: who reported the ticket (Slack user ID)
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS reporter_user_id TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS reporter_username TEXT;

-- Summary: AI-generated summary of the ticket
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS summary JSONB;
-- Summary structure:
-- {
--   "description": "Brief summary of the issue/request",
--   "action_items": ["List of required fixes, features, or actions"],
--   "technical_details": "Any relevant code, error messages, or technical context",
--   "priority_hint": "low | medium | high | critical"
-- }

-- Index for faster lookups by reporter
CREATE INDEX IF NOT EXISTS idx_tickets_reporter_user_id ON tickets(reporter_user_id) WHERE reporter_user_id IS NOT NULL;
