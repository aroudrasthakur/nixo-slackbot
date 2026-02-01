import { supabase } from './client';
import type { Message } from '@nixo-slackbot/shared';

export interface MessageInsert {
  ticket_id: string;
  slack_channel_id: string;
  slack_ts: string;
  root_thread_ts: string;
  slack_user_id: string;
  slack_team_id?: string | null;
  slack_event_id?: string | null;
  text: string;
  permalink?: string | null;
}

export async function upsertMessage(data: MessageInsert): Promise<Message> {
  const { data: message, error } = await supabase
    .from('messages')
    .upsert(
      {
        ...data,
        slack_team_id: data.slack_team_id || null,
        slack_event_id: data.slack_event_id || null,
        permalink: data.permalink || null,
      },
      {
        onConflict: 'slack_channel_id,slack_ts',
        ignoreDuplicates: false,
      }
    )
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
