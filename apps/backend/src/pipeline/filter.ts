const IGNORE_PATTERNS = [
  'thanks',
  'thank you',
  'ok',
  'okay',
  'cool',
  'dinner',
  'see you',
  'lunch',
  'bye',
  'hi',
  'hello',
  'hey',
  'sure',
  'yep',
  'yeah',
  'no problem',
  'np',
];

export function shouldProcessMessage(normalizedText: string): boolean {
  const trimmed = normalizedText.trim();
  if (trimmed.length === 0) {
    return false;
  }

  // Only skip messages that are *only* the pattern (exact or with trailing punctuation),
  // so we don't drop real support messages that happen to end with "thanks" etc.
  for (const pattern of IGNORE_PATTERNS) {
    if (trimmed === pattern) return false;
    const withPunctuation = trimmed.replace(/[.,!?]+$/, '').trim();
    if (withPunctuation === pattern) return false;
  }

  return true;
}
