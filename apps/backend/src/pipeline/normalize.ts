export interface NormalizedMessage {
  normalizedText: string;
  signals: string[];
}

export function normalizeMessage(text: string): NormalizedMessage {
  const trimmed = text.trim();
  const normalizedText = trimmed.toLowerCase();

  // Extract signals: error codes, platform mentions, feature keywords
  const signals: string[] = [];

  // Error codes (e.g., "404", "500", "ERR_123")
  const errorCodePattern = /\b(\d{3,4}|ERR[_\-]?\w+)\b/gi;
  const errorCodes = trimmed.match(errorCodePattern);
  if (errorCodes) {
    signals.push(...errorCodes.map((c) => `error_${c.toLowerCase().replace(/[^a-z0-9]/g, '_')}`));
  }

  // Platform mentions (e.g., "API", "database", "frontend")
  const platformKeywords = ['api', 'database', 'db', 'frontend', 'backend', 'ui', 'ux', 'mobile', 'web'];
  for (const keyword of platformKeywords) {
    if (normalizedText.includes(keyword)) {
      signals.push(`platform_${keyword}`);
    }
  }

  // Feature keywords (e.g., "auth", "payment", "search")
  const featureKeywords = ['auth', 'login', 'payment', 'search', 'filter', 'export', 'import'];
  for (const keyword of featureKeywords) {
    if (normalizedText.includes(keyword)) {
      signals.push(`feature_${keyword}`);
    }
  }

  return {
    normalizedText,
    signals: [...new Set(signals)], // Dedupe
  };
}
