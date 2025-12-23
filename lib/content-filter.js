// Content moderation utility for chat messages
// SMART PROFANITY FILTER - Uses whole-word matching to avoid false positives

// Common profanity words (using whole-word matching only)
// This avoids blocking words like "RUNNER" which contains substrings
const PROFANITY_WORDS = [
  // Strong profanity
  'fuck', 'fck', 'fuk', 'fxck',
  'fucking', 'fucked', 'fucker', 'fuckin',
  'shit', 'shitty', 'bullshit',
  'bitch', 'bitches', 'bitching',
  'bastard', 'asshole',
  'cunt', 'pussy',
  'dick', 'cock', 'penis',
  'slut', 'whore',
  'piss', 'pissed',

  // Racial/hateful slurs (absolutely blocked)
  'nigger', 'nigga', 'n1gger', 'n1gga',
  'faggot', 'fag', 'f4ggot',
  'retard', 'retarded',
  'chink', 'gook', 'kike', 'spic',

  // Common variations with special characters (only whole words)
  'f*ck', 'f**k', 'sh*t', 's**t',
  'b*tch', 'a**hole', 'a$$hole',
  'd*ck', 'c*ck', 'c*nt',
  'n*gger', 'n*gga',
];

// URL patterns to detect
const URL_PATTERNS = [
  /https?:\/\/[^\s]+/gi,                    // http:// or https://
  /www\.[^\s]+/gi,                          // www.example.com
  /[a-zA-Z0-9-]+\.(com|net|org|io|co|xyz|app|dev|me|tv|gg|eth|sol|edu|gov)[^\s]*/gi, // Common TLDs
];

/**
 * Check if message contains profanity using WHOLE-WORD matching
 * This prevents false positives like blocking "RUNNER" or "CLASSIC"
 * @param {string} message - Message to check
 * @returns {boolean} - True if profanity detected
 */
export function containsProfanity(message) {
  if (!message) return false;

  // Normalize message: lowercase, replace special chars with spaces
  const normalized = message.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // Replace special chars with spaces
    .replace(/\s+/g, ' ') // Normalize multiple spaces
    .trim();

  // Split into words
  const words = normalized.split(/\s+/);

  console.log('[PROFANITY CHECK]', { original: message, normalized, words });

  // Check each word against profanity list (WHOLE WORD ONLY)
  for (const word of words) {
    // Direct match
    if (PROFANITY_WORDS.includes(word)) {
      console.log('[PROFANITY DETECTED] Direct match:', word);
      return true;
    }

    // Check for leetspeak variations (0 for o, 1 for i, 3 for e, 4 for a, etc.)
    const deLeeted = word
      .replace(/0/g, 'o')
      .replace(/1/g, 'i')
      .replace(/3/g, 'e')
      .replace(/4/g, 'a')
      .replace(/5/g, 's')
      .replace(/7/g, 't');

    if (PROFANITY_WORDS.includes(deLeeted)) {
      console.log('[PROFANITY DETECTED] Leetspeak match:', word, '->', deLeeted);
      return true;
    }

    // Check for repeated characters (e.g., "fuuuuck" -> "fuck")
    const deduplicated = word.replace(/(.)\1+/g, '$1');
    if (PROFANITY_WORDS.includes(deduplicated)) {
      console.log('[PROFANITY DETECTED] Repeated chars match:', word, '->', deduplicated);
      return true;
    }

    // Check for asterisk/underscore substitutions (e.g., "f*ck" = "fuck")
    const withoutAsterisks = word.replace(/[*_]/g, '');
    if (PROFANITY_WORDS.includes(withoutAsterisks)) {
      console.log('[PROFANITY DETECTED] Asterisk substitution match:', word, '->', withoutAsterisks);
      return true;
    }
  }

  console.log('[PROFANITY CHECK] No profanity detected');
  return false;
}

/**
 * Check if message contains URLs/links
 * @param {string} message - Message to check
 * @returns {boolean} - True if URL detected
 */
export function containsUrl(message) {
  if (!message) return false;

  for (const pattern of URL_PATTERNS) {
    if (pattern.test(message)) {
      return true;
    }
  }

  return false;
}

/**
 * Validate message content
 * @param {string} message - Message to validate
 * @returns {{ valid: boolean, reason?: string }} - Validation result
 */
export function validateMessage(message) {
  console.log('[VALIDATE MESSAGE] Checking:', message);

  if (!message || !message.trim()) {
    console.log('[VALIDATE MESSAGE] Empty message');
    return { valid: false, reason: 'Message cannot be empty' };
  }

  // ENABLED: Smart profanity filter with whole-word matching
  if (containsProfanity(message)) {
    console.log('[VALIDATE MESSAGE] BLOCKED - Contains profanity');
    return { valid: false, reason: 'Message contains inappropriate language' };
  }

  if (containsUrl(message)) {
    console.log('[VALIDATE MESSAGE] BLOCKED - Contains URL');
    return { valid: false, reason: 'Links are not allowed in chat' };
  }

  console.log('[VALIDATE MESSAGE] PASSED - Message is valid');
  return { valid: true };
}

/**
 * Sanitize message (remove potentially harmful content)
 * Note: This is a fallback - validation should prevent bad content
 * @param {string} message - Message to sanitize
 * @returns {string} - Sanitized message
 */
export function sanitizeMessage(message) {
  if (!message) return '';

  // Remove URLs
  let sanitized = message;
  for (const pattern of URL_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  // Trim and clean up
  return sanitized.trim().replace(/\s+/g, ' ');
}
