export interface NormalizedMessage {
  normalizedText: string;
  signals: string[];
}

// Common stopwords to filter out
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'will', 'with', 'the', 'this', 'but', 'they', 'have',
  'had', 'what', 'said', 'each', 'which', 'their', 'time', 'if', 'up',
  'out', 'many', 'then', 'them', 'these', 'so', 'some', 'her', 'would',
  'make', 'like', 'into', 'him', 'has', 'two', 'more', 'very', 'after',
  'words', 'long', 'than', 'first', 'been', 'call', 'who', 'oil', 'sit',
  'now', 'find', 'down', 'day', 'did', 'get', 'come', 'made', 'may', 'part'
]);

/**
 * Lightweight stemming: convert common word endings to base form
 */
function stem(word: string): string {
  // Simple rules for common cases
  if (word.endsWith('ing') && word.length > 5) {
    return word.slice(0, -3);
  }
  if (word.endsWith('ed') && word.length > 4) {
    return word.slice(0, -2);
  }
  if (word.endsWith('s') && word.length > 3) {
    return word.slice(0, -1);
  }
  return word;
}

export function normalizeMessage(text: string): NormalizedMessage {
  const trimmed = text.trim();
  const normalizedText = trimmed.toLowerCase();

  // Extract signals: error codes, platform mentions, feature keywords, roles, permissions, objects
  const signals: string[] = [];

  // Error codes (e.g., "404", "500", "ERR_123")
  const errorCodePattern = /\b(\d{3,4}|ERR[_\-]?\w+)\b/gi;
  const errorCodes = trimmed.match(errorCodePattern);
  if (errorCodes) {
    signals.push(...errorCodes.map((c) => c.toLowerCase().replace(/[^a-z0-9]/g, '_')));
  }

  // Roles: admin, superadmin, owner, user, guest
  const roleKeywords = ['admin', 'superadmin', 'owner', 'user', 'guest', 'member', 'viewer'];
  for (const keyword of roleKeywords) {
    if (normalizedText.includes(keyword)) {
      signals.push(keyword);
    }
  }

  // Permissions: access, permission, restrict, rbac, authorize, deny, allow, grant, revoke
  const permissionKeywords = ['access', 'permission', 'restrict', 'rbac', 'authorize', 'deny', 'allow', 'grant', 'revoke', 'authorization'];
  for (const keyword of permissionKeywords) {
    if (normalizedText.includes(keyword)) {
      signals.push(keyword);
    }
  }

  // Objects: budget, invoice, export, csv, pdf, report, dashboard, analytics
  const objectKeywords = ['budget', 'invoice', 'export', 'csv', 'pdf', 'report', 'dashboard', 'analytics', 'data', 'file'];
  for (const keyword of objectKeywords) {
    if (normalizedText.includes(keyword)) {
      signals.push(keyword);
    }
  }

  // Platform mentions (e.g., "API", "database", "frontend")
  const platformKeywords = ['api', 'database', 'db', 'frontend', 'backend', 'ui', 'ux', 'mobile', 'web', 'ios', 'android', 'desktop'];
  for (const keyword of platformKeywords) {
    if (normalizedText.includes(keyword)) {
      signals.push(`platform_${keyword}`);
    }
  }

  // Feature keywords (e.g., "auth", "payment", "search")
  const featureKeywords = ['auth', 'login', 'payment', 'search', 'filter', 'export', 'import', 'oauth', 'sso'];
  for (const keyword of featureKeywords) {
    if (normalizedText.includes(keyword)) {
      signals.push(`feature_${keyword}`);
    }
  }

  // Endpoints: /v1/*, /api/* patterns
  const endpointPattern = /\/(?:v\d+|api)\/[\w\/\-]+/gi;
  const endpoints = trimmed.match(endpointPattern);
  if (endpoints) {
    signals.push(...endpoints.map((e) => e.toLowerCase().replace(/\//g, '_')));
  }

  // Extract meaningful tokens (words) and filter stopwords
  const words = normalizedText
    .split(/[\s\W]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .map(stem);

  // Add significant words as signals (nouns/verbs, not stopwords)
  for (const word of words) {
    if (word.length >= 4 && !STOPWORDS.has(word)) {
      // Only add if not already captured by specific keyword lists
      const alreadyCaptured = signals.some((s) => s.includes(word) || word.includes(s.replace(/^(platform_|feature_|error_)/, '')));
      if (!alreadyCaptured) {
        signals.push(word);
      }
    }
  }

  return {
    normalizedText,
    signals: [...new Set(signals)], // Dedupe
  };
}

/**
 * Compute entity-based canonical key from signals.
 * Creates a stable fingerprint that works across paraphrases.
 * Returns sorted unique tokens joined by "|", capped to 6-10 tokens.
 */
export function computeCanonicalKey(signals: string[]): string | null {
  if (signals.length === 0) {
    return null;
  }

  // Normalize signals: remove prefixes, lowercase, dedupe
  const normalized = signals
    .map((s) => s.toLowerCase().replace(/^(platform_|feature_|error_)/, ''))
    .filter((s) => s.length > 0)
    .filter((s, i, arr) => arr.indexOf(s) === i); // Dedupe

  if (normalized.length === 0) {
    return null;
  }

  // Sort for consistency, take top 10 tokens
  const sorted = normalized.sort().slice(0, 10);

  // Join with "|" separator
  return sorted.join('|');
}
