-- When a message's ticket_id is updated (e.g. via upsert attaching to a ticket),
-- update the target ticket's updated_at so the ticket shows as recently updated.
CREATE TRIGGER trigger_update_ticket_updated_at_on_message_update
  AFTER UPDATE OF ticket_id ON messages
  FOR EACH ROW
  WHEN (OLD.ticket_id IS DISTINCT FROM NEW.ticket_id)
  EXECUTE FUNCTION update_ticket_updated_at();
