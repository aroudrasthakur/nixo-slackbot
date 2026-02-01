import { Router } from 'express';
import { normalizeMessage } from '../pipeline/normalize';
import { shouldProcessMessage } from '../pipeline/filter';
import { classifyMessage } from '../pipeline/classify';
import { groupMessage } from '../pipeline/group';
import { emitTicketUpdated } from '../socket/events';

const router = Router();

router.post('/ingest', async (req, res) => {
  try {
    const { channel, ts, user, text, thread_ts, team, event_id } = req.body;

    if (!channel || !ts || !user || !text) {
      return res.status(400).json({ error: 'Missing required fields: channel, ts, user, text' });
    }

    const rootThreadTs = thread_ts || ts;

    // Normalize and filter
    const normalized = normalizeMessage(text);
    if (!shouldProcessMessage(normalized.normalizedText)) {
      return res.json({ message: 'Message filtered out by heuristics' });
    }

    // Classify
    const classification = await classifyMessage(text, normalized.normalizedText);
    if (!classification.is_relevant) {
      return res.json({ message: 'Message classified as irrelevant', classification });
    }

    // Group and create ticket
    const ticketId = await groupMessage(
      {
        slack_channel_id: channel,
        slack_ts: ts,
        root_thread_ts: rootThreadTs,
        slack_user_id: user,
        slack_team_id: team || null,
        slack_event_id: event_id || null,
        text,
        permalink: null,
      },
      classification
    );

    // Emit socket event
    emitTicketUpdated(ticketId);

    res.json({ ticketId, classification });
  } catch (error: any) {
    console.error('Error in dev ingest:', error);
    res.status(500).json({ error: error.message || 'Failed to process message' });
  }
});

export default router;
