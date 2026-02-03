import { boltApp } from './bolt';
import { shouldProcessMessage } from '../pipeline/filter';
import { classifyMessage } from '../pipeline/classify';
import { normalizeMessage } from '../pipeline/normalize';
import { groupMessage } from '../pipeline/group';
import { emitTicketUpdated } from '../socket/events';
import { getSlackUsername } from './users.js';
import { getThreadContext, getChannelHistory } from './threads.js';
import { getOpenAIEmbedding } from '../db/client';
import { getCrossChannelContext } from '../db/messages';
import { findSimilarTicket } from '../db/tickets';
import { findSimilarMessage } from '../db/messages';

const FDE_USER_ID = process.env.FDE_USER_ID;

/**
 * Global message queue to serialize processing across ALL channels.
 * Prevents race conditions where concurrent messages (same or different channels)
 * fail to see each other's tickets because they're being processed simultaneously.
 * Cross-channel tickets (CCR) require this: a message in #support might relate to
 * a ticket from #general that's still being created.
 */
let globalQueue: Promise<void> = Promise.resolve();

/**
 * Queue a message for processing. All messages are processed sequentially,
 * regardless of channel, so no race condition can occur.
 */
function queueMessageProcessing(processFn: () => Promise<void>): void {
  const previous = globalQueue;
  globalQueue = previous
    .then(processFn)
    .catch((error) => {
      console.error('[Pipeline] Error processing queued message:', error);
    });
}

export function setupSlackHandlers() {
  // Handle normal message events
  boltApp.message(async ({ message, event, say, ack }) => {
    // Message events don't always provide ack in Bolt v3 - only call if available
    if (typeof ack === 'function') {
      await (ack as () => Promise<void>)();
    }

    const msg = message as { channel: string; ts: string; user?: string; text?: string; subtype?: string; bot_id?: string; thread_ts?: string };

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

    // Queue message for sequential processing (global, all channels)
    // Prevents race conditions where concurrent messages fail to see each other's tickets
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
    
    queueMessageProcessing(() => processMessageAsync(messagePayload));
  });

  // Optional: Handle message edits
  boltApp.event('message', async ({ event, ack }) => {
    const msg = event as any;
    if (msg.subtype !== 'message_changed') {
      return;
    }

    // Message events don't always provide ack in Bolt v3 - only call if available
    if (typeof ack === 'function') {
      await (ack as () => Promise<void>)();
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

    // Fetch cross-channel context (DB RAG) for classification
    let crossChannelContext;
    try {
      const embedding = await getOpenAIEmbedding(messageData.text);
      const daysBack = parseInt(process.env.CROSS_CHANNEL_DAYS || '14', 10);
      crossChannelContext = await getCrossChannelContext(embedding, daysBack);
      console.log('[Pipeline] Cross-channel context:', {
        tickets: crossChannelContext.tickets.length,
        messages: crossChannelContext.messages.length,
      });
    } catch (error) {
      console.error('[Pipeline] Error fetching cross-channel context:', error);
      crossChannelContext = undefined;
    }

    // Classify with thread context, channel context, and cross-channel context
    let classification = await classifyMessage(
      messageData.text,
      normalized.normalizedText,
      threadContext,
      channelContext,
      crossChannelContext
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

    // Post-classification fallback: if classified as irrelevant but matches existing ticket semantically, reclassify
    if (!classification.is_relevant && (channelContext || threadContext)) {
      try {
        // Check if this is a style/color request (more likely to be misclassified)
        const normalizedLower = normalized.normalizedText.toLowerCase();
        const styleVerbs = ['make', 'change', 'set', 'ensure', 'update', 'switch', 'turn'];
        const colorWords = ['blue', 'red', 'green', 'purple', 'yellow', 'orange', 'pink', 'black', 'white', 'gray', 'grey', 'color', 'colour'];
        const isStyleRequest = styleVerbs.some(v => normalizedLower.includes(v)) && colorWords.some(c => normalizedLower.includes(c));
        
        const embedding = await getOpenAIEmbedding(messageData.text);
        // More lenient threshold for style requests (0.30) vs regular (0.25)
        const similarityThreshold = isStyleRequest ? 0.30 : 0.25;
        const similarTicket = await findSimilarTicket(embedding, 14, similarityThreshold);
        const similarMessage = await findSimilarMessage(embedding, 14, similarityThreshold);
        
        const bestMatch = similarTicket && similarMessage
          ? (similarTicket.distance <= similarMessage.distance ? similarTicket : similarMessage)
          : (similarTicket ?? similarMessage ?? null);
        
        if (bestMatch && bestMatch.distance <= similarityThreshold) {
          console.log('[Pipeline] Post-classification fallback: Irrelevant message matches existing ticket semantically, reclassifying as relevant', {
            ticketId: bestMatch.ticketId,
            distance: bestMatch.distance.toFixed(4),
            originalCategory: classification.category,
            isStyleRequest,
          });
          
          // Extract signals from channel/thread context to improve short_title
          const contextSignals: string[] = [];
          if (channelContext) {
            for (const msg of channelContext.messages) {
              const msgNorm = normalizeMessage(msg.text);
              contextSignals.push(...msgNorm.signals);
            }
          }
          if (threadContext) {
            for (const msg of threadContext.messages) {
              const msgNorm = normalizeMessage(msg.text);
              contextSignals.push(...msgNorm.signals);
            }
          }
          const uniqueSignals = [...new Set([...classification.signals, ...contextSignals])].slice(0, 10);
          
          // Reclassify as relevant with inferred category from context
          classification = {
            ...classification,
            is_relevant: true,
            category: (isStyleRequest || classification.category === 'irrelevant') ? 'feature_request' : classification.category,
            confidence: Math.max(classification.confidence, isStyleRequest ? 0.6 : 0.5), // Higher confidence for style requests
            short_title: classification.short_title || (isStyleRequest && uniqueSignals.length > 0 
              ? `Make ${uniqueSignals[0]} ${normalizedLower.match(/\b(blue|red|green|purple|yellow|orange|pink|black|white|gray|grey)\b/)?.[0] || 'blue'}`.substring(0, 100)
              : messageData.text.substring(0, 100)),
            signals: uniqueSignals,
          };
          
          console.log('[Pipeline] Reclassified as relevant:', {
            category: classification.category,
            confidence: classification.confidence.toFixed(2),
            short_title: classification.short_title,
            signals: classification.signals,
          });
        }
      } catch (error) {
        console.warn('[Pipeline] Error in post-classification fallback:', error);
        // Continue with original classification
      }
    }

    // Handle irrelevant messages: attempt to attach to existing ticket as context-only
    if (!classification.is_relevant) {
      console.log('[Pipeline] ❌ Message classified as IRRELEVANT, attempting context-only attachment:', {
        text: messageData.text.substring(0, 150),
        category: classification.category,
        confidence: classification.confidence,
        short_title: classification.short_title,
        has_thread_context: !!threadContext && threadContext.messages.length > 0,
        has_channel_context: !!channelContext && channelContext.messages.length > 0,
        ts: messageData.slack_ts,
      });
      
      // Attempt to attach to existing ticket (groupMessage will try to find a match)
      // If attached, it will be stored with is_context_only=true
      try {
        const ticketId = await groupMessage(
          { ...messageData, slack_username: slackUsername },
          classification,
          { is_fde: messageData.is_fde, is_context_only: true }
        );
        
        if (ticketId) {
          console.log('[Pipeline] Context-only message attached to ticket:', ticketId);
          emitTicketUpdated(ticketId);
        } else {
          console.log('[Pipeline] Context-only message could not be attached to any ticket, skipping');
        }
      } catch (error) {
        console.error('[Pipeline] Error attempting context-only attachment:', error);
      }
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
