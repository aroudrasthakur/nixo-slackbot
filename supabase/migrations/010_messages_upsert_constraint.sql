-- Migration: Ensure unique constraint on (slack_channel_id, slack_ts) for upsert
-- Required for ON CONFLICT in upsertMessage - fixes "no unique or exclusion constraint" error
-- Uses unique index (PostgreSQL treats it as conflict target) with IF NOT EXISTS for idempotency

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_slack_channel_ts 
  ON messages(slack_channel_id, slack_ts);
