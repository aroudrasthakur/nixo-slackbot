import OpenAI from 'openai';
import { TicketSummarySchema, type TicketSummary, type ClassificationResult } from '@nixo-slackbot/shared';
import { openaiLimiter } from './limiter';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface SummarizeInput {
  text: string;
  classification: ClassificationResult;
  reporterUsername: string | null;
  assignees: string[];
}

/** Message as used for conversation summary (text + who said it) */
export interface ConversationMessage {
  text: string;
  username: string | null;
}

interface SummarizeConversationInput {
  ticketTitle: string;
  ticketCategory: string;
  messages: ConversationMessage[];
  assignees: string[];
  reporterUsername: string | null;
}

const DEFAULT_SUMMARY: TicketSummary = {
  description: '',
  action_items: [],
  technical_details: null,
  priority_hint: 'medium',
};

/**
 * Generate an AI summary for a ticket based on the message content and classification.
 */
export async function generateTicketSummary(input: SummarizeInput): Promise<TicketSummary> {
  const { text, classification, reporterUsername, assignees } = input;

  return openaiLimiter(async () => {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a ticket summarization system. Generate a concise summary for a support ticket based on the message content.

The ticket has been classified as: ${classification.category}
Title: ${classification.short_title}
Reporter: ${reporterUsername || 'Unknown'}
Assignees: ${assignees.length > 0 ? assignees.join(', ') : 'None assigned'}

Generate a summary with:
1. description: A brief 1-2 sentence summary of what the ticket is about
2. action_items: An array of specific, actionable items that need to be done (e.g., "Fix login page crash", "Add dark mode toggle")
3. technical_details: Any relevant technical information mentioned (error codes, stack traces, file names, code snippets). Set to null if none.
4. priority_hint: Estimate priority based on severity and impact:
   - "critical": Production down, security issue, data loss
   - "high": Major feature broken, many users affected
   - "medium": Regular bug or feature request
   - "low": Minor issue, nice-to-have, cosmetic

Be concise and actionable. Extract specific technical details when present.`,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'ticket_summary',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                action_items: { type: 'array', items: { type: 'string' } },
                technical_details: { type: ['string', 'null'] },
                priority_hint: {
                  type: 'string',
                  enum: ['low', 'medium', 'high', 'critical'],
                },
              },
              required: ['description', 'action_items', 'technical_details', 'priority_hint'],
              additionalProperties: false,
            },
          },
        },
        temperature: 0.3,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      const parsed = JSON.parse(content);
      const validated = TicketSummarySchema.parse(parsed);

      return validated;
    } catch (error) {
      console.error('OpenAI summarization error:', error);
      // Return a basic summary as fallback
      return {
        ...DEFAULT_SUMMARY,
        description: classification.short_title || text.substring(0, 100),
        action_items: classification.category !== 'irrelevant' 
          ? [`Review ${classification.category.replace(/_/g, ' ')}`] 
          : [],
      };
    }
  });
}

/**
 * Generate or update a ticket summary from the full conversation (all messages).
 * Use this when a new message is added to an existing ticket.
 */
export async function generateTicketSummaryFromConversation(
  input: SummarizeConversationInput
): Promise<TicketSummary> {
  const { ticketTitle, ticketCategory, messages, assignees, reporterUsername } = input;

  const conversationText = messages
    .map((m) => `${m.username || 'Unknown'}: ${m.text}`)
    .join('\n\n');

  if (!conversationText.trim()) {
    return {
      ...DEFAULT_SUMMARY,
      description: ticketTitle,
      action_items: [],
    };
  }

  return openaiLimiter(async () => {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a ticket summarization system. Generate an updated summary for a support ticket based on the FULL conversation (all messages in the thread).

Ticket title: ${ticketTitle}
Ticket category: ${ticketCategory}
Reporter: ${reporterUsername || 'Unknown'}
Assignees: ${assignees.length > 0 ? assignees.join(', ') : 'None assigned'}

The conversation below includes all messages. Summarize the ENTIRE thread, not just the latest message.
- Incorporate any new information, follow-ups, or clarifications from later messages.
- If the latest messages add new bugs, requests, or technical details, include them in the summary.

Generate a summary with:
1. description: A brief 1-2 sentence summary of what the ticket is about (reflect the full conversation)
2. action_items: An array of specific, actionable items (fixes, feature requests, follow-ups). Merge and deduplicate from the whole thread.
3. technical_details: Any relevant technical information from any message (error codes, stack traces, file names). Set to null if none.
4. priority_hint: Re-estimate priority based on the FULL conversation. When messages have similar content but varying urgency, the ticket should reflect the HIGHEST or most recent urgency:
   - If a newer message adds urgency (e.g. "by tonight", "ASAP", "critical", "blocking"), set priority to match that higher urgency.
   - "critical": Production down, security issue, data loss
   - "high": Major feature broken, many users affected, tight deadlines ("by tonight", "urgent")
   - "medium": Regular bug or feature request
   - "low": Minor issue, nice-to-have, cosmetic
   - Do not leave priority at medium/low if a later message clearly raises the urgency.

Be concise and actionable. Reflect the complete conversation.`,
          },
          {
            role: 'user',
            content: `Conversation:\n\n${conversationText}`,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'ticket_summary',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                action_items: { type: 'array', items: { type: 'string' } },
                technical_details: { type: ['string', 'null'] },
                priority_hint: {
                  type: 'string',
                  enum: ['low', 'medium', 'high', 'critical'],
                },
              },
              required: ['description', 'action_items', 'technical_details', 'priority_hint'],
              additionalProperties: false,
            },
          },
        },
        temperature: 0.3,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      const parsed = JSON.parse(content);
      const validated = TicketSummarySchema.parse(parsed);

      return validated;
    } catch (error) {
      console.error('OpenAI conversation summarization error:', error);
      return {
        ...DEFAULT_SUMMARY,
        description: ticketTitle,
        action_items: [],
      };
    }
  });
}
