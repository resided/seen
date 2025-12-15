// Content moderation utility for chat messages

// Common profanity words (basic list - can be expanded)
const PROFANITY_WORDS = [
  // Common swear words (using common variations and leetspeak)
  'fuck', 'fck', 'f*ck', 'f**k', 'f***',
  'shit', 'sh*t', 's**t', 's***',
  'damn', 'damm', 'd*mn',
  'hell', 'h*ll',
  'ass', 'a**', 'a*s',
  'bitch', 'b*tch', 'b**ch', 'bi*ch',
  'bastard', 'b*stard',
  'crap', 'cr*p',
  'piss', 'p*ss',
  'dick', 'd*ck', 'd**k',
  'cock', 'c*ck',
  'pussy', 'p*ssy',
  'slut', 'sl*t',
  'whore', 'wh*re',
  'nigger', 'n*gger', 'n**ger', 'nigga', 'n*gga', // Racial slurs
  'retard', 'r*tard', 'ret*rd',
  'gay', 'g*y', // Context-dependent, but blocking for safety
  // Add more as needed
];

// URL patterns to detect
const URL_PATTERNS = [
  /https?:\/\/[^\s]+/gi,                    // http:// or https://
  /www\.[^\s]+/gi,                          // www.example.com
  /[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*/gi,    // example.com, example.io, etc.
  /[a-zA-Z0-9-]+\.(com|net|org|io|co|xyz|app|dev|me|tv|gg|eth|sol)[^\s]*/gi, // Common TLDs
];

/**
 * Check if message contains profanity
 * @param {string} message - Message to check
 * @returns {boolean} - True if profanity detected
 */
export function containsProfanity(message) {
  if (!message) return false;
  
  const normalized = message.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars for matching
    .replace(/\s+/g, ' '); // Normalize spaces
  
  // Split into words for more accurate matching
  const words = normalized.split(/\s+/);
  
  // Check against profanity list
  for (const profanityWord of PROFANITY_WORDS) {
    // Create regex pattern that matches word with optional special chars
    const pattern = profanityWord.replace(/\*/g, '[a-z0-9]*').replace(/\s/g, '').toLowerCase();
    
    // Check if any word in the message matches the profanity pattern
    for (const word of words) {
      // Use word boundaries to ensure we match whole words only
      const regex = new RegExp(`^${pattern.replace(/\*/g, '[a-z0-9]*')}$`, 'i');
      if (regex.test(word)) {
      return true;
      }
    }
  }
  
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
  if (!message || !message.trim()) {
    return { valid: false, reason: 'Message cannot be empty' };
  }
  
  // Profanity filter disabled - too strict and causing false positives
  // if (containsProfanity(message)) {
  //   return { valid: false, reason: 'Message contains inappropriate language' };
  // }
  
  if (containsUrl(message)) {
    return { valid: false, reason: 'Links are not allowed in chat' };
  }
  
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
