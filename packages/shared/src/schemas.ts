import { z } from 'zod';

export const TicketCategorySchema = z.enum([
  'bug_report',
  'support_question',
  'feature_request',
  'product_question',
  'irrelevant',
]);

export const TicketStatusSchema = z.enum(['open', 'closed', 'resolved']);

export const ClassificationResultSchema = z.object({
  is_relevant: z.boolean(),
  category: TicketCategorySchema,
  confidence: z.number().min(0).max(1),
  short_title: z.string(),
  signals: z.array(z.string()),
  inferred_assignees: z.array(z.string()),
});

export const TicketSummarySchema = z.object({
  description: z.string(),
  action_items: z.array(z.string()),
  technical_details: z.string().nullable(),
  priority_hint: z.enum(['low', 'medium', 'high', 'critical']),
});

export const TicketSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  category: TicketCategorySchema,
  status: TicketStatusSchema,
  canonical_key: z.string().nullable(),
  embedding: z.array(z.number()).nullable(),
  summary_embedding: z.array(z.number()).nullable(),
  assignees: z.array(z.string()),
  reporter_user_id: z.string().nullable(),
  reporter_username: z.string().nullable(),
  summary: TicketSummarySchema.nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const MessageSchema = z.object({
  id: z.string().uuid(),
  ticket_id: z.string().uuid(),
  slack_channel_id: z.string(),
  slack_ts: z.string(),
  root_thread_ts: z.string(), // Not null
  slack_user_id: z.string(),
  slack_username: z.string().nullable(),
  slack_team_id: z.string().nullable(),
  slack_event_id: z.string().nullable(),
  text: z.string(),
  permalink: z.string().nullable(),
  created_at: z.string(),
  slack_channel_name: z.string().nullable().optional(),
  slack_workspace_name: z.string().nullable().optional(),
  is_redundant: z.boolean().optional(),
  redundant_of_message_id: z.string().uuid().nullable().optional(),
  intent_key: z.string().nullable().optional(),
  intent_object: z.string().nullable().optional(),
  intent_action: z.string().nullable().optional(),
  intent_value: z.string().nullable().optional(),
});

export const TicketWithMessagesSchema = TicketSchema.extend({
  messages: z.array(MessageSchema),
});
