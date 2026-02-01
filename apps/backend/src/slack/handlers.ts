import type { GenericMessageEvent } from '@slack/bolt';
import { boltApp } from './bolt';
import { shouldProcessMessage } from '../pipeline/filter';
import { classifyMessage } from '../pipeline/classify';
import { normalizeMessage } from '../pipeline/normalize';
import { groupMessage } from '../pipeline/group';
import { emitTicketUpdated } from '../socket/events';

const FDE_USER_ID = process.env.FDE_USER_ID;

export function setupSlackHandlers() {
  // Handle normal message events
  boltApp.message(async ({ message, event, say, ack }) => {
    // Message events don't always provide ack in Bolt v3 - only call if available
    if (typeof ack === 'function') {
      await ack();
    }

    const msg = message as GenericMessageEvent;

    // Skip bot messages
    if (msg.subtype === 'bot_message' || msg.bot_id) {
      return;
    }

    // Skip FDE user messages
    if (FDE_USER_ID && msg.user === FDE_USER_ID) {
      return;
    }

    // Skip events with subtype (only process normal new messages)
    if (msg.subtype && msg.subtype !== 'message_changed') {
      return;
    }

    // Compute root_thread_ts
    const rootThreadTs = (msg as any).thread_ts || msg.ts;

    // Normalize and filter
    const normalized = normalizeMessage(msg.text || '');
    if (!shouldProcessMessage(normalized.normalizedText)) {
      return;
    }

    // Process asynchronously
    processMessageAsync({
      slack_channel_id: msg.channel,
      slack_ts: msg.ts,
      root_thread_ts: rootThreadTs,
      slack_user_id: msg.user || '',
      slack_team_id: (event as any).team,
      slack_event_id: (event as any).event_id,
      text: msg.text || '',
      permalink: null, // Could fetch using chat.getPermalink if needed
    }).catch((error) => {
      console.error('Error processing message:', error);
    });
  });

  // Optional: Handle message edits
  boltApp.event('message', async ({ event, ack }) => {
    const msg = event as any;
    if (msg.subtype !== 'message_changed') {
      return;
    }

    // Message events don't always provide ack in Bolt v3 - only call if available
    if (typeof ack === 'function') {
      await ack();
    }

    // Update existing message if text changed
    // This is optional - implement if needed
    console.log('Message edited:', msg.channel, msg.ts);
  });
}

async function processMessageAsync(messageData: {
  slack_channel_id: string;
  slack_ts: string;
  root_thread_ts: string;
  slack_user_id: string;
  slack_team_id?: string | null;
  slack_event_id?: string | null;
  text: string;
  permalink?: string | null;
}) {
  try {
    console.log('[Pipeline] Processing message:', {
      text: messageData.text.substring(0, 100),
      channel: messageData.slack_channel_id,
      ts: messageData.slack_ts,
    });

    // Normalize
    const normalized = normalizeMessage(messageData.text);
    console.log('[Pipeline] Normalized:', normalized.normalizedText.substring(0, 100));

    // Classify
    const classification = await classifyMessage(messageData.text, normalized.normalizedText);
    console.log('[Pipeline] Classification:', {
      is_relevant: classification.is_relevant,
      category: classification.category,
      confidence: classification.confidence,
      short_title: classification.short_title,
    });

    // Only process relevant messages
    if (!classification.is_relevant) {
      console.log('[Pipeline] Message classified as irrelevant, skipping ticket creation');
      return;
    }

    // Group and create/attach to ticket
    console.log('[Pipeline] Grouping message and creating/attaching to ticket...');
    const ticketId = await groupMessage(messageData, classification);
    console.log('[Pipeline] Success! Ticket ID:', ticketId);

    // Emit socket event
    emitTicketUpdated(ticketId);
  } catch (error) {
    console.error('[Pipeline] Error processing message:', error);
    throw error;
  }
}
