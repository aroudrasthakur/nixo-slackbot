import OpenAI from 'openai';
import type { ClassificationResult } from '@nixo-slackbot/shared';
import {
  findTicketByRootThreadTs,
  findTicketByCanonicalKey,
  findSimilarTicket,
  createTicket,
} from '../db/tickets';
import { upsertMessage } from '../db/messages';
import { normalizeMessage } from './normalize';
import { openaiLimiter } from './limiter';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface MessageData {
  slack_channel_id: string;
  slack_ts: string;
  root_thread_ts: string;
  slack_user_id: string;
  slack_team_id?: string | null;
  slack_event_id?: string | null;
  text: string;
  permalink?: string | null;
}

export async function groupMessage(
  messageData: MessageData,
  classification: ClassificationResult
): Promise<string> {
  // Step 1: Check thread grouping
  console.log('[Group] Step 1: Checking thread grouping for root_thread_ts:', messageData.root_thread_ts);
  const threadTicket = await findTicketByRootThreadTs(messageData.root_thread_ts);
  if (threadTicket) {
    console.log('[Group] Found existing ticket via thread:', threadTicket.id);
    const message = await upsertMessage({
      ...messageData,
      ticket_id: threadTicket.id,
    });
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
      console.log('[Group] Found existing ticket via canonical key:', canonicalTicket.id);
      const message = await upsertMessage({
        ...messageData,
        ticket_id: canonicalTicket.id,
      });
      return canonicalTicket.id;
    }
  }

  // Step 3: Vector similarity search
  console.log('[Group] Step 3: Computing embedding for similarity search...');
  const embedding = await openaiLimiter(async () => {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: classification.short_title || messageData.text.substring(0, 500),
    });
    return response.data[0].embedding;
  });

  console.log('[Group] Searching for similar tickets...');
  const similar = await findSimilarTicket(embedding, 14, 0.17);
  if (similar) {
    console.log('[Group] Found similar ticket:', similar.ticketId, 'distance:', similar.distance);
    const message = await upsertMessage({
      ...messageData,
      ticket_id: similar.ticketId,
    });
    return similar.ticketId;
  }

  // Step 4: Create new ticket
  console.log('[Group] Step 4: Creating new ticket...');
  const ticket = await createTicket({
    title: classification.short_title || messageData.text.substring(0, 100),
    category: classification.category === 'irrelevant' ? 'support_question' : classification.category,
    canonical_key: canonicalKey || null,
    embedding,
  });

  console.log('[Group] Created new ticket:', ticket.id, 'title:', ticket.title);

  const message = await upsertMessage({
    ...messageData,
    ticket_id: ticket.id,
  });

  console.log('[Group] Attached message to ticket:', message.id);

  return ticket.id;
}
