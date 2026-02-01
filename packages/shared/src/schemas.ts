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
});

export const TicketSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  category: TicketCategorySchema,
  status: TicketStatusSchema,
  canonical_key: z.string().nullable(),
  embedding: z.array(z.number()).nullable(),
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
  slack_team_id: z.string().nullable(),
  slack_event_id: z.string().nullable(),
  text: z.string(),
  permalink: z.string().nullable(),
  created_at: z.string(),
});

export const TicketWithMessagesSchema = TicketSchema.extend({
  messages: z.array(MessageSchema),
});
