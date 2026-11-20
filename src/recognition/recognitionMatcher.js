import { RECOGNITION_PROFILES } from './recognitionData.js';

/**
 * Normalizes input string:
 * - Trims leading & trailing whitespace
 * - Collapses consecutive whitespace into a single space
 * - Converts to uppercase for case-insensitive matching
 */
export function normalizeName(input) {
  if (typeof input !== 'string') return '';
  return input.trim().replace(/\s+/g, ' ').toUpperCase();
}

/**
 * Generic names that must explicitly never trigger recognition.
 */
const GENERIC_BLOCKED_NAMES = new Set([
  'MOHAMMED',
  'MOHAMMAD',
  'MUHAMMED',
  'MUHAMMAD',
  'MOHAMED',
  'MD',
]);

/**
 * Matches an entered name against the 24 configured recognition profiles.
 * Strict exact match only against configured trigger aliases.
 *
 * @param {string} rawInput - The name entered by the user
 * @returns {object|null} - The matched recognition profile or null
 */
export function matchRecognitionProfile(rawInput) {
  const normalized = normalizeName(rawInput);
  if (!normalized) return null;

  // Rule 7: Do not trigger recognition for generic names such as MOHAMMED or MOHAMMAD, or partial first names like ZAIN
  if (GENERIC_BLOCKED_NAMES.has(normalized)) {
    return null;
  }

  for (const profile of RECOGNITION_PROFILES) {
    for (const alias of profile.aliases) {
      if (normalizeName(alias) === normalized) {
        return profile;
      }
    }
  }

  return null;
}
