import { supabase } from './client';
import type { Message } from '@nixo-slackbot/shared';

export interface MessageInsert {
  ticket_id: string;
  slack_channel_id: string;
  slack_ts: string;
  root_thread_ts: string;
  slack_user_id: string;
  slack_username?: string | null;
  slack_team_id?: string | null;
  slack_event_id?: string | null;
  text: string;
  permalink?: string | null;
  /** Optional embedding for semantic matching; stored for future similarity search */
  embedding?: number[] | null;
  /** If true, message is context-only (is_relevant=false but attached to ticket) */
  is_context_only?: boolean;
}

export async function upsertMessage(data: MessageInsert): Promise<Message> {
  const payload = {
    ticket_id: data.ticket_id,
    slack_channel_id: data.slack_channel_id,
    slack_ts: data.slack_ts,
    root_thread_ts: data.root_thread_ts,
    slack_user_id: data.slack_user_id,
    text: data.text,
    slack_username: data.slack_username ?? null,
    slack_team_id: data.slack_team_id ?? null,
    slack_event_id: data.slack_event_id ?? null,
    permalink: data.permalink ?? null,
    embedding: data.embedding ?? null,
    is_context_only: data.is_context_only ?? false,
  };

  const { data: message, error } = await supabase
    .from('messages')
    .upsert(payload, {
      onConflict: 'slack_channel_id,slack_ts',
      ignoreDuplicates: false,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to upsert message: ${error.message}`);
  }

  return message as Message;
}

export async function getMessagesByTicketId(ticketId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to get messages: ${error.message}`);
  }

  return (data || []) as Message[];
}

export async function getMessageBySlackId(
  channelId: string,
  ts: string
): Promise<Message | null> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('slack_channel_id', channelId)
    .eq('slack_ts', ts)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to get message: ${error.message}`);
  }

  return data as Message;
}

export async function updateMessageText(
  channelId: string,
  ts: string,
  newText: string
): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .update({ text: newText })
    .eq('slack_channel_id', channelId)
    .eq('slack_ts', ts)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update message: ${error.message}`);
  }

  return data as Message;
}

/**
 * Find an open ticket that has a message semantically similar to the query embedding.
 * Uses vector DB (pgvector) cosine distance on message embeddings.
 */
export async function findSimilarMessage(
  embedding: number[],
  daysBack: number = 14,
  threshold: number = 0.17
): Promise<{ ticketId: string; distance: number } | null> {
  const { data, error } = await supabase.rpc('find_similar_message', {
    query_embedding: embedding,
    days_back: daysBack,
    ticket_status_filter: 'open',
    result_limit: 1,
  });

  if (error) {
    throw new Error(`Failed to find similar message: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return null;
  }

  const result = data[0] as { ticket_id: string; distance: number };
  if (result.distance > threshold) {
    return null;
  }

  return {
    ticketId: result.ticket_id,
    distance: result.distance,
  };
}

/**
 * Find multiple ticket candidates via message similarity for scored matching.
 * Returns top N candidates with metadata needed for scoring.
 */
export async function findSimilarMessagesCandidates(
  embedding: number[],
  daysBack: number = 14,
  limit: number = 5
): Promise<TicketCandidate[]> {
  const { data, error } = await supabase.rpc('find_similar_messages_candidates', {
    query_embedding: embedding,
    days_back: daysBack,
    ticket_status_filter: 'open',
    result_limit: limit,
  });

  if (error) {
    throw new Error(`Failed to find similar message candidates: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  return data.map((row: any) => ({
    ticketId: row.ticket_id,
    distance: row.distance,
    category: row.category,
    updatedAt: row.updated_at,
    canonicalKey: row.canonical_key,
    slackChannelId: row.slack_channel_id || undefined,
  }));
}

/**
 * Find cross-channel message candidates for CCR.
 * Returns top K messages from last CROSS_CHANNEL_DAYS, grouped by ticket_id.
 */
export async function findCrossChannelMessageCandidates(
  embedding: number[],
  daysBack: number = 14,
  limit: number = 25
): Promise<TicketCandidate[]> {
  const { data, error } = await supabase.rpc('find_cross_channel_message_candidates', {
    query_embedding: embedding,
    days_back: daysBack,
    ticket_status_filter: 'open',
    result_limit: limit,
  });

  if (error) {
    throw new Error(`Failed to find cross-channel message candidates: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  return data.map((row: any) => ({
    ticketId: row.ticket_id,
    distance: row.distance,
    category: row.category,
    updatedAt: row.updated_at,
    canonicalKey: row.canonical_key,
    slackChannelId: row.slack_channel_id || undefined,
  }));
}

export interface CrossChannelContextTicket {
  ticket_id: string;
  title: string;
  category: string;
  summary: any;
  distance: number;
  messages: Array<{ text: string; username: string | null }>;
}

export interface CrossChannelContextMessage {
  ticket_id: string;
  text: string;
  username: string | null;
  distance: number;
  ticket_title: string;
}

export interface CrossChannelContext {
  tickets: CrossChannelContextTicket[];
  messages: CrossChannelContextMessage[];
}

/**
 * Get cross-channel context for classification (DB RAG).
 * Returns top similar tickets and messages from other channels.
 */
export async function getCrossChannelContext(
  embedding: number[],
  daysBack: number = 14
): Promise<CrossChannelContext> {
  const { data, error } = await supabase.rpc('get_ticket_context_for_classification', {
    query_embedding: embedding,
    days_back: daysBack,
    ticket_limit: 3,
    message_limit: 5,
  });

  if (error) {
    console.error('[DB] Error fetching cross-channel context:', error);
    return { tickets: [], messages: [] };
  }

  if (!data) {
    return { tickets: [], messages: [] };
  }

  const tickets = (data.tickets || []).map((t: any) => ({
    ticket_id: t.ticket_id,
    title: t.title,
    category: t.category,
    summary: t.summary,
    distance: t.distance,
    messages: (t.messages || []).map((m: any) => ({
      text: m.text,
      username: m.username,
    })),
  }));

  const messages = (data.messages || []).map((m: any) => ({
    ticket_id: m.ticket_id,
    text: m.text,
    username: m.username,
    distance: m.distance,
    ticket_title: m.ticket_title,
  }));

  return { tickets, messages };
}
