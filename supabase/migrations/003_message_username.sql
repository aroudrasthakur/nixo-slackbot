-- Add username column to store display name from Slack
ALTER TABLE messages ADD COLUMN IF NOT EXISTS slack_username TEXT;

-- Index for faster lookups when displaying messages
CREATE INDEX IF NOT EXISTS idx_messages_slack_user_id ON messages(slack_user_id);
