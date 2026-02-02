import { Router } from 'express';
import { getTickets, getTicket, deleteTicket, updateTicket } from '../db/tickets';
import type { TicketStatus, TicketWithMessages, Message } from '@nixo-slackbot/shared';
import { emitTicketUpdated } from '../socket/events';
import { boltApp } from '../slack/bolt';

const router = Router();

/** Resolve channel and workspace names from Slack and attach to messages */
async function enrichMessagesWithSlackNames(
  messages: Message[]
): Promise<Message[]> {
  if (messages.length === 0) return messages;

  const channelIds = [...new Set(messages.map((m) => m.slack_channel_id))];
  const channelNames = new Map<string, string>();
  let workspaceName: string | null = null;

  try {
    const [authResult, ...channelResults] = await Promise.all([
      boltApp.client.auth.test(),
      ...channelIds.map((channelId) =>
        boltApp.client.conversations.info({ channel: channelId }).catch(() => ({ ok: false }))
      ),
    ]);
    if (authResult?.team) workspaceName = authResult.team;
    channelResults.forEach((res: { ok?: boolean; channel?: { name?: string } }, i) => {
      const id = channelIds[i];
      if (res?.ok && res.channel?.name) {
        const name = res.channel.name.startsWith('#') ? res.channel.name : `#${res.channel.name}`;
        channelNames.set(id, name);
      }
    });
  } catch (err) {
    console.warn('[Tickets] Could not resolve Slack channel/workspace names:', err);
  }

  return messages.map((m) => ({
    ...m,
    slack_channel_name: channelNames.get(m.slack_channel_id) ?? null,
    slack_workspace_name: workspaceName ?? null,
  }));
}

router.get('/', async (req, res) => {
  try {
    const status = req.query.status as TicketStatus | undefined;
    const tickets = await getTickets(status);
    res.json(tickets);
  } catch (error: any) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch tickets' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const ticket = await getTicket(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    const enrichedMessages = await enrichMessagesWithSlackNames(ticket.messages);
    const enrichedTicket: TicketWithMessages = {
      ...ticket,
      messages: enrichedMessages,
    };
    res.json(enrichedTicket);
  } catch (error: any) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch ticket' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { status } = req.body;
    
    // Validate status if provided
    if (status && !['open', 'closed', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be open, closed, or resolved.' });
    }
    
    const ticket = await updateTicket(req.params.id, { status });
    
    // Emit socket event for real-time updates
    emitTicketUpdated(ticket.id);
    
    res.json(ticket);
  } catch (error: any) {
    console.error('Error updating ticket:', error);
    res.status(500).json({ error: error.message || 'Failed to update ticket' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await deleteTicket(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting ticket:', error);
    res.status(500).json({ error: error.message || 'Failed to delete ticket' });
  }
});

export default router;
