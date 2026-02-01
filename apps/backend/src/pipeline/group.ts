import OpenAI from 'openai';
import type { ClassificationResult } from '@nixo-slackbot/shared';
import {
  findTicketByRootThreadTs,
  findTicketByCanonicalKey,
  findSimilarTicket,
  findTicketByChannelAndRecentTime,
  createTicket,
  updateTicket,
  getTicket,
} from '../db/tickets';
import { upsertMessage, findSimilarMessage, getMessagesByTicketId } from '../db/messages';
import { normalizeMessage } from './normalize';
import { openaiLimiter } from './limiter';
import { generateTicketSummary, generateTicketSummaryFromConversation } from './summarize';

const SIMILARITY_DAYS_BACK = parseInt(process.env.SIMILARITY_DAYS_BACK || '14', 10);
const SIMILARITY_THRESHOLD = parseFloat(process.env.SIMILARITY_THRESHOLD || '0.17');
// More lenient threshold for recent channel fallback (Step 3.5)
// Since we already have temporal (5 min) and channel constraints, we can be more relaxed
const RECENT_CHANNEL_THRESHOLD = parseFloat(process.env.RECENT_CHANNEL_THRESHOLD || '0.40');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Compute cosine distance between two embeddings.
 * Returns a value between 0 (identical) and 2 (opposite).
 * Lower values mean more similar.
 */
function cosineDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have the same dimension');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const cosineSimilarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  // Cosine distance = 1 - cosine similarity
  return 1 - cosineSimilarity;
}

export interface MessageData {
  slack_channel_id: string;
  slack_ts: string;
  root_thread_ts: string;
  slack_user_id: string;
  slack_username?: string | null;
  slack_team_id?: string | null;
  slack_event_id?: string | null;
  text: string;
  permalink?: string | null;
}

/**
 * Refresh ticket summary and optionally merge assignees when a new message is attached.
 */
async function refreshTicketSummary(
  ticketId: string,
  latestClassification: ClassificationResult,
  latestMessage: MessageData
): Promise<void> {
  try {
    const ticket = await getTicket(ticketId);
    if (!ticket || !ticket.messages.length) return;

    const messages = ticket.messages.map((m) => ({
      text: m.text,
      username: m.slack_username || null,
    }));

    const existingAssignees = ticket.assignees || [];
    const newInferred = latestClassification.inferred_assignees || [];
    const mergedAssignees = [...new Set([...existingAssignees, ...newInferred])];

    console.log('[Group] Refreshing summary for ticket:', ticketId, 'messages:', messages.length);

    const summary = await generateTicketSummaryFromConversation({
      ticketTitle: ticket.title,
      ticketCategory: ticket.category,
      messages,
      assignees: mergedAssignees,
      reporterUsername: ticket.reporter_username || null,
    });

    await updateTicket(ticketId, {
      summary,
      assignees: mergedAssignees,
    });

    console.log('[Group] Summary updated for ticket:', ticketId);
  } catch (error) {
    console.error('[Group] Error refreshing ticket summary:', error);
  }
}

export interface GroupOptions {
  is_fde?: boolean;
}

export async function groupMessage(
  messageData: MessageData,
  classification: ClassificationResult,
  options?: GroupOptions
): Promise<string | null> {
  const isFde = options?.is_fde ?? false;
  // Step 1: Check thread grouping
  console.log('[Group] Step 1: Checking thread grouping for root_thread_ts:', messageData.root_thread_ts);
  const threadTicket = await findTicketByRootThreadTs(messageData.root_thread_ts);
  if (threadTicket) {
    console.log('[Group] Found existing ticket via thread:', threadTicket.id, isFde ? '(FDE adding context)' : '');
    await upsertMessage({
      ...messageData,
      ticket_id: threadTicket.id,
    });
    await refreshTicketSummary(threadTicket.id, classification, messageData);
    return threadTicket.id;
  }

  // Step 2: Compute canonical_key and check for match
  console.log('[Group] Step 2: Computing canonical key...');
  const normalized = normalizeMessage(messageData.text);
  const canonicalKey = normalized.signals.length > 0
    ? normalized.signals.join('_')
    : normalized.normalizedText
        .substring(0, 50)
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

  console.log('[Group] Canonical key:', canonicalKey);

  if (canonicalKey) {
    const canonicalTicket = await findTicketByCanonicalKey(canonicalKey);
    if (canonicalTicket) {
      console.log('[Group] Found existing ticket via canonical key:', canonicalTicket.id, isFde ? '(FDE adding context)' : '');
      await upsertMessage({
        ...messageData,
        ticket_id: canonicalTicket.id,
      });
      await refreshTicketSummary(canonicalTicket.id, classification, messageData);
      return canonicalTicket.id;
    }
  }

  // Step 3: Semantic matching via vector DB — match by ticket content and by message content
  console.log('[Group] Step 3: Computing embedding for semantic similarity...');
  const textToEmbed = classification.short_title || messageData.text.substring(0, 500);
  const embedding = await openaiLimiter(async () => {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: textToEmbed,
    });
    return response.data[0].embedding;
  });

  console.log('[Group] Searching for similar tickets (by ticket embedding)...');
  const similarTicket = await findSimilarTicket(embedding, SIMILARITY_DAYS_BACK, SIMILARITY_THRESHOLD);
  console.log('[Group] Searching for similar messages (by message content)...');
  const similarMessage = await findSimilarMessage(embedding, SIMILARITY_DAYS_BACK, SIMILARITY_THRESHOLD);

  const best = (() => {
    if (similarTicket && similarMessage) {
      return similarTicket.distance <= similarMessage.distance ? similarTicket : similarMessage;
    }
    return similarTicket ?? similarMessage ?? null;
  })();

  if (best) {
    const source = best === similarTicket ? 'ticket' : 'message';
    console.log('[Group] Found similar ticket via', source, 'match:', best.ticketId, 'distance:', best.distance, isFde ? '(FDE adding context)' : '');
    await upsertMessage({
      ...messageData,
      ticket_id: best.ticketId,
      embedding,
    });
    await refreshTicketSummary(best.ticketId, classification, messageData);
    return best.ticketId;
  }

  // Step 3.5: Fallback - check for recent tickets in the same channel
  // This catches sequential messages in the same channel that aren't in a thread
  // BUT only if the message is semantically similar to the ticket (prevents merging unrelated issues)
  console.log('[Group] Step 3.5: Checking for recent tickets in the same channel...');
  const recentChannelTicket = await findTicketByChannelAndRecentTime(
    messageData.slack_channel_id,
    5 // 5 minutes window
  );
  if (recentChannelTicket) {
    // Check semantic similarity: only attach if message is actually related to the ticket
    const ticketEmb = recentChannelTicket.embedding;
    const sameDimension =
      Array.isArray(ticketEmb) &&
      Array.isArray(embedding) &&
      ticketEmb.length === embedding.length;

    if (ticketEmb && embedding && sameDimension) {
      const distance = cosineDistance(embedding, ticketEmb);
      console.log('[Group] Recent ticket found, semantic distance:', distance.toFixed(4), 'threshold:', RECENT_CHANNEL_THRESHOLD);

      if (distance > RECENT_CHANNEL_THRESHOLD) {
        console.log('[Group] Recent ticket is NOT semantically similar - creating new ticket instead');
        // Continue to Step 4 to create a new ticket
      } else {
        console.log('[Group] Found recent ticket in same channel (semantically similar):', recentChannelTicket.id, isFde ? '(FDE adding context)' : '');
        await upsertMessage({
          ...messageData,
          ticket_id: recentChannelTicket.id,
          embedding,
        });
        await refreshTicketSummary(recentChannelTicket.id, classification, messageData);
        return recentChannelTicket.id;
      }
    } else if (ticketEmb && embedding && !sameDimension) {
      console.warn(
        '[Group] Recent ticket embedding dimension mismatch (ticket:', ticketEmb?.length ?? 0, ', message:', embedding.length, ') - creating new ticket'
      );
      // Continue to Step 4 to create a new ticket
    } else {
      // If ticket has no embedding, skip semantic check (attach anyway for backward compatibility)
      // This handles tickets created before embeddings were added
      console.log('[Group] Found recent ticket in same channel (no embedding to compare):', recentChannelTicket.id, isFde ? '(FDE adding context)' : '');
      await upsertMessage({
        ...messageData,
        ticket_id: recentChannelTicket.id,
        embedding,
      });
      await refreshTicketSummary(recentChannelTicket.id, classification, messageData);
      return recentChannelTicket.id;
    }
  }

  // Step 4: Create new ticket with summary and assignees
  // FDE messages cannot create new tickets, only add context to existing ones
  if (isFde) {
    console.log('[Group] ⚠️ FDE message cannot create new ticket - no existing ticket to attach to');
    return null;
  }

  console.log('[Group] Step 4: Creating new ticket...');
  
  // Get assignees from classification (inferred from @mentions etc.)
  const assignees = classification.inferred_assignees || [];
  console.log('[Group] Inferred assignees:', assignees);

  // Generate AI summary
  console.log('[Group] Generating ticket summary...');
  const summary = await generateTicketSummary({
    text: messageData.text,
    classification,
    reporterUsername: messageData.slack_username || null,
    assignees,
  });
  console.log('[Group] Summary generated:', summary.description);

  const ticket = await createTicket({
    title: classification.short_title || messageData.text.substring(0, 100),
    category: classification.category === 'irrelevant' ? 'support_question' : classification.category,
    canonical_key: canonicalKey || null,
    embedding,
    assignees,
    reporter_user_id: messageData.slack_user_id,
    reporter_username: messageData.slack_username || null,
    summary,
  });

  console.log('[Group] Created new ticket:', ticket.id, 'title:', ticket.title);

  const message = await upsertMessage({
    ...messageData,
    ticket_id: ticket.id,
    embedding,
  });

  if (message.ticket_id !== ticket.id) {
    console.error('[Group] BUG: Creating message was stored with wrong ticket_id:', {
      expected: ticket.id,
      got: message.ticket_id,
      messageId: message.id,
    });
  }
  console.log('[Group] Attached creating message to ticket:', message.id, 'ticket_id:', message.ticket_id);

  return ticket.id;
}
