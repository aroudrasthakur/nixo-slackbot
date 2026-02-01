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
  findCrossChannelTicketCandidates,
  type TicketCandidate,
} from '../db/tickets';
import { upsertMessage, findSimilarMessage, getMessagesByTicketId, findSimilarMessagesCandidates, findCrossChannelMessageCandidates } from '../db/messages';
import { normalizeMessage, computeCanonicalKey } from './normalize';
import { openaiLimiter } from './limiter';
import { generateTicketSummary, generateTicketSummaryFromConversation } from './summarize';
import { emitTicketUpdated } from '../socket/events';

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

// Cross-Channel Context Retrieval (CCR) configuration
const CROSS_CHANNEL_DAYS = parseInt(process.env.CROSS_CHANNEL_DAYS || '14', 10);
const MATCH_TOPK_TICKETS = parseInt(process.env.MATCH_TOPK_TICKETS || '15', 10);
const MATCH_TOPK_MESSAGES = parseInt(process.env.MATCH_TOPK_MESSAGES || '25', 10);

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

/**
 * Check if two ticket categories are compatible.
 * Compatible categories commonly represent the same underlying issue.
 * Returns compatibility information for scoring and guardrails.
 */
function isCategoryCompatible(
  categoryA: string,
  categoryB: string
): { compatible: boolean; isSometimesCompatible: boolean } {
  // Same category is always compatible
  if (categoryA === categoryB) {
    return { compatible: true, isSometimesCompatible: false };
  }

  // Always compatible pairs
  const alwaysCompatiblePairs = [
    ['support_question', 'product_question'],
    ['support_question', 'feature_request'],
    ['product_question', 'feature_request'],
  ];

  for (const [a, b] of alwaysCompatiblePairs) {
    if (
      (categoryA === a && categoryB === b) ||
      (categoryA === b && categoryB === a)
    ) {
      return { compatible: true, isSometimesCompatible: false };
    }
  }

  // Sometimes compatible pairs (compatible but may apply penalty)
  const sometimesCompatiblePairs = [
    ['support_question', 'bug_report'],
    ['product_question', 'bug_report'],
  ];

  for (const [a, b] of sometimesCompatiblePairs) {
    if (
      (categoryA === a && categoryB === b) ||
      (categoryA === b && categoryB === a)
    ) {
      return { compatible: true, isSometimesCompatible: true };
    }
  }

  // Incompatible by default (bug_report ↔ feature_request)
  // Can still merge with strong evidence (handled in guardrails)
  return { compatible: false, isSometimesCompatible: false };
}

export interface MatchScoreBreakdown {
  semanticSim: number;
  sameCategory: boolean;
  categoryMatch: 'same' | 'compatible' | 'sometimes_compatible' | 'incompatible';
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
  categoryCompatibility: { compatible: boolean; isSometimesCompatible: boolean };
  sameCategory: boolean;
  overlapCount: number;
}): MatchScoreResult {
  const { distance, sameChannel, minutesSinceTicketUpdate, categoryCompatibility, sameCategory, overlapCount } = params;

  // Semantic similarity: convert distance [0..2] to similarity [0..1]
  // Clamp to ensure we don't go negative or above 1
  const semanticSim = Math.max(0, Math.min(1, 1 - (distance / 2))) * 0.60;

  let score = semanticSim;

  // Category signal (soft, not hard blocker)
  let categoryMatch: 'same' | 'compatible' | 'sometimes_compatible' | 'incompatible';
  if (sameCategory) {
    score += 0.10;
    categoryMatch = 'same';
  } else if (categoryCompatibility.compatible && !categoryCompatibility.isSometimesCompatible) {
    score += 0.05; // Compatible categories
    categoryMatch = 'compatible';
  } else if (categoryCompatibility.isSometimesCompatible) {
    score += 0.02; // Sometimes compatible (small positive)
    categoryMatch = 'sometimes_compatible';
  } else {
    score -= 0.10; // Incompatible (penalty, not block)
    categoryMatch = 'incompatible';
  }

  // Structural signals
  if (sameChannel) {
    score += 0.15;
  }
  if (minutesSinceTicketUpdate <= 10) {
    score += 0.15;
  }
  if (overlapCount >= 1) {
    score += 0.10;
  }

  // Cap score at 1.0, but allow negative scores (they'll fail threshold anyway)
  score = Math.min(1.0, score);

  return {
    score,
    breakdown: {
      semanticSim,
      sameCategory,
      categoryMatch,
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
 * Guardrails are evidence-based, not category-based. Categories are soft signals.
 */
function applyGuardrails(params: {
  categoryCompatible: boolean;
  isSometimesCompatible: boolean;
  distance: number;
  overlapCount: number;
  sameChannel: boolean;
  minutesSinceTicketUpdate: number;
  sameThread: boolean;
}): boolean {
  const {
    categoryCompatible,
    distance,
    overlapCount,
    sameChannel,
    minutesSinceTicketUpdate,
    sameThread,
  } = params;

  // Strong evidence overrides incompatibility (even if categories are incompatible)
  if (sameThread) {
    return true; // Same thread is strongest evidence
  }
  if (overlapCount >= 2 && distance <= 0.30) {
    return true; // High overlap + low distance
  }
  if (sameChannel && minutesSinceTicketUpdate <= RECENT_WINDOW_MINUTES && distance <= 0.30) {
    return true; // Same channel + recent + low distance
  }

  // Block only if: NOT compatible AND distance > 0.35 AND overlapCount == 0 AND NOT sameThread AND NOT (sameChannel AND recent)
  if (
    !categoryCompatible &&
    distance > 0.35 &&
    overlapCount === 0 &&
    !sameThread &&
    !(sameChannel && minutesSinceTicketUpdate <= RECENT_WINDOW_MINUTES)
  ) {
    return false; // Guardrail blocks merge
  }

  return true; // Allow merge (score threshold will determine final decision)
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
 * Triggers more often when categories differ to avoid false splits.
 */
function isGrayZone(
  score: number,
  threshold: number,
  distance: number,
  sameCategory: boolean
): boolean {
  // Score is within ±0.05 of threshold
  if (Math.abs(score - threshold) <= 0.05) {
    return true;
  }

  // If categories differ, use wider window (±0.08) to trigger LLM check more often
  if (!sameCategory) {
    if (Math.abs(score - threshold) <= 0.08) {
      return true;
    }
  }

  // Distance is in gray-zone range AND score is close to threshold
  if (distance >= SIMILARITY_GRAYZONE_LOW && distance <= SIMILARITY_GRAYZONE_HIGH) {
    if (Math.abs(score - threshold) <= 0.10) {
      return true;
    }
  }

  return false;
}

/**
 * Compute CCR (Cross-Channel Context Retrieval) match score.
 * Uses different weighting than Step 3.5: semanticSim*0.55 + category + overlap + recency bonuses.
 */
function computeCCRMatchScore(params: {
  distance: number;
  sameCategory: boolean;
  categoryCompatibility: { compatible: boolean; isSometimesCompatible: boolean };
  overlapCount: number;
  updatedAt: string; // ISO timestamp
}): MatchScoreResult {
  const { distance, sameCategory, categoryCompatibility, overlapCount, updatedAt } = params;

  // Base semantic similarity score (clamped to [0, 1])
  const semanticSim = Math.max(0, Math.min(1, 1 - distance / 2));
  let score = semanticSim * 0.55;

  // Category bonuses
  if (sameCategory) {
    score += 0.10;
  } else if (categoryCompatibility.compatible) {
    score += 0.05;
  }

  // Signal overlap bonuses
  if (overlapCount >= 1) {
    score += 0.10;
  }
  if (overlapCount >= 2) {
    score += 0.10; // Extra bonus for high overlap
  }

  // Recency bonus (soft boost if updated within 24h)
  const updatedTime = new Date(updatedAt).getTime();
  const now = Date.now();
  const hoursSinceUpdate = (now - updatedTime) / (1000 * 60 * 60);
  if (hoursSinceUpdate <= 24) {
    score += 0.05;
  }

  // Clamp to [0, 1]
  score = Math.max(0, Math.min(1, score));

  return {
    score,
    breakdown: {
      semanticSim,
      sameCategory,
      categoryMatch: sameCategory ? 'same' : (categoryCompatibility.compatible ? 'compatible' : (categoryCompatibility.isSometimesCompatible ? 'sometimes_compatible' : 'incompatible')),
      sameChannel: false, // CCR is cross-channel
      recentUpdate: hoursSinceUpdate <= 24,
      signalOverlap: overlapCount,
      totalScore: score,
    },
  };
}

/**
 * Evidence-based guardrails for CCR.
 * Uses rare token list to prevent over-merging for broad topic matches with weak evidence.
 */
function applyCCRGuardrails(params: {
  distance: number;
  overlapCount: number;
  messageSignals: string[];
  ticketSignals: string[];
}): boolean {
  const { distance, overlapCount, messageSignals, ticketSignals } = params;

  // Rare token list: specific terms that indicate strong evidence
  const RARE_TOKENS = new Set([
    'budget', 'csv', 'export', 'rbac', 'admin', 'superadmin', '403', '401', '500',
    'invoice', 'oauth', 'sso', 'dashboard', 'analytics', 'pdf', 'report'
  ]);

  // Check if any rare tokens are shared
  const messageTokens = new Set(messageSignals.map(s => s.toLowerCase()));
  const ticketTokens = new Set(ticketSignals.map(s => s.toLowerCase()));
  let hasRareTokenOverlap = false;
  for (const token of RARE_TOKENS) {
    if (messageTokens.has(token) && ticketTokens.has(token)) {
      hasRareTokenOverlap = true;
      break;
    }
  }

  // Block merge only when:
  // - No signal overlap AND
  // - High distance (> 0.35) AND
  // - No rare token overlap AND
  // - NOT (high overlap + low distance)
  if (
    overlapCount === 0 &&
    distance > 0.35 &&
    !hasRareTokenOverlap &&
    !(overlapCount >= 2 && distance <= 0.45)
  ) {
    return false; // Block merge
  }

  // Allow merge when:
  // - At least one rare token shared OR
  // - High overlap (>= 2) OR
  // - Strong semantic similarity (distance <= 0.30)
  if (hasRareTokenOverlap || overlapCount >= 2 || distance <= 0.30) {
    return true; // Allow merge
  }

  return true; // Default: allow (score threshold will determine final decision)
}

/**
 * Check if CCR candidate is in gray-zone for LLM merge check.
 */
function isCCRGrayZone(score: number, threshold: number, distance: number, overlapCount: number): boolean {
  // Trigger LLM check if:
  // - Score within 0.08 below threshold OR
  // - Distance in [0.25, 0.55] AND overlapCount >= 1
  return (
    (score >= threshold - 0.08 && score < threshold) ||
    (distance >= 0.25 && distance <= 0.55 && overlapCount >= 1)
  );
}

/**
 * Perform gray-zone LLM merge check for CCR.
 */
async function checkCCRLLMMerge(params: {
  candidateTicket: Ticket;
  candidateMessages: Array<{ text: string; username: string | null }>;
  incomingMessage: MessageData;
  incomingClassification: ClassificationResult;
}): Promise<LLMMergeCheckResult> {
  const { candidateTicket, candidateMessages, incomingMessage, incomingClassification } = params;

  const last5Messages = candidateMessages.slice(-5).map((m) => `${m.username || 'User'}: ${m.text}`).join('\n\n');
  const ticketSummary = candidateTicket.summary?.description || candidateTicket.title;
  const ticketChannelId = candidateMessages.length > 0 ? (candidateMessages[0] as any).slack_channel_id || 'unknown' : 'unknown';

  const prompt = `You are a cross-channel ticket merge decision system. Determine if an incoming message from a DIFFERENT channel should be merged into an existing ticket.

EXISTING TICKET (from different channel):
Title: ${candidateTicket.title}
Category: ${candidateTicket.category}
Summary: ${ticketSummary}
Channel: ${ticketChannelId}

Recent messages in ticket:
${last5Messages || '(No messages)'}

INCOMING MESSAGE (from current channel):
Title: ${incomingClassification.short_title}
Category: ${incomingClassification.category}
Signals: ${incomingClassification.signals.join(', ')}
Text: ${incomingMessage.text}
Channel: ${incomingMessage.slack_channel_id}

CRITICAL: This is a CROSS-CHANNEL merge decision. Be more conservative than same-channel merges.
- Merge ONLY if this is clearly the SAME underlying issue across channels
- Different channels often mean different contexts, so require stronger evidence
- Same issue: Same bug reported in different channels, same feature request mentioned elsewhere
- Different issue: Similar topics but different problems, different features, different contexts

Examples:
- "CSV export broken" (channel A) + "CSV export still broken" (channel B) → MERGE (same issue, cross-channel)
- "Add CSV export" (channel A) + "I don't see CSV export button" (channel B) → MERGE (same feature, cross-channel)
- "Login broken" (channel A) + "Signup broken" (channel B) → DO NOT MERGE (different issues, even if both auth-related)

Return your decision with confidence and reason.`;

  try {
    const completion = await openaiLimiter(async () => {
      return await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a cross-channel ticket merge decision system. Analyze whether messages from different channels refer to the same underlying issue.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'ccr_merge_check',
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
        temperature: 0.2,
      });
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    const parsed = JSON.parse(content);
    return {
      should_merge: parsed.should_merge === true,
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0)),
      reason: parsed.reason || 'No reason provided',
    };
  } catch (error) {
    console.error('[Group] Error in CCR LLM merge check:', error);
    // Conservative fallback: don't merge on error
    return {
      should_merge: false,
      confidence: 0,
      reason: `Error during LLM check: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
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
 * Get category precedence for escalation.
 * Higher precedence categories are more urgent/actionable.
 */
function getCategoryPrecedence(category: string): number {
  const precedence: Record<string, number> = {
    bug_report: 4,
    feature_request: 3,
    support_question: 2,
    product_question: 1,
    irrelevant: 0,
  };
  return precedence[category] || 0;
}

/**
 * Refresh ticket summary and optionally merge assignees when a new message is attached.
 * Also escalates ticket category if new message has higher precedence.
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

    // Check if category should be escalated
    const currentPrecedence = getCategoryPrecedence(ticket.category);
    const newPrecedence = getCategoryPrecedence(latestClassification.category);
    let updatedCategory = ticket.category;

    if (newPrecedence > currentPrecedence && latestClassification.category !== 'irrelevant') {
      updatedCategory = latestClassification.category as typeof ticket.category;
      console.log(
        `[Group] Escalating ticket category: ${ticket.category} → ${updatedCategory} (precedence: ${currentPrecedence} → ${newPrecedence})`
      );
    }

    const summary = await generateTicketSummaryFromConversation({
      ticketTitle: ticket.title,
      ticketCategory: updatedCategory,
      messages,
      assignees: mergedAssignees,
      reporterUsername: ticket.reporter_username || null,
    });

    const updateData: Partial<Ticket> = {
      summary,
      assignees: mergedAssignees,
    };

    // Update category if escalated
    if (updatedCategory !== ticket.category) {
      updateData.category = updatedCategory;
    }

    await updateTicket(ticketId, updateData);

    console.log('[Group] Summary updated for ticket:', ticketId);
  } catch (error) {
    console.error('[Group] Error refreshing ticket summary:', error);
  }
}

export interface GroupOptions {
  is_fde?: boolean;
  is_context_only?: boolean;
}

export async function groupMessage(
  messageData: MessageData,
  classification: ClassificationResult,
  options?: GroupOptions
): Promise<string | null> {
  const isFde = options?.is_fde ?? false;
  const isContextOnly = options?.is_context_only ?? false;
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
    emitTicketUpdated(threadTicket.id);
    return threadTicket.id;
  }

  // Step 2: Compute entity-based canonical_key and check for match (works globally across channels)
  console.log('[Group] Step 2: Computing entity-based canonical key...');
  const normalized = normalizeMessage(messageData.text);
  // Use entity-based canonical key from signals
  const canonicalKey = computeCanonicalKey(normalized.signals) || 
    normalized.normalizedText
      .substring(0, 50)
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

  console.log('[Group] Canonical key:', canonicalKey, 'signals:', normalized.signals);

  if (canonicalKey) {
    const canonicalTicket = await findTicketByCanonicalKey(canonicalKey);
    if (canonicalTicket) {
      console.log('[Group] Found existing ticket via canonical key:', canonicalTicket.id, isFde ? '(FDE adding context)' : '', isContextOnly ? '(context-only)' : '');
      await upsertMessage({
        ...messageData,
        ticket_id: canonicalTicket.id,
        is_context_only: isContextOnly,
      });
      await refreshTicketSummary(canonicalTicket.id, classification, messageData);
      emitTicketUpdated(canonicalTicket.id);
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
      is_context_only: isContextOnly,
    });
    await refreshTicketSummary(best.ticketId, classification, messageData);
    emitTicketUpdated(best.ticketId);
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

        // Compute category compatibility
        const categoryCompatibility = isCategoryCompatible(ticket.category, classification.category);
        console.log(
          `[Group] Category: ${ticket.category} vs ${classification.category}, compatible: ${categoryCompatibility.compatible}, sometimesCompatible: ${categoryCompatibility.isSometimesCompatible}`
        );

        // Apply guardrails (evidence-based, not category-based)
        const guardrailPassed = applyGuardrails({
          categoryCompatible: categoryCompatibility.compatible,
          isSometimesCompatible: categoryCompatibility.isSometimesCompatible,
          distance,
          overlapCount,
          sameChannel,
          minutesSinceTicketUpdate: minutesSinceUpdate,
          sameThread: false, // Step 3.5 is channel-based, not thread-based
        });

        if (!guardrailPassed) {
          console.log(
            `[Group] Guardrail check: compatible=${categoryCompatibility.compatible}, distance=${distance.toFixed(4)}, overlap=${overlapCount}, sameChannel=${sameChannel}, minutesSinceUpdate=${minutesSinceUpdate}, sameThread=false, decision=BLOCK`
          );
        } else {
          // Compute match score
          const scoreResult = computeMatchScore({
            distance,
            sameChannel,
            minutesSinceTicketUpdate: minutesSinceUpdate,
            categoryCompatibility,
            sameCategory,
            overlapCount,
          });

          console.log(
            `[Group] Recent ticket score: ${scoreResult.score.toFixed(3)}, threshold: ${RECENT_CHANNEL_SCORE_THRESHOLD}, breakdown:`,
            scoreResult.breakdown
          );
          console.log(
            `[Group] Guardrail check: compatible=${categoryCompatibility.compatible}, distance=${distance.toFixed(4)}, overlap=${overlapCount}, sameChannel=${sameChannel}, minutesSinceUpdate=${minutesSinceUpdate}, sameThread=false, decision=ALLOW`
          );

          // Semantic topic guard: Prevent merging unrelated topics in Step 3.5
          // If distance is high (> 0.45) AND no signal overlap, this is likely a different topic
          // Even if score passes threshold due to sameChannel + recentUpdate bonuses
          const TOPIC_DISTANCE_THRESHOLD = 0.45;
          if (distance > TOPIC_DISTANCE_THRESHOLD && overlapCount === 0) {
            console.log(
              `[Group] Topic guard: High distance (${distance.toFixed(4)}) and zero overlap - message is about different topic. Not merging despite score ${scoreResult.score.toFixed(3)}.`
            );
            // Continue to Step 4 to create new ticket
          } else if (scoreResult.score >= RECENT_CHANNEL_SCORE_THRESHOLD) {
            // Check if score meets threshold
            console.log('[Group] Recent ticket score meets threshold, merging message', ticket.id, isFde ? '(FDE adding context)' : '', isContextOnly ? '(context-only)' : '');
            await upsertMessage({
              ...messageData,
              ticket_id: ticket.id,
              embedding,
              is_context_only: isContextOnly,
            });
            await refreshTicketSummary(ticket.id, classification, messageData);
            emitTicketUpdated(ticket.id);
            return ticket.id;
          } else if (isGrayZone(scoreResult.score, RECENT_CHANNEL_SCORE_THRESHOLD, distance, sameCategory)) {
            // Check gray-zone for LLM merge check (only if topic guard didn't block)
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
              emitTicketUpdated(ticket.id);
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
        console.log('[Group] Found recent ticket in same channel (no embedding to compare):', ticket.id, isFde ? '(FDE adding context)' : '', isContextOnly ? '(context-only)' : '');
        await upsertMessage({
          ...messageData,
          ticket_id: ticket.id,
          embedding,
          is_context_only: isContextOnly,
        });
        await refreshTicketSummary(ticket.id, classification, messageData);
        emitTicketUpdated(ticket.id);
        return ticket.id;
      }
    }
  }

  // Step 3.6: Cross-Channel Context Retrieval (CCR)
  // Fetch candidates from DB using vector search across channels and days
  if (embedding) {
    console.log('[Group] Step 3.6: Cross-Channel Context Retrieval (CCR)...');
    
    try {
      // Fetch candidates from ticket and message vector search
      const ticketCandidates = await findCrossChannelTicketCandidates(embedding, CROSS_CHANNEL_DAYS, MATCH_TOPK_TICKETS);
      const messageCandidates = await findCrossChannelMessageCandidates(embedding, CROSS_CHANNEL_DAYS, MATCH_TOPK_MESSAGES);
      
      // Also check canonical key match (if not already found in Step 2)
      let canonicalCandidate: TicketCandidate | null = null;
      if (canonicalKey) {
        const canonicalTicket = await findTicketByCanonicalKey(canonicalKey);
        if (canonicalTicket) {
          // Check if already in candidates
          const alreadyInCandidates = [...ticketCandidates, ...messageCandidates].some(
            c => c.ticketId === canonicalTicket.id
          );
          if (!alreadyInCandidates) {
            // Compute distance for canonical match
            const ticketEmb = canonicalTicket.embedding;
            if (ticketEmb && Array.isArray(ticketEmb) && ticketEmb.length === embedding.length) {
              const distance = cosineDistance(embedding, ticketEmb);
              // Get channel ID from messages
              const canonicalTicketMessages = await getMessagesByTicketId(canonicalTicket.id);
              const canonicalTicketChannelId = canonicalTicketMessages.length > 0 ? canonicalTicketMessages[0].slack_channel_id : undefined;
              canonicalCandidate = {
                ticketId: canonicalTicket.id,
                distance,
                category: canonicalTicket.category,
                updatedAt: canonicalTicket.updated_at,
                canonicalKey: canonicalTicket.canonical_key,
                ...(canonicalTicketChannelId && { slackChannelId: canonicalTicketChannelId }),
              };
            }
          }
        }
      }

      // Union and deduplicate candidates by ticket_id
      const allCandidates = new Map<string, TicketCandidate>();
      for (const c of [...ticketCandidates, ...messageCandidates]) {
        const existing = allCandidates.get(c.ticketId);
        if (!existing || c.distance < existing.distance) {
          allCandidates.set(c.ticketId, c);
        }
      }
      if (canonicalCandidate) {
        const existing = allCandidates.get(canonicalCandidate.ticketId);
        if (!existing || canonicalCandidate.distance < existing.distance) {
          allCandidates.set(canonicalCandidate.ticketId, canonicalCandidate);
        }
      }

      const candidates = Array.from(allCandidates.values());
      console.log(`[Group] CCR found ${candidates.length} unique candidate tickets`);

      if (candidates.length > 0) {
        // Score each candidate
        const scoredCandidates: Array<{
          candidate: TicketCandidate;
          ticket: Ticket;
          score: number;
          distance: number;
          overlapCount: number;
          scoreBreakdown: MatchScoreBreakdown;
        }> = [];

        for (const candidate of candidates) {
          try {
            const ticket = await getTicket(candidate.ticketId);
            if (!ticket || ticket.status !== 'open') {
              continue; // Skip closed tickets
            }

            // Get ticket messages for signal extraction and channel ID check
            const ticketMessages = await getMessagesByTicketId(ticket.id);

            // Skip if same channel (already handled in Step 3.5)
            // Get channel ID from first message (ticket doesn't have slack_channel_id directly)
            const ticketChannelId = ticketMessages.length > 0 ? ticketMessages[0].slack_channel_id : null;
            if (ticketChannelId === messageData.slack_channel_id) {
              continue;
            }
            const ticketSignals = extractTicketSignals(ticketMessages.map(m => ({ text: m.text })));
            const messageSignals = classification.signals || [];
            const overlapCount = computeSignalOverlap(messageSignals, ticketSignals);

            // Compute CCR match score
            const categoryCompatibility = isCategoryCompatible(classification.category, ticket.category);
            const scoreResult = computeCCRMatchScore({
              distance: candidate.distance,
              sameCategory: classification.category === ticket.category,
              categoryCompatibility,
              overlapCount,
              updatedAt: candidate.updatedAt,
            });

            // Apply CCR guardrails
            const guardrailPassed = applyCCRGuardrails({
              distance: candidate.distance,
              overlapCount,
              messageSignals,
              ticketSignals,
            });

            if (!guardrailPassed) {
              console.log(
                `[Group] CCR candidate ${candidate.ticketId} blocked by guardrails (distance: ${candidate.distance.toFixed(4)}, overlap: ${overlapCount})`
              );
              continue;
            }

            scoredCandidates.push({
              candidate,
              ticket,
              score: scoreResult.score,
              distance: candidate.distance,
              overlapCount,
              scoreBreakdown: scoreResult.breakdown,
            });
          } catch (error) {
            console.error(`[Group] Error processing CCR candidate ${candidate.ticketId}:`, error);
            continue;
          }
        }

        // Sort by score (descending) and log top 5
        scoredCandidates.sort((a, b) => b.score - a.score);
        const top5 = scoredCandidates.slice(0, 5);
        console.log('[Group] CCR top 5 candidates:');
        for (let i = 0; i < top5.length; i++) {
          const item = top5[i];
          console.log(
            `[Group] CCR candidate ${i + 1}: ticket=${item.candidate.ticketId}, distance=${item.distance.toFixed(4)}, overlap=${item.overlapCount}, score=${item.score.toFixed(3)}, channel=${item.candidate.slackChannelId || 'unknown'}, updated=${item.candidate.updatedAt}`
          );
        }

        // Pick best candidate
        if (scoredCandidates.length > 0) {
          const bestCandidate = scoredCandidates[0];
          const bestScore = bestCandidate.score;
          const bestTicket = bestCandidate.ticket;

          // Decision rules for CCR:
          // - Merge if score >= SCORE_THRESHOLD (0.75) OR
          // - Merge if overlapCount >= 2 AND distance <= 0.45 AND score >= 0.65
          const shouldMerge =
            bestScore >= SCORE_THRESHOLD ||
            (bestCandidate.overlapCount >= 2 && bestCandidate.distance <= 0.45 && bestScore >= 0.65);

          if (shouldMerge) {
            console.log(
              `[Group] CCR decision: MERGED, bestCandidate=${bestCandidate.candidate.ticketId}, bestScore=${bestScore.toFixed(3)}`
            );
            await upsertMessage({
              ...messageData,
              ticket_id: bestTicket.id,
              embedding,
            });
            await refreshTicketSummary(bestTicket.id, classification, messageData);
            emitTicketUpdated(bestTicket.id);
            return bestTicket.id;
          } else if (isCCRGrayZone(bestScore, SCORE_THRESHOLD, bestCandidate.distance, bestCandidate.overlapCount)) {
            // Gray-zone LLM merge check
            console.log('[Group] CCR score in gray-zone, performing LLM merge check...');
            const ticketMessages = await getMessagesByTicketId(bestTicket.id);
            const llmResult = await checkCCRLLMMerge({
              candidateTicket: bestTicket,
              candidateMessages: ticketMessages.map((m) => ({
                text: m.text,
                username: m.slack_username,
              })),
              incomingMessage: messageData,
              incomingClassification: classification,
            });

            console.log(
              `[Group] CCR LLM check: should_merge=${llmResult.should_merge}, confidence=${llmResult.confidence.toFixed(3)}, reason="${llmResult.reason}"`
            );

            if (llmResult.should_merge && llmResult.confidence >= 0.7) {
              console.log(
                `[Group] CCR LLM check approved merge, ticket=${bestTicket.id}`,
                isFde ? '(FDE adding context)' : ''
              );
              await upsertMessage({
                ...messageData,
                ticket_id: bestTicket.id,
                embedding,
              });
              await refreshTicketSummary(bestTicket.id, classification, messageData);
              emitTicketUpdated(bestTicket.id);
              return bestTicket.id;
            } else {
              console.log('[Group] CCR LLM check did not approve merge, proceeding to Step 4');
            }
          } else {
            console.log(
              `[Group] CCR decision: NEW_TICKET, bestCandidate=${bestCandidate.candidate.ticketId}, bestScore=${bestScore.toFixed(3)}`
            );
          }
        }
      }
    } catch (error) {
      console.error('[Group] Error in CCR Step 3.6:', error);
      // Continue to Step 4 on error
    }
  }

  // Step 4: Create new ticket with summary and assignees
  // FDE messages cannot create new tickets, only add context to existing ones
  if (isFde) {
    console.log('[Group] ⚠️ FDE message cannot create new ticket - no existing ticket to attach to');
    return null;
  }

  if (isContextOnly) {
    console.log('[Group] Context-only message: no suitable ticket found, skipping (do not create new ticket)');
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
    is_context_only: isContextOnly,
  });

  if (message.ticket_id !== ticket.id) {
    console.error('[Group] BUG: Creating message was stored with wrong ticket_id:', {
      expected: ticket.id,
      got: message.ticket_id,
      messageId: message.id,
    });
  }
  console.log('[Group] Attached creating message to ticket:', message.id, 'ticket_id:', message.ticket_id);
  emitTicketUpdated(ticket.id);

  return ticket.id;
}
