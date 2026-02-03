import { boltApp } from './bolt';

export interface ThreadMessage {
  text: string;
  user: string;
  ts: string;
}

/**
 * Fetch thread context (previous messages in the same thread) from Slack.
 * Returns empty array if not in a thread or if fetching fails.
 */
export async function getThreadContext(
  channelId: string,
  threadTs: string,
  currentTs: string
): Promise<ThreadMessage[]> {
  // If thread_ts === ts, this is the root message (no thread context)
  if (threadTs === currentTs) {
    return [];
  }

  try {
    const result = await boltApp.client.conversations.replies({
      channel: channelId,
      ts: threadTs,
      limit: 50, // Get up to 50 messages in the thread
    });

    if (!result.ok || !result.messages) {
      return [];
    }

    // Filter out the current message and bot messages, return previous messages
    return result.messages
      .filter((msg) => {
        // Exclude current message
        if (msg.ts === currentTs) return false;
        // Exclude bot messages
        if ((msg as { subtype?: string; bot_id?: string }).subtype === 'bot_message' || (msg as { bot_id?: string }).bot_id) return false;
        // Only include messages before current
        return msg.ts && parseFloat(msg.ts) < parseFloat(currentTs);
      })
      .map((msg) => ({
        text: msg.text || '',
        user: msg.user || '',
        ts: msg.ts || '',
      }))
      .reverse(); // Oldest first
  } catch (error) {
    console.warn('[ThreadContext] Error fetching thread:', error);
    return [];
  }
}

const CHANNEL_CONTEXT_LIMIT = parseInt(process.env.CHANNEL_CONTEXT_LIMIT || '25', 10);

/**
 * Fetch recent channel history (previous messages in the same channel) from Slack.
 * Used for non-thread messages to provide context for classification.
 * Returns empty array if fetching fails.
 */
export async function getChannelHistory(
  channelId: string,
  beforeTs: string,
  limit: number = CHANNEL_CONTEXT_LIMIT
): Promise<ThreadMessage[]> {
  try {
    const result = await boltApp.client.conversations.history({
      channel: channelId,
      latest: beforeTs,
      limit,
      inclusive: false, // Exclude the current message
    });

    if (!result.ok || !result.messages) {
      return [];
    }

    // Filter out bot messages, map to ThreadMessage[], reverse to oldest-first
    return result.messages
      .filter((msg) => {
        // Exclude bot messages
        const m = msg as { subtype?: string; bot_id?: string; thread_ts?: string; ts?: string };
        if (m.subtype === 'bot_message' || m.bot_id) return false;
        // Exclude thread replies (only include top-level channel messages)
        if (m.thread_ts && m.thread_ts !== m.ts) return false;
        return true;
      })
      .map((msg) => ({
        text: msg.text || '',
        user: msg.user || '',
        ts: msg.ts || '',
      }))
      .reverse(); // Oldest first
  } catch (error) {
    console.warn('[ChannelHistory] Error fetching channel history:', error);
    return [];
  }
}
