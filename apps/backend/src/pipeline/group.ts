import OpenAI from 'openai';
import type { ClassificationResult, Ticket } from '@nixo-slackbot/shared';
import {
  findTicketByRootThreadTs,
  findTicketByCanonicalKey,
  findSimilarTicket,
  findTicketByChannelAndRecentTime,
  createTicket,
  updateTicket,
  getTicket,
  findSimilarTicketsCandidates,
  type TicketCandidate,
} from '../db/tickets';
import { upsertMessage, findSimilarMessage, getMessagesByTicketId, findSimilarMessagesCandidates } from '../db/messages';
import { normalizeMessage } from './normalize';
import { openaiLimiter } from './limiter';
import { generateTicketSummary, generateTicketSummaryFromConversation } from './summarize';

const SIMILARITY_DAYS_BACK = parseInt(process.env.SIMILARITY_DAYS_BACK || '14', 10);
const SIMILARITY_THRESHOLD = parseFloat(process.env.SIMILARITY_THRESHOLD || '0.17');
// More lenient threshold for recent channel fallback (Step 3.5)
// Since we already have temporal (5 min) and channel constraints, we can be more relaxed
const RECENT_CHANNEL_THRESHOLD = parseFloat(process.env.RECENT_CHANNEL_THRESHOLD || '0.40');

// New scoring-based thresholds
const SCORE_THRESHOLD = parseFloat(process.env.SCORE_THRESHOLD || '0.75');
const RECENT_CHANNEL_SCORE_THRESHOLD = parseFloat(process.env.RECENT_CHANNEL_SCORE_THRESHOLD || '0.65');
const RECENT_WINDOW_MINUTES = parseInt(process.env.RECENT_WINDOW_MINUTES || '5', 10);
const SIMILARITY_GRAYZONE_LOW = parseFloat(process.env.SIMILARITY_GRAYZONE_LOW || '0.17');
const SIMILARITY_GRAYZONE_HIGH = parseFloat(process.env.SIMILARITY_GRAYZONE_HIGH || '0.30');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Compute cosine distance between two embeddings.
 * Returns a value between 0 (identical) and 2 (opposite).
 * Lower values mean more similar.
 */
function cosineDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have the same dimension');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const cosineSimilarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  // Cosine distance = 1 - cosine similarity
  return 1 - cosineSimilarity;
}

export interface MatchScoreBreakdown {
  semanticSim: number;
  sameCategory: boolean;
  sameChannel: boolean;
  recentUpdate: boolean;
  signalOverlap: number;
  totalScore: number;
}

export interface MatchScoreResult {
  score: number;
  breakdown: MatchScoreBreakdown;
}

/**
 * Compute a match score combining semantic similarity with structural signals.
 * Returns a score between 0 and 1, with breakdown for logging.
 */
function computeMatchScore(params: {
  distance: number;
  sameChannel: boolean;
  minutesSinceTicketUpdate: number;
  sameCategory: boolean;
  overlapCount: number;
}): MatchScoreResult {
  const { distance, sameChannel, minutesSinceTicketUpdate, sameCategory, overlapCount } = params;

  // Semantic similarity: convert distance [0..2] to similarity [0..1]
  // Clamp to ensure we don't go negative or above 1
  const semanticSim = Math.max(0, Math.min(1, 1 - (distance / 2))) * 0.60;

  let score = semanticSim;

  // Structural signals
  if (sameCategory) {
    score += 0.10;
  }
  if (sameChannel) {
    score += 0.15;
  }
  if (minutesSinceTicketUpdate <= 10) {
    score += 0.15;
  }
  if (overlapCount >= 1) {
    score += 0.10;
  }

  // Cap score at 1.0
  score = Math.min(1.0, score);

  return {
    score,
    breakdown: {
      semanticSim,
      sameCategory,
      sameChannel,
      recentUpdate: minutesSinceTicketUpdate <= 10,
      signalOverlap: overlapCount,
      totalScore: score,
    },
  };
}

/**
 * Normalize a signal to bare keyword(s) for comparison.
 * Ticket signals use prefixes (feature_export, platform_api); classifier signals are often raw (export, CSV).
 * We strip known prefixes and also split on underscore so "feature_export" matches "export".
 */
function signalToKeywords(signal: string): string[] {
  const lower = signal.toLowerCase();
  const withoutPrefix = lower.replace(/^(feature_|platform_|error_)/, '');
  return [...new Set([withoutPrefix, lower].filter(Boolean))];
}

/**
 * Compute signal overlap between message signals and ticket signals.
 * Uses both exact match and keyword overlap so "feature_export" (ticket) matches "export" (classifier).
 */
function computeSignalOverlap(messageSignals: string[], ticketSignals: string[]): number {
  const messageKeywords = new Set<string>();
  for (const s of messageSignals) {
    for (const k of signalToKeywords(s)) {
      messageKeywords.add(k);
    }
  }
  const ticketKeywords = new Set<string>();
  for (const s of ticketSignals) {
    for (const k of signalToKeywords(s)) {
      ticketKeywords.add(k);
    }
  }

  let overlap = 0;
  for (const k of messageKeywords) {
    if (ticketKeywords.has(k)) overlap++;
  }
  return overlap;
}

/**
 * Extract signals from ticket messages.
 * Returns union of all signals from recent messages (last N messages).
 */
function extractTicketSignals(messages: Array<{ text: string }>): string[] {
  const allSignals = new Set<string>();
  const recentMessages = messages.slice(-5); // Last 5 messages
  
  for (const msg of recentMessages) {
    const normalized = normalizeMessage(msg.text);
    normalized.signals.forEach((s) => allSignals.add(s));
  }
  
  return Array.from(allSignals);
}

/**
 * Apply guardrails to prevent bad merges.
 * Returns true if merge should be allowed, false if blocked.
 */
function applyGuardrails(params: {
  sameCategory: boolean;
  distance: number;
  overlapCount: number;
  sameChannel: boolean;
  minutesSinceTicketUpdate: number;
}): boolean {
  const { sameCategory, distance, overlapCount, sameChannel, minutesSinceTicketUpdate } = params;

  // Guardrail: If categories differ AND distance > 0.30, do NOT merge
  if (!sameCategory && distance > 0.30) {
    // Exception: Same channel + very recent is strong evidence. Allow merge with overlapCount >= 1.
    // (e.g. "Request to add CSV export" + "I don't see a button for it" → same issue despite feature_request vs support_question)
    if (overlapCount >= 1 && sameChannel && minutesSinceTicketUpdate <= 5) {
      return true; // Exception applies
    }
    return false; // Guardrail blocks merge
  }

  return true; // No guardrail violation
}

interface LLMMergeCheckResult {
  should_merge: boolean;
  confidence: number;
  reason: string;
}

/**
 * Perform gray-zone LLM merge check.
 * Only called when score is close to threshold or distance is in gray-zone.
 */
async function checkLLMMerge(params: {
  candidateTicket: Ticket;
  candidateMessages: Array<{ text: string; username: string | null }>;
  incomingMessage: MessageData;
  incomingClassification: ClassificationResult;
}): Promise<LLMMergeCheckResult> {
  const { candidateTicket, candidateMessages, incomingMessage, incomingClassification } = params;

  const last3Messages = candidateMessages.slice(-3).map((m) => m.text).join('\n\n');
  const ticketSummary = candidateTicket.summary?.description || candidateTicket.title;

  const prompt = `You are a ticket merge decision system. Determine if an incoming message should be merged into an existing ticket.

EXISTING TICKET:
Title: ${candidateTicket.title}
Category: ${candidateTicket.category}
Summary: ${ticketSummary}

Recent messages in ticket:
${last3Messages || '(No messages)'}

INCOMING MESSAGE:
Title: ${incomingClassification.short_title}
Category: ${incomingClassification.category}
Signals: ${incomingClassification.signals.join(', ')}
Text: ${incomingMessage.text}

CRITICAL: Merge ONLY if this is the SAME underlying issue, not just the same broad topic.
- Same issue: Same bug, same feature request, same support question about the same problem
- Different issue: Different bugs (even if similar), different features, different problems

Examples:
- "Login button broken" + "Login button still broken" → MERGE (same issue)
- "Login button broken" + "Signup form broken" → DO NOT MERGE (different issues, even if both are auth-related)
- "Add CSV export" + "I don't see CSV export button" → MERGE (same feature request)
- "Add CSV export" + "Add PDF export" → DO NOT MERGE (different features)

Return your decision with confidence and reason.`;

  try {
    const completion = await openaiLimiter(async () => {
      return await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a ticket merge decision system. Analyze whether two messages refer to the same underlying issue.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'merge_check_result',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                should_merge: { type: 'boolean' },
                confidence: { type: 'number', minimum: 0, maximum: 1 },
                reason: { type: 'string' },
              },
              required: ['should_merge', 'confidence', 'reason'],
              additionalProperties: false,
            },
          },
        },
        temperature: 0.3,
      });
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    const parsed = JSON.parse(content);
    return {
      should_merge: parsed.should_merge === true,
      confidence: parseFloat(parsed.confidence) || 0,
      reason: parsed.reason || '',
    };
  } catch (error) {
    console.error('[Group] LLM merge check error:', error);
    // On error, default to not merging (safer)
    return {
      should_merge: false,
      confidence: 0,
      reason: 'LLM check failed',
    };
  }
}

/**
 * Check if a candidate is in the gray-zone for LLM merge check.
 */
function isGrayZone(score: number, threshold: number, distance: number): boolean {
  // Score is within ±0.05 of threshold
  if (Math.abs(score - threshold) <= 0.05) {
    return true;
  }
  
  // Distance is in gray-zone range AND score is close to threshold
  if (distance >= SIMILARITY_GRAYZONE_LOW && distance <= SIMILARITY_GRAYZONE_HIGH) {
    if (Math.abs(score - threshold) <= 0.10) {
      return true;
    }
  }
  
  return false;
}

export interface MessageData {
  slack_channel_id: string;
  slack_ts: string;
  root_thread_ts: string;
  slack_user_id: string;
  slack_username?: string | null;
  slack_team_id?: string | null;
  slack_event_id?: string | null;
  text: string;
  permalink?: string | null;
}

/**
 * Refresh ticket summary and optionally merge assignees when a new message is attached.
 */
async function refreshTicketSummary(
  ticketId: string,
  latestClassification: ClassificationResult,
  latestMessage: MessageData
): Promise<void> {
  try {
    const ticket = await getTicket(ticketId);
    if (!ticket || !ticket.messages.length) return;

    const messages = ticket.messages.map((m) => ({
      text: m.text,
      username: m.slack_username || null,
    }));

    const existingAssignees = ticket.assignees || [];
    const newInferred = latestClassification.inferred_assignees || [];
    const mergedAssignees = [...new Set([...existingAssignees, ...newInferred])];

    console.log('[Group] Refreshing summary for ticket:', ticketId, 'messages:', messages.length);

    const summary = await generateTicketSummaryFromConversation({
      ticketTitle: ticket.title,
      ticketCategory: ticket.category,
      messages,
      assignees: mergedAssignees,
      reporterUsername: ticket.reporter_username || null,
    });

    await updateTicket(ticketId, {
      summary,
      assignees: mergedAssignees,
    });

    console.log('[Group] Summary updated for ticket:', ticketId);
  } catch (error) {
    console.error('[Group] Error refreshing ticket summary:', error);
  }
}

export interface GroupOptions {
  is_fde?: boolean;
}

export async function groupMessage(
  messageData: MessageData,
  classification: ClassificationResult,
  options?: GroupOptions
): Promise<string | null> {
  const isFde = options?.is_fde ?? false;
  // Step 1: Check thread grouping
  console.log('[Group] Step 1: Checking thread grouping for root_thread_ts:', messageData.root_thread_ts);
  const threadTicket = await findTicketByRootThreadTs(messageData.root_thread_ts);
  if (threadTicket) {
    console.log('[Group] Found existing ticket via thread:', threadTicket.id, isFde ? '(FDE adding context)' : '');
    await upsertMessage({
      ...messageData,
      ticket_id: threadTicket.id,
    });
    await refreshTicketSummary(threadTicket.id, classification, messageData);
    return threadTicket.id;
  }

  // Step 2: Compute canonical_key and check for match
  console.log('[Group] Step 2: Computing canonical key...');
  const normalized = normalizeMessage(messageData.text);
  const canonicalKey = normalized.signals.length > 0
    ? normalized.signals.join('_')
    : normalized.normalizedText
        .substring(0, 50)
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

  console.log('[Group] Canonical key:', canonicalKey);

  if (canonicalKey) {
    const canonicalTicket = await findTicketByCanonicalKey(canonicalKey);
    if (canonicalTicket) {
      console.log('[Group] Found existing ticket via canonical key:', canonicalTicket.id, isFde ? '(FDE adding context)' : '');
      await upsertMessage({
        ...messageData,
        ticket_id: canonicalTicket.id,
      });
      await refreshTicketSummary(canonicalTicket.id, classification, messageData);
      return canonicalTicket.id;
    }
  }

  // Step 3: Semantic matching via vector DB with scored matching
  console.log('[Group] Step 3: Computing embedding for semantic similarity...');
  // Enhanced embedding text: include category, short_title, signals, and original message
  const signalsText = classification.signals.length > 0 
    ? classification.signals.join(' ')
    : '';
  const textToEmbed = `${classification.category}: ${classification.short_title}\nSignals: ${signalsText}\nMessage: ${messageData.text}`.substring(0, 2000);
  const embedding = await openaiLimiter(async () => {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: textToEmbed,
    });
    return response.data[0].embedding;
  });

  console.log('[Group] Searching for similar tickets (by ticket embedding)...');
  const similarTicket = await findSimilarTicket(embedding, SIMILARITY_DAYS_BACK, SIMILARITY_THRESHOLD);
  console.log('[Group] Searching for similar messages (by message content)...');
  const similarMessage = await findSimilarMessage(embedding, SIMILARITY_DAYS_BACK, SIMILARITY_THRESHOLD);

  const best = (() => {
    if (similarTicket && similarMessage) {
      return similarTicket.distance <= similarMessage.distance ? similarTicket : similarMessage;
    }
    return similarTicket ?? similarMessage ?? null;
  })();

  if (best) {
    const source = best === similarTicket ? 'ticket' : 'message';
    console.log('[Group] Found similar ticket via', source, 'match:', best.ticketId, 'distance:', best.distance, isFde ? '(FDE adding context)' : '');
    await upsertMessage({
      ...messageData,
      ticket_id: best.ticketId,
      embedding,
    });
    await refreshTicketSummary(best.ticketId, classification, messageData);
    return best.ticketId;
  }

  // Step 3.5: Fallback - check for recent tickets in the same channel with scored matching
  // This catches sequential messages in the same channel that aren't in a thread
  console.log('[Group] Step 3.5: Checking for recent tickets in the same channel...');
  const recentChannelTicket = await findTicketByChannelAndRecentTime(
    messageData.slack_channel_id,
    RECENT_WINDOW_MINUTES
  );
  
  if (recentChannelTicket) {
    // Fetch full ticket with messages
    const ticket = await getTicket(recentChannelTicket.id);
    if (!ticket) {
      console.log('[Group] Recent ticket not found, proceeding to Step 4');
    } else {
      // Check if ticket has embedding for semantic comparison
      const ticketEmb = ticket.embedding;
      const sameDimension =
        Array.isArray(ticketEmb) &&
        Array.isArray(embedding) &&
        ticketEmb.length === embedding.length;

      if (ticketEmb && embedding && sameDimension) {
        // Compute distance
        const distance = cosineDistance(embedding, ticketEmb);
        console.log('[Group] Recent ticket found, computing score...');

        // Compute signal overlap
        const ticketSignals = extractTicketSignals(ticket.messages);
        const overlapCount = computeSignalOverlap(classification.signals, ticketSignals);

        // Compute time difference
        const ticketUpdatedAt = new Date(ticket.updated_at);
        const now = new Date();
        const minutesSinceUpdate = Math.floor((now.getTime() - ticketUpdatedAt.getTime()) / (1000 * 60));

        // Same channel (always true for Step 3.5)
        const sameChannel = true;

        // Check if same category
        const sameCategory = ticket.category === classification.category;

        // Apply guardrails
        const guardrailPassed = applyGuardrails({
          sameCategory,
          distance,
          overlapCount,
          sameChannel,
          minutesSinceTicketUpdate: minutesSinceUpdate,
        });

        if (!guardrailPassed) {
          console.log(`[Group] Recent ticket blocked by guardrails (category: ${ticket.category} vs ${classification.category}, distance: ${distance.toFixed(4)})`);
        } else {
          // Compute match score
          const scoreResult = computeMatchScore({
            distance,
            sameChannel,
            minutesSinceTicketUpdate: minutesSinceUpdate,
            sameCategory,
            overlapCount,
          });

          console.log(`[Group] Recent ticket score: ${scoreResult.score.toFixed(3)}, threshold: ${RECENT_CHANNEL_SCORE_THRESHOLD}, breakdown:`, scoreResult.breakdown);

          // Check if score meets threshold
          if (scoreResult.score >= RECENT_CHANNEL_SCORE_THRESHOLD) {
            console.log('[Group] Recent ticket score meets threshold, merging message', ticket.id, isFde ? '(FDE adding context)' : '');
            await upsertMessage({
              ...messageData,
              ticket_id: ticket.id,
              embedding,
            });
            await refreshTicketSummary(ticket.id, classification, messageData);
            return ticket.id;
          }

          // Check gray-zone for LLM merge check
          if (isGrayZone(scoreResult.score, RECENT_CHANNEL_SCORE_THRESHOLD, distance)) {
            console.log('[Group] Recent ticket score in gray-zone, performing LLM merge check...');
            const llmResult = await checkLLMMerge({
              candidateTicket: ticket,
              candidateMessages: ticket.messages.map((m) => ({
                text: m.text,
                username: m.slack_username,
              })),
              incomingMessage: messageData,
              incomingClassification: classification,
            });

            console.log(`[Group] LLM merge check: should_merge=${llmResult.should_merge}, confidence=${llmResult.confidence.toFixed(3)}, reason="${llmResult.reason}"`);

            if (llmResult.should_merge && llmResult.confidence >= 0.7) {
              console.log('[Group] LLM check approved merge for recent ticket', ticket.id, isFde ? '(FDE adding context)' : '');
              await upsertMessage({
                ...messageData,
                ticket_id: ticket.id,
                embedding,
              });
              await refreshTicketSummary(ticket.id, classification, messageData);
              return ticket.id;
            } else {
              console.log('[Group] LLM check did not approve merge for recent ticket, proceeding to Step 4');
            }
          } else {
            console.log('[Group] Recent ticket score below threshold and not in gray-zone, proceeding to Step 4');
          }
        }
      } else if (ticketEmb && embedding && !sameDimension) {
        console.warn(
          `[Group] Recent ticket embedding dimension mismatch (ticket: ${ticketEmb?.length ?? 0}, message: ${embedding.length}) - creating new ticket`
        );
      } else {
        // If ticket has no embedding, skip semantic check (attach anyway for backward compatibility)
        // This handles tickets created before embeddings were added
        console.log('[Group] Found recent ticket in same channel (no embedding to compare):', ticket.id, isFde ? '(FDE adding context)' : '');
        await upsertMessage({
          ...messageData,
          ticket_id: ticket.id,
          embedding,
        });
        await refreshTicketSummary(ticket.id, classification, messageData);
        return ticket.id;
      }
    }
  }

  // Step 4: Create new ticket with summary and assignees
  // FDE messages cannot create new tickets, only add context to existing ones
  if (isFde) {
    console.log('[Group] ⚠️ FDE message cannot create new ticket - no existing ticket to attach to');
    return null;
  }

  console.log('[Group] Step 4: Creating new ticket...');
  
  // Get assignees from classification (inferred from @mentions etc.)
  const assignees = classification.inferred_assignees || [];
  console.log('[Group] Inferred assignees:', assignees);

  // Generate AI summary
  console.log('[Group] Generating ticket summary...');
  const summary = await generateTicketSummary({
    text: messageData.text,
    classification,
    reporterUsername: messageData.slack_username || null,
    assignees,
  });
  console.log('[Group] Summary generated:', summary.description);

  const ticket = await createTicket({
    title: classification.short_title || messageData.text.substring(0, 100),
    category: classification.category === 'irrelevant' ? 'support_question' : classification.category,
    canonical_key: canonicalKey || null,
    embedding,
    assignees,
    reporter_user_id: messageData.slack_user_id,
    reporter_username: messageData.slack_username || null,
    summary,
  });

  console.log('[Group] Created new ticket:', ticket.id, 'title:', ticket.title);

  const message = await upsertMessage({
    ...messageData,
    ticket_id: ticket.id,
    embedding,
  });

  if (message.ticket_id !== ticket.id) {
    console.error('[Group] BUG: Creating message was stored with wrong ticket_id:', {
      expected: ticket.id,
      got: message.ticket_id,
      messageId: message.id,
    });
  }
  console.log('[Group] Attached creating message to ticket:', message.id, 'ticket_id:', message.ticket_id);

  return ticket.id;
}
