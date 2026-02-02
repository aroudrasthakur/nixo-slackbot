export interface NormalizedMessage {
  normalizedText: string;
  signals: string[];
}

export interface IntentFingerprint {
  intent_action: string | null;
  intent_object: string | null;
  intent_value: string | null;
  intent_key: string | null; // null if object missing
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

/**
 * Normalize a signal using synonym mapping.
 * Maps variants to canonical forms for consistent matching.
 */
function normalizeSignal(signal: string): string {
  const lower = signal.toLowerCase().trim();
  
  // Synonym map: map variants to canonical forms
  const synonymMap: Record<string, string> = {
    // Super admin variants
    'super admin': 'superadmin',
    'super-admin': 'superadmin',
    'super_admin': 'superadmin',
    
    // Access control variants
    'rbac': 'access_control',
    'permission': 'access_control',
    'permissions': 'access_control',
    'access': 'access_control',
    'restrict': 'access_control',
    'authorization': 'access_control',
    'authz': 'access_control',
    
    // Budget variants
    'budget page': 'budget',
    'budget module': 'budget',
  };
  
  // Check exact match first
  if (synonymMap[lower]) {
    return synonymMap[lower];
  }
  
  // Check if signal contains any synonym key
  for (const [variant, canonical] of Object.entries(synonymMap)) {
    if (lower.includes(variant)) {
      return canonical;
    }
  }
  
  return lower;
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

  // Error phrases (e.g., "permission denied", "unauthorized")
  const errorPhrases = [
    'permission denied',
    'unauthorized',
    'access denied',
    'forbidden',
    'not found',
    'internal server error',
  ];
  for (const phrase of errorPhrases) {
    if (normalizedText.includes(phrase)) {
      // Extract key words from phrase
      const words = phrase.split(' ');
      signals.push(...words.filter(w => w.length > 2));
    }
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

  // Auth terms: oauth, sso (also extract as standalone signals)
  const authTerms = ['oauth', 'sso'];
  for (const term of authTerms) {
    if (normalizedText.includes(term)) {
      signals.push(term);
    }
  }

  // Endpoints: /v1/*, /api/*, /auth/* patterns
  const endpointPattern = /\/(?:v\d+|api|auth)\/[\w\/\-]+/gi;
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
 * 
 * For style_change intents: requires object token; color-only keys are not generated.
 */
export function computeCanonicalKey(signals: string[], text?: string): string | null {
  if (signals.length === 0) {
    return null;
  }

  // Normalize signals: apply synonym normalization, remove prefixes, lowercase, dedupe
  const normalized = signals
    .map((s) => normalizeSignal(s).replace(/^(platform_|feature_|error_)/, ''))
    .filter((s) => s.length > 0)
    .filter((s, i, arr) => arr.indexOf(s) === i); // Dedupe

  if (normalized.length === 0) {
    return null;
  }

  // Check if this might be a style_change intent (color-related)
  const colorKeywords = ['blue', 'red', 'green', 'purple', 'yellow', 'orange', 'pink', 'black', 'white', 'gray', 'grey', 'color', 'colour', 'style'];
  const hasColorKeyword = normalized.some(s => colorKeywords.includes(s));
  const styleVerbs = ['make', 'set', 'change', 'ensure', 'update'];
  const hasStyleVerb = text && styleVerbs.some(verb => text.toLowerCase().includes(verb));

  // If style_change intent detected, require object token
  if (hasColorKeyword && hasStyleVerb) {
    // UI component keywords that qualify as objects
    const uiComponents = [
      'button', 'btn', 'dashboard', 'navbar', 'nav', 'modal', 'dialog', 'table', 'grid',
      'form', 'input', 'field', 'menu', 'dropdown', 'sidebar', 'panel', 'card', 'tile',
      'header', 'footer', 'toolbar', 'badge', 'tag', 'chart', 'graph', 'list', 'item',
      'page', 'screen', 'tab', 'tabs', 'link', 'anchor', 'image', 'img', 'icon',
      'text', 'label', 'checkbox', 'radio', 'select',
    ];
    
    // Object keywords
    const objectKeywords = [
      'budget', 'invoice', 'export', 'csv', 'pdf', 'report', 'analytics',
      'login', 'auth', 'signin', 'signup', 'user', 'profile', 'account',
      'settings', 'config', 'preferences', 'search', 'filter',
      'notification', 'alert', 'payment', 'billing',
    ];

    const hasObject = normalized.some(s => 
      uiComponents.includes(s) || objectKeywords.includes(s)
    );

    // If no object found, do not generate canonical_key for style_change
    if (!hasObject) {
      return null;
    }
  }

  // Sort for consistency, take top 10 tokens
  const sorted = normalized.sort().slice(0, 10);

  // Join with "|" separator
  return sorted.join('|');
}

/**
 * Compute intent fingerprint from message text and signals.
 * Extracts action, object (REQUIRED), and value to form intent_key.
 * Returns null intent_key if object is missing (prevents color-only grouping).
 */
export function computeIntentFingerprint(text: string, signals: string[]): IntentFingerprint {
  const normalizedText = text.toLowerCase().trim();
  const words = normalizedText.split(/[\s\W]+/).filter(w => w.length > 0);
  
  let intent_action: string | null = null;
  let intent_object: string | null = null;
  let intent_value: string | null = null;

  // 1. Extract intent_action
  // Style verbs: make, set, change, ensure, update (when UI color/styling related)
  const styleVerbs = ['make', 'set', 'change', 'ensure', 'update', 'switch', 'turn'];
  const hasStyleVerb = styleVerbs.some(verb => normalizedText.includes(verb));
  
  // Access verbs: restrict, prevent, block, allow
  const accessVerbs = ['restrict', 'prevent', 'block', 'allow', 'deny', 'grant', 'revoke'];
  const hasAccessVerb = accessVerbs.some(verb => normalizedText.includes(verb));
  
  // Add verbs: add, include, support
  const addVerbs = ['add', 'include', 'support', 'create', 'implement'];
  const hasAddVerb = addVerbs.some(verb => normalizedText.includes(verb));
  
  // Bug verbs: broken, doesn't work, error
  const bugPhrases = ['broken', "doesn't work", "don't work", "does not work", 'error', 'bug', 'crash', 'fails'];
  const hasBugPhrase = bugPhrases.some(phrase => normalizedText.includes(phrase));

  // Determine action (priority: bug > access > add > style)
  if (hasBugPhrase) {
    intent_action = 'bug';
  } else if (hasAccessVerb || normalizedText.includes('permission') || normalizedText.includes('rbac') || normalizedText.includes('access_control')) {
    intent_action = 'access_control';
  } else if (hasAddVerb) {
    intent_action = 'add_feature';
  } else if (hasStyleVerb) {
    // Only mark as style_change if related to UI color/styling
    const colorKeywords = ['blue', 'red', 'green', 'purple', 'yellow', 'orange', 'pink', 'black', 'white', 'gray', 'grey', 'color', 'colour', 'style', 'styling', 'css', 'theme', 'background', 'foreground', '#'];
    const hasColorKeyword = colorKeywords.some(kw => normalizedText.includes(kw));
    if (hasColorKeyword) {
      intent_action = 'style_change';
    }
  }

  // 2. Extract intent_object (REQUIRED for intent_key)
  // UI component keywords (most specific first)
  const uiComponents = [
    'button', 'btn',
    'dashboard',
    'navbar', 'nav', 'navigation',
    'modal', 'dialog',
    'table', 'grid',
    'form', 'input', 'field',
    'menu', 'dropdown',
    'sidebar', 'panel',
    'card', 'tile',
    'header', 'footer',
    'toolbar',
    'badge', 'tag',
    'chart', 'graph',
    'list', 'item',
    'page', 'screen',
    'tab', 'tabs',
    'link', 'anchor',
    'image', 'img', 'picture',
    'icon',
    'text', 'label',
    'checkbox', 'radio',
    'select', 'dropdown',
  ];
  
  // Also check signals for objects
  const objectKeywords = [
    'budget', 'invoice', 'export', 'csv', 'pdf', 'report', 'dashboard', 'analytics',
    'login', 'auth', 'signin', 'signup',
    'user', 'profile', 'account',
    'settings', 'config', 'preferences',
    'search', 'filter',
    'notification', 'alert',
    'payment', 'billing', 'invoice',
  ];

  // Find most specific UI component
  for (const component of uiComponents) {
    if (normalizedText.includes(component) || signals.some(s => s.includes(component))) {
      intent_object = component;
      break;
    }
  }

  // If no UI component found, check object keywords
  if (!intent_object) {
    for (const keyword of objectKeywords) {
      if (normalizedText.includes(keyword) || signals.some(s => s.includes(keyword))) {
        intent_object = keyword;
        break;
      }
    }
  }

  // If still no object, try to extract from signals (remove prefixes)
  if (!intent_object && signals.length > 0) {
    for (const signal of signals) {
      const cleanSignal = signal.replace(/^(platform_|feature_|error_)/, '');
      // Check if it's a known object
      if (uiComponents.includes(cleanSignal) || objectKeywords.includes(cleanSignal)) {
        intent_object = cleanSignal;
        break;
      }
      // If signal is a noun-like word (not a verb or adjective), use it
      if (cleanSignal.length >= 4 && !STOPWORDS.has(cleanSignal) && 
          !['make', 'set', 'change', 'add', 'get', 'put', 'post', 'delete'].includes(cleanSignal)) {
        intent_object = cleanSignal;
        break;
      }
    }
  }

  // 3. Extract intent_value
  if (intent_action === 'style_change') {
    // Extract colors
    const colorPattern = /(?:^|\s)(blue|red|green|purple|yellow|orange|pink|black|white|gray|grey|brown|cyan|magenta|teal|indigo|violet|maroon|navy|olive|silver|gold)(?:\s|$)/i;
    const colorMatch = normalizedText.match(colorPattern);
    if (colorMatch) {
      intent_value = colorMatch[1].toLowerCase();
    } else {
      // Check for hex codes
      const hexPattern = /#[0-9a-f]{3,6}/i;
      const hexMatch = normalizedText.match(hexPattern);
      if (hexMatch) {
        intent_value = hexMatch[0].toLowerCase();
      }
    }
  } else if (intent_action === 'access_control') {
    // Extract roles
    const roleKeywords = ['admin', 'superadmin', 'owner', 'user', 'guest', 'member', 'viewer'];
    for (const role of roleKeywords) {
      if (normalizedText.includes(role) || signals.includes(role)) {
        intent_value = role;
        break;
      }
    }
  }

  // 4. Compose intent_key (REQUIRES intent_object)
  let intent_key: string | null = null;
  if (intent_object && intent_action) {
    intent_key = `${intent_action}|${intent_object}|${intent_value ?? '*'}`;
  }

  return {
    intent_action,
    intent_object,
    intent_value,
    intent_key,
  };
}
