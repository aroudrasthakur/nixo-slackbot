import { supabase } from './client';
import type { Ticket, TicketWithMessages, TicketStatus } from '@nixo-slackbot/shared';
import { getMessagesByTicketId } from './messages';

export interface TicketInsert {
  title: string;
  category: 'bug_report' | 'support_question' | 'feature_request' | 'product_question';
  canonical_key?: string | null;
  embedding?: number[] | null;
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

  return data as Ticket;
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

  return data as Ticket;
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
    return ticket as Ticket;
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

  return data as Ticket;
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

  const ticket = data as Ticket;
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

  return (data || []) as Ticket[];
}
