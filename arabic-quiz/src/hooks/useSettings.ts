import { useState } from 'react';

const UNLOCKED_KEY = 'arabic-quiz-unlocked';

async function sha256hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function useSettings() {
  const [unlocked, setUnlocked] = useState(() => localStorage.getItem(UNLOCKED_KEY) === 'true');

  const unlock = async (password: string): Promise<boolean> => {
    const hash = await sha256hex(password);
    const expected = import.meta.env.VITE_UNLOCK_HASH ?? '';
    if (hash === expected) {
      localStorage.setItem(UNLOCKED_KEY, 'true');
      setUnlocked(true);
      return true;
    }
    return false;
  };

  const lock = () => {
    localStorage.removeItem(UNLOCKED_KEY);
    setUnlocked(false);
  };

  return { unlocked, unlock, lock };
}
