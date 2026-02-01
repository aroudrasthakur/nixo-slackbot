export type TicketStatus = 'open' | 'closed' | 'resolved';

export type TicketCategory =
  | 'bug_report'
  | 'support_question'
  | 'feature_request'
  | 'product_question'
  | 'irrelevant';

export interface Ticket {
  id: string;
  title: string;
  category: TicketCategory;
  status: TicketStatus;
  canonical_key: string | null;
  embedding: number[] | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  ticket_id: string;
  slack_channel_id: string;
  slack_ts: string;
  root_thread_ts: string; // Not null - computed as event.thread_ts ?? event.ts
  slack_user_id: string;
  slack_team_id: string | null;
  slack_event_id: string | null;
  text: string;
  permalink: string | null;
  created_at: string;
}

export interface ClassificationResult {
  is_relevant: boolean;
  category: TicketCategory;
  confidence: number;
  short_title: string;
  signals: string[];
}

export interface TicketWithMessages extends Ticket {
  messages: Message[];
}
