import type { GenericMessageEvent } from '@slack/bolt';
import { boltApp } from './bolt';
import { shouldProcessMessage } from '../pipeline/filter';
import { classifyMessage } from '../pipeline/classify';
import { normalizeMessage } from '../pipeline/normalize';
import { groupMessage } from '../pipeline/group';
import { emitTicketUpdated } from '../socket/events';
import { getSlackUsername } from './users.js';
import { getThreadContext, getChannelHistory } from './threads.js';

const FDE_USER_ID = process.env.FDE_USER_ID;

/**
 * Per-channel message queue to serialize processing.
 * This prevents race conditions where concurrent messages in the same channel
 * don't find each other's tickets because they're being processed simultaneously.
 */
const channelQueues = new Map<string, Promise<void>>();

/**
 * Queue a message for processing, ensuring messages in the same channel
 * are processed sequentially while different channels can process in parallel.
 */
function queueMessageProcessing(
  channelId: string,
  processFn: () => Promise<void>
): void {
  const currentQueue = channelQueues.get(channelId) || Promise.resolve();
  
  const newQueue = currentQueue
    .then(processFn)
    .catch((error) => {
      console.error('[Pipeline] Error processing queued message:', error);
    });
  
  channelQueues.set(channelId, newQueue);
  
  // Clean up completed queues to prevent memory leaks
  newQueue.finally(() => {
    // Only delete if this is still the current queue (no new messages queued)
    if (channelQueues.get(channelId) === newQueue) {
      channelQueues.delete(channelId);
    }
  });
}

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
      console.log('[Pipeline] Skipping bot message:', msg.ts);
      return;
    }

    // Check if this is an FDE user message (allowed for context, but not ticket creation)
    const isFdeMessage = !!(FDE_USER_ID && msg.user === FDE_USER_ID);

    // Skip events with subtype (only process normal new messages)
    if (msg.subtype && msg.subtype !== 'message_changed') {
      console.log('[Pipeline] Skipping message with subtype:', msg.subtype, msg.ts);
      return;
    }

    // Compute root_thread_ts
    const rootThreadTs = (msg as any).thread_ts || msg.ts;

    // Normalize and filter
    const normalized = normalizeMessage(msg.text || '');
    if (!shouldProcessMessage(normalized.normalizedText)) {
      console.log('[Pipeline] Message filtered out by heuristics:', {
        text: msg.text?.substring(0, 100),
        normalized: normalized.normalizedText.substring(0, 100),
        ts: msg.ts,
      });
      return;
    }

    // Queue message for sequential processing per channel
    // This prevents race conditions where concurrent messages don't find each other's tickets
    const messagePayload = {
      slack_channel_id: msg.channel,
      slack_ts: msg.ts,
      root_thread_ts: rootThreadTs,
      slack_user_id: msg.user || '',
      slack_team_id: (event as any).team,
      slack_event_id: (event as any).event_id,
      text: msg.text || '',
      permalink: null, // Could fetch using chat.getPermalink if needed
      is_fde: isFdeMessage,
    };
    
    queueMessageProcessing(msg.channel, () => processMessageAsync(messagePayload));
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
  is_fde?: boolean;
}) {
  try {
    console.log('[Pipeline] Processing message:', {
      text: messageData.text.substring(0, 100),
      channel: messageData.slack_channel_id,
      ts: messageData.slack_ts,
      is_fde: messageData.is_fde || false,
    });

    // Fetch Slack username
    const slackUsername = await getSlackUsername(messageData.slack_user_id);
    console.log('[Pipeline] Resolved username:', slackUsername || '(unknown)');

    // Fetch context: thread context for replies, channel history for top-level messages
    const isThreadReply = messageData.root_thread_ts !== messageData.slack_ts;
    let threadContext: { messages: Array<{ text: string; user: string }> } | undefined;
    let channelContext: { messages: Array<{ text: string; user: string }> } | undefined;
    
    if (isThreadReply) {
      console.log('[Pipeline] Fetching thread context...');
      const threadMessages = await getThreadContext(
        messageData.slack_channel_id,
        messageData.root_thread_ts,
        messageData.slack_ts
      );
      threadContext = { messages: threadMessages };
      console.log('[Pipeline] Thread context:', threadMessages.length, 'previous messages');
    } else {
      // For non-thread messages, fetch recent channel history
      console.log('[Pipeline] Fetching channel history...');
      const channelMessages = await getChannelHistory(
        messageData.slack_channel_id,
        messageData.slack_ts
      );
      if (channelMessages.length > 0) {
        channelContext = { messages: channelMessages };
        console.log('[Pipeline] Channel context:', channelMessages.length, 'recent messages');
      } else {
        console.log('[Pipeline] No channel context available');
      }
    }

    // Normalize
    const normalized = normalizeMessage(messageData.text);
    console.log('[Pipeline] Normalized:', normalized.normalizedText.substring(0, 100));

    // Classify with thread context or channel context
    const classification = await classifyMessage(
      messageData.text,
      normalized.normalizedText,
      threadContext,
      channelContext
    );
    console.log('[Pipeline] Classification result:', {
      is_relevant: classification.is_relevant,
      category: classification.category,
      confidence: classification.confidence.toFixed(2),
      short_title: classification.short_title,
      inferred_assignees: classification.inferred_assignees.length > 0 ? classification.inferred_assignees : 'none',
      has_thread_context: !!threadContext && threadContext.messages.length > 0,
      has_channel_context: !!channelContext && channelContext.messages.length > 0,
    });

    // Only process relevant messages
    if (!classification.is_relevant) {
      console.log('[Pipeline] ❌ Message classified as IRRELEVANT:', {
        text: messageData.text.substring(0, 150),
        category: classification.category,
        confidence: classification.confidence,
        short_title: classification.short_title,
        has_thread_context: !!threadContext && threadContext.messages.length > 0,
        has_channel_context: !!channelContext && channelContext.messages.length > 0,
        ts: messageData.slack_ts,
      });
      console.log('[Pipeline] Skipping ticket creation for irrelevant message');
      return;
    }

    // Group and create/attach to ticket
    console.log('[Pipeline] Grouping message and creating/attaching to ticket...');
    const ticketId = await groupMessage(
      { ...messageData, slack_username: slackUsername },
      classification,
      { is_fde: messageData.is_fde }
    );
    
    if (ticketId) {
      console.log('[Pipeline] Success! Ticket ID:', ticketId);
      // Emit socket event
      emitTicketUpdated(ticketId);
    } else {
      console.log('[Pipeline] Message processed but no ticket created (FDE message with no existing ticket to attach to)');
    }
  } catch (error) {
    console.error('[Pipeline] Error processing message:', error);
    throw error;
  }
}
