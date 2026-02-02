import { supabase } from './client';
import type { Ticket, TicketWithMessages, TicketStatus, TicketSummary } from '@nixo-slackbot/shared';
import { getMessagesByTicketId, getMessageCountsByTicketIds } from './messages';

/**
 * Parse a pgvector embedding returned by Supabase.
 * Supabase returns vector columns as strings like "[0.1, 0.2, ...]".
 * This function converts them to proper number arrays.
 */
function parseEmbedding(embedding: unknown): number[] | null {
  if (embedding === null || embedding === undefined) {
    return null;
  }
  // Already a number array
  if (Array.isArray(embedding) && typeof embedding[0] === 'number') {
    return embedding as number[];
  }
  // String format from Supabase/pgvector: "[0.1, 0.2, ...]"
  if (typeof embedding === 'string') {
    try {
      const parsed = JSON.parse(embedding);
      if (Array.isArray(parsed) && (parsed.length === 0 || typeof parsed[0] === 'number')) {
        return parsed as number[];
      }
    } catch {
      console.warn('[DB] Failed to parse embedding string:', embedding.substring(0, 50));
    }
  }
  return null;
}

/**
 * Normalize a raw ticket row from Supabase, parsing the embedding fields.
 */
function normalizeTicket(row: Record<string, unknown>): Ticket {
  return {
    ...row,
    embedding: parseEmbedding(row.embedding),
    summary_embedding: parseEmbedding(row.summary_embedding),
  } as Ticket;
}

export interface TicketInsert {
  title: string;
  category: 'bug_report' | 'support_question' | 'feature_request' | 'product_question';
  canonical_key?: string | null;
  embedding?: number[] | null;
  summary_embedding?: number[] | null;
  assignees?: string[];
  reporter_user_id?: string | null;
  reporter_username?: string | null;
  summary?: TicketSummary | null;
}

export async function findTicketByRootThreadTs(rootThreadTs: string): Promise<Ticket | null> {
  // Find ticket by joining messages on root_thread_ts
  const { data: messages, error: messagesError } = await supabase
    .from('messages')
    .select('ticket_id')
    .eq('root_thread_ts', rootThreadTs)
    .limit(1);

  if (messagesError || !messages || messages.length === 0) {
    return null;
  }

  const ticketId = messages[0].ticket_id;

  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', ticketId)
    .eq('status', 'open')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to find ticket by root_thread_ts: ${error.message}`);
  }

  return normalizeTicket(data as Record<string, unknown>);
}

export async function findTicketByCanonicalKey(canonicalKey: string): Promise<Ticket | null> {
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('status', 'open')
    .eq('canonical_key', canonicalKey)
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to find ticket by canonical_key: ${error.message}`);
  }

  return normalizeTicket(data as Record<string, unknown>);
}

export async function findSimilarTicket(
  embedding: number[],
  daysBack: number = 14,
  threshold: number = 0.17
): Promise<{ ticketId: string; distance: number } | null> {
  const { data, error } = await supabase.rpc('find_similar_ticket', {
    query_embedding: embedding,
    days_back: daysBack,
    ticket_status: 'open',
    result_limit: 1,
  });

  if (error) {
    throw new Error(`Failed to find similar ticket: ${error.message}`);
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

export interface TicketCandidate {
  ticketId: string;
  distance: number;
  category: string;
  updatedAt: string;
  canonicalKey: string | null;
  slackChannelId?: string; // For cross-channel logging
}

/**
 * Find multiple ticket candidates for scored matching.
 * Returns top N candidates with metadata needed for scoring.
 */
export async function findSimilarTicketsCandidates(
  embedding: number[],
  daysBack: number = 14,
  limit: number = 5
): Promise<TicketCandidate[]> {
  const { data, error } = await supabase.rpc('find_similar_tickets_candidates', {
    query_embedding: embedding,
    days_back: daysBack,
    ticket_status: 'open',
    result_limit: limit,
  });

  if (error) {
    throw new Error(`Failed to find similar ticket candidates: ${error.message}`);
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
 * Find cross-channel ticket candidates for CCR (Cross-Channel Context Retrieval).
 * Returns top K tickets from last CROSS_CHANNEL_DAYS using vector search.
 */
export async function findCrossChannelTicketCandidates(
  embedding: number[],
  daysBack: number = 14,
  limit: number = 15
): Promise<TicketCandidate[]> {
  const { data, error } = await supabase.rpc('find_cross_channel_ticket_candidates', {
    query_embedding: embedding,
    days_back: daysBack,
    ticket_status: 'open',
    result_limit: limit,
  });

  if (error) {
    throw new Error(`Failed to find cross-channel ticket candidates: ${error.message}`);
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

export async function createTicket(data: TicketInsert): Promise<Ticket> {
  try {
    console.log('[DB] Creating ticket:', {
      title: data.title.substring(0, 50),
      category: data.category,
      canonical_key: data.canonical_key?.substring(0, 30),
    });

    const { data: ticket, error } = await supabase
      .from('tickets')
      .insert({
        title: data.title,
        category: data.category,
        status: 'open',
        canonical_key: data.canonical_key || null,
        embedding: data.embedding || null,
        summary_embedding: data.summary_embedding || null,
        assignees: data.assignees || [],
        reporter_user_id: data.reporter_user_id || null,
        reporter_username: data.reporter_username || null,
        summary: data.summary || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[DB] Error creating ticket:', error);
      // Check if it's a unique constraint violation on canonical_key
      if (error.code === '23505' && data.canonical_key) {
        console.log('[DB] Unique constraint violation, fetching existing ticket...');
        // Fetch existing ticket
        const existing = await findTicketByCanonicalKey(data.canonical_key);
        if (existing) {
          console.log('[DB] Found existing ticket:', existing.id);
          return existing;
        }
      }
      throw new Error(`Failed to create ticket: ${error.message}`);
    }

    console.log('[DB] Ticket created successfully:', ticket.id);
    return normalizeTicket(ticket as Record<string, unknown>);
  } catch (error: any) {
    console.error('[DB] Exception creating ticket:', error);
    // Handle unique constraint violation
    if (error.code === '23505' && data.canonical_key) {
      const existing = await findTicketByCanonicalKey(data.canonical_key);
      if (existing) {
        return existing;
      }
    }
    throw error;
  }
}

export async function updateTicket(id: string, updates: Partial<Ticket>): Promise<Ticket> {
  const { data, error } = await supabase
    .from('tickets')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update ticket: ${error.message}`);
  }

  return normalizeTicket(data as Record<string, unknown>);
}

export async function attachMessageToTicket(ticketId: string, messageId: string): Promise<void> {
  // The trigger will update updated_at automatically
  // Just verify the message exists and is attached
  const { error } = await supabase
    .from('messages')
    .update({ ticket_id: ticketId })
    .eq('id', messageId);

  if (error) {
    throw new Error(`Failed to attach message to ticket: ${error.message}`);
  }
}

export async function getTicket(id: string): Promise<TicketWithMessages | null> {
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to get ticket: ${error.message}`);
  }

  const ticket = normalizeTicket(data as Record<string, unknown>);
  const messages = await getMessagesByTicketId(ticket.id);

  return {
    ...ticket,
    messages,
  };
}

export async function getTickets(status?: TicketStatus): Promise<Ticket[]> {
  let query = supabase.from('tickets').select('*').order('updated_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get tickets: ${error.message}`);
  }

  const tickets = (data || []).map((row) => normalizeTicket(row as Record<string, unknown>));
  const ticketIds = tickets.map((t) => t.id);
  const counts = await getMessageCountsByTicketIds(ticketIds);
  return tickets.map((t) => ({ ...t, message_count: counts.get(t.id) ?? 0 }));
}

/**
 * Find the most recent open ticket in the same channel within a time window.
 * Useful for grouping sequential messages in the same channel that aren't in a thread.
 */
export async function findTicketByChannelAndRecentTime(
  channelId: string,
  minutesBack: number = 5
): Promise<Ticket | null> {
  const cutoffTime = new Date();
  cutoffTime.setMinutes(cutoffTime.getMinutes() - minutesBack);

  // Find messages in the same channel created within the time window
  const { data: messages, error: messagesError } = await supabase
    .from('messages')
    .select('ticket_id, created_at')
    .eq('slack_channel_id', channelId)
    .gte('created_at', cutoffTime.toISOString())
    .order('created_at', { ascending: false })
    .limit(10);

  if (messagesError || !messages || messages.length === 0) {
    return null;
  }

  // Get unique ticket IDs from the messages
  const ticketIds = [...new Set(messages.map((m) => m.ticket_id))];

  // Find the most recent open ticket among these
  const { data: tickets, error: ticketsError } = await supabase
    .from('tickets')
    .select('*')
    .in('id', ticketIds)
    .eq('status', 'open')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (ticketsError) {
    if (ticketsError.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to find ticket by channel and recent time: ${ticketsError.message}`);
  }

  return normalizeTicket(tickets as Record<string, unknown>);
}

export async function deleteTicket(id: string): Promise<void> {
  // Messages are deleted via ON DELETE CASCADE
  const { error } = await supabase
    .from('tickets')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete ticket: ${error.message}`);
  }
}
