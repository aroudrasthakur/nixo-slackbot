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
};

export async function classifyMessage(
  text: string,
  normalizedText: string
): Promise<ClassificationResult> {
  // Check cache first
  const cached = classificationCache.get(normalizedText);
  if (cached) {
    return cached;
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

RELEVANT messages include:
- Bug reports: Errors, crashes, broken features, unexpected behavior
- Support questions: How-to questions, troubleshooting requests, configuration issues
- Feature requests: Suggestions for new functionality or improvements
- Product questions: Questions about product capabilities, limitations, or usage

IRRELEVANT messages include:
- Casual conversation: greetings, thanks, small talk, off-topic chat
- Simple acknowledgments: "ok", "got it", "thanks", "sure"
- Social messages: lunch plans, personal updates unrelated to work
- Empty or very short messages with no substance

Guidelines:
- When in doubt, mark as RELEVANT if the message describes a problem, asks a question, or requests something
- Be lenient: if a message could be a support request (even if unclear), mark it as relevant
- Only mark as irrelevant if the message is clearly casual conversation or acknowledgment with no actionable content

Return a structured response with:
- is_relevant: true if the message should become a ticket, false if it's casual/irrelevant
- category: bug_report, support_question, feature_request, product_question, or irrelevant
- confidence: 0.0 to 1.0
- short_title: A concise title (max 100 chars) summarizing the issue/question
- signals: Array of extracted keywords (error codes, platform names, feature names)`,
          },
          {
            role: 'user',
            content: text,
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
              },
              required: ['is_relevant', 'category', 'confidence', 'short_title', 'signals'],
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

      // Cache for 1 hour
      classificationCache.set(normalizedText, validated, 60 * 60 * 1000);

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
