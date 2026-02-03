export type TicketStatus = 'open' | 'closed' | 'resolved';

export type TicketCategory =
  | 'bug_report'
  | 'support_question'
  | 'feature_request'
  | 'product_question'
  | 'irrelevant';

export interface TicketSummary {
  short_title: string;
  description: string;
  action_items: string[];
  technical_details: string | null;
  priority_hint: 'low' | 'medium' | 'high' | 'critical';
}

export interface Ticket {
  id: string;
  title: string;
  category: TicketCategory;
  status: TicketStatus;
  canonical_key: string | null;
  embedding: number[] | null;
  summary_embedding: number[] | null;
  assignees: string[];
  reporter_user_id: string | null;
  reporter_username: string | null;
  summary: TicketSummary | null;
  created_at: string;
  updated_at: string;
  /** Number of messages in this ticket (included when listing tickets) */
  message_count?: number;
}

export interface Message {
  id: string;
  ticket_id: string;
  slack_channel_id: string;
  slack_ts: string;
  root_thread_ts: string; // Not null - computed as event.thread_ts ?? event.ts
  slack_user_id: string;
  slack_username: string | null; // Display name from Slack
  slack_team_id: string | null;
  slack_event_id: string | null;
  text: string;
  permalink: string | null;
  created_at: string;
  /** Channel display name (e.g. #general), resolved from Slack when loading ticket */
  slack_channel_name?: string | null;
  /** Workspace/team display name, resolved from Slack when loading ticket */
  slack_workspace_name?: string | null;
  /** True if this message repeats the same intent as a prior message in the ticket */
  is_redundant?: boolean;
  /** Reference to the first message that established this intent_key */
  redundant_of_message_id?: string | null;
  /** Composite key: intent_action|intent_object|intent_value. Null if intent_object missing. */
  intent_key?: string | null;
  /** Primary object/component (button, dashboard, etc.). Required for intent_key. */
  intent_object?: string | null;
  /** Action type: style_change, access_control, add_feature, bug, etc. */
  intent_action?: string | null;
  /** Value: color (for style_change), role (for access_control), etc. */
  intent_value?: string | null;
}

export interface ClassificationResult {
  is_relevant: boolean;
  category: TicketCategory;
  confidence: number;
  short_title: string;
  signals: string[];
  /** Inferred assignees from @mentions or context (usernames or IDs) */
  inferred_assignees: string[];
}

export interface TicketWithMessages extends Ticket {
  messages: Message[];
}
