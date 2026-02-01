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

  // Check if message matches any ignore pattern
  for (const pattern of IGNORE_PATTERNS) {
    if (trimmed === pattern || trimmed.startsWith(pattern + ' ') || trimmed.endsWith(' ' + pattern)) {
      return false;
    }
  }

  return true;
}
