import { useCallback, useEffect, useRef, useState } from 'react';
import { matchRecognitionProfile, normalizeName } from './recognitionMatcher.js';

const STORAGE_KEY_ACTIVE = 'yenartificia_recognition_active';
const STORAGE_KEY_CELEBRATED = 'yenartificia_recognition_celebrated';

function getStoredProfile() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_ACTIVE);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getCelebratedIds() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_CELEBRATED);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useRecognition() {
  const [activeProfile, setActiveProfile] = useState(getStoredProfile);
  const [celebratingProfile, setCelebratingProfile] = useState(null);

  // Keep ref for synchronous access in debounced callbacks
  const activeProfileRef = useRef(activeProfile);
  useEffect(() => {
    activeProfileRef.current = activeProfile;
  }, [activeProfile]);

  const debounceTimerRef = useRef(null);

  /**
   * Evaluates an entered name and updates recognition state accordingly.
   *
   * @param {string} rawInput - The name input value
   * @param {object} options
   * @param {boolean} options.immediate - Whether to evaluate immediately (blur/submit/enter) without debounce
   * @param {boolean} options.forceCelebration - Whether to replay celebration regardless of previous view
   */
  const checkRecognition = useCallback((rawInput, options = {}) => {
    const { immediate = false, forceCelebration = false } = options;

    const performCheck = () => {
      const normalized = normalizeName(rawInput);

      if (!normalized) {
        // If the user completely wiped the input, don't immediately clear if typing,
        // but if immediate (e.g. form reset), clear the recognition.
        if (immediate) {
          setActiveProfile(null);
          try {
            sessionStorage.removeItem(STORAGE_KEY_ACTIVE);
          } catch {}
        }
        return;
      }

      const match = matchRecognitionProfile(rawInput);

      if (match) {
        const currentId = activeProfileRef.current?.id;

        // If newly recognized or a different profile
        if (currentId !== match.id) {
          setActiveProfile(match);
          try {
            sessionStorage.setItem(STORAGE_KEY_ACTIVE, JSON.stringify(match));
          } catch {}

          const celebrated = getCelebratedIds();
          if (forceCelebration || !celebrated.includes(match.id)) {
            setCelebratingProfile(match);
            const updated = Array.from(new Set([...celebrated, match.id]));
            try {
              sessionStorage.setItem(STORAGE_KEY_CELEBRATED, JSON.stringify(updated));
            } catch {}
          }
        }
      } else {
        // If the input is non-empty and at least 2 characters but does NOT match any profile,
        // clear any previously active student's recognition so another student does not see it.
        if (normalized.length >= 2) {
          if (activeProfileRef.current !== null) {
            setActiveProfile(null);
            try {
              sessionStorage.removeItem(STORAGE_KEY_ACTIVE);
            } catch {}
          }
        }
      }
    };

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (immediate) {
      performCheck();
    } else {
      debounceTimerRef.current = setTimeout(performCheck, 350);
    }
  }, []);

  const dismissCelebration = useCallback(() => {
    setCelebratingProfile(null);
  }, []);

  const clearRecognition = useCallback(() => {
    setActiveProfile(null);
    setCelebratingProfile(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY_ACTIVE);
    } catch {}
  }, []);

  return {
    activeProfile,
    celebratingProfile,
    checkRecognition,
    dismissCelebration,
    clearRecognition,
  };
}
