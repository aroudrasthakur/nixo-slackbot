import OpenAI from 'openai';
import { ClassificationResultSchema, type ClassificationResult } from '@nixo-slackbot/shared';
import { classificationCache } from './cache';
import { openaiLimiter } from './limiter';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DEFAULT_RESULT: ClassificationResult = {
  is_relevant: false,
  category: 'irrelevant',
  confidence: 0,
  short_title: '',
  signals: [],
  inferred_assignees: [],
};

export interface ThreadContext {
  messages: Array<{ text: string; user: string }>;
}

export interface ChannelContext {
  messages: Array<{ text: string; user: string }>;
}

/**
 * Build the user prompt with appropriate context formatting.
 */
function buildUserPrompt(
  text: string,
  threadContext?: ThreadContext,
  channelContext?: ChannelContext
): string {
  // Thread context takes priority (direct reply in a thread)
  if (threadContext && threadContext.messages.length > 0) {
    return `THREAD CONTEXT (this message is a reply in a thread):\n${threadContext.messages
      .map((m, i) => `[${i + 1}] ${m.text}`)
      .join('\n')}\n\nCURRENT MESSAGE TO CLASSIFY:\n${text}`;
  }

  // Channel context for non-thread messages
  if (channelContext && channelContext.messages.length > 0) {
    return `CHANNEL CONTEXT (recent messages in the same channel, NOT a thread - look for indirect references):\n${channelContext.messages
      .map((m, i) => `[${i + 1}] ${m.text}`)
      .join('\n')}\n\nCURRENT MESSAGE TO CLASSIFY:\n${text}`;
  }

  // No context available
  return text;
}

export async function classifyMessage(
  text: string,
  normalizedText: string,
  threadContext?: ThreadContext,
  channelContext?: ChannelContext
): Promise<ClassificationResult> {
  // Check cache first (but only if no context, since context changes relevance)
  const hasContext =
    (threadContext && threadContext.messages.length > 0) ||
    (channelContext && channelContext.messages.length > 0);
  if (!hasContext) {
    const cached = classificationCache.get(normalizedText);
    if (cached) {
      return cached;
    }
  }

  // Use concurrency limiter
  const result = await openaiLimiter(async () => {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a ticket classification system for a support platform. Classify Slack messages to determine if they should become support tickets.

CRITICAL: Use context when provided. You may receive TWO types of context:
1. THREAD CONTEXT: Previous messages in a Slack thread (the current message is a direct reply)
2. CHANNEL CONTEXT: Recent messages in the same channel (the current message is NOT in a thread, but may reference recent discussion)

A message that seems irrelevant in isolation (e.g., "I cannot see a button for it") can be RELEVANT if:
- It's a follow-up in a thread to a previous request/question
- It references something from recent channel messages (e.g., "it" refers to a feature mentioned earlier)

RELEVANT messages include:
- Bug reports: Errors, crashes, broken features, unexpected behavior (e.g., "The login button doesn't work on mobile")
- Support questions: How-to questions, troubleshooting requests, configuration issues
- Feature requests: Suggestions for new functionality or improvements (e.g., "Can you add export to CSV?")
- Product questions: Questions about product capabilities, limitations, or usage
- Follow-up messages: Short clarifications, additional details, or confirmations that reference a previous request/question
- Indirect references: Messages using pronouns like "it", "that", "this" that refer to a feature, bug, or issue mentioned in context

IRRELEVANT messages include:
- Casual conversation: greetings, thanks, small talk, off-topic chat
- Simple acknowledgments: "ok", "got it", "thanks", "sure" (standalone, not in response to a relevant question)
- Social messages: lunch plans, personal updates unrelated to work
- Empty or very short messages with no substance AND no relevant context

Guidelines:
- When THREAD CONTEXT is provided, the current message is a direct reply. Consider the full thread conversation.
- When CHANNEL CONTEXT is provided (recent channel messages), look for INDIRECT REFERENCES:
  * Pronouns like "it", "that", "this", "the button", "the feature" may refer to something in recent messages
  * A short message may be a follow-up to a recent discussion even without explicit threading
  * Look for continuity: is this message continuing a relevant conversation from the last few messages?
- When in doubt, mark as RELEVANT if the message describes a problem, asks a question, requests something, OR provides context/clarification
- Be lenient: if a message could be a support request (even if unclear), mark it as relevant
- Only mark as irrelevant if the message is clearly casual conversation or acknowledgment with no actionable content AND no relevant context connection

Return a structured response with:
- is_relevant: true if the message should become a ticket, false if it's casual/irrelevant
- category: bug_report, support_question, feature_request, product_question, or irrelevant
- confidence: 0.0 to 1.0
- short_title: A SPECIFIC, DESCRIPTIVE title (max 100 chars) summarizing what this is about.
  CRITICAL: When context is provided, the short_title MUST incorporate the relevant topic from context.
  - BAD: "User cannot find button for a feature" (too generic)
  - GOOD: "User cannot find CSV export button" (specific, uses context)
  - BAD: "Problem with login" (generic)
  - GOOD: "SSO login fails after password reset" (specific)
  The short_title is used for ticket grouping, so vague titles prevent related messages from being grouped together.
- signals: Array of SPECIFIC keywords extracted from BOTH the message AND context. Include:
  * Feature names (e.g., "export", "CSV", "login", "dashboard")
  * Error codes or identifiers
  * Platform/component names
  * The topic being discussed (e.g., if context mentions "CSV export" and message says "I don't see a button", signals should include "export", "CSV", "button")
- inferred_assignees: Array of usernames or @mentions found in the message that could be assignees (people who should work on this). Look for @mentions, "assigned to X", "X should fix this", "cc @Y", etc. If no assignees are mentioned, return an empty array.`,
          },
          {
            role: 'user',
            content: buildUserPrompt(text, threadContext, channelContext),
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'classification_result',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                is_relevant: { type: 'boolean' },
                category: {
                  type: 'string',
                  enum: ['bug_report', 'support_question', 'feature_request', 'product_question', 'irrelevant'],
                },
                confidence: { type: 'number', minimum: 0, maximum: 1 },
                short_title: { type: 'string' },
                signals: { type: 'array', items: { type: 'string' } },
                inferred_assignees: { type: 'array', items: { type: 'string' } },
              },
              required: ['is_relevant', 'category', 'confidence', 'short_title', 'signals', 'inferred_assignees'],
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
      const validated = ClassificationResultSchema.parse(parsed);

      // Cache for 1 hour (only if no context, since context affects relevance)
      if (!hasContext) {
        classificationCache.set(normalizedText, validated, 60 * 60 * 1000);
      }

      return validated;
    } catch (error) {
      console.error('OpenAI classification error:', error);
      // Fall back to irrelevant with low confidence
      const fallback: ClassificationResult = {
        ...DEFAULT_RESULT,
        short_title: text.substring(0, 50),
      };
      return fallback;
    }
  });

  return result;
}
