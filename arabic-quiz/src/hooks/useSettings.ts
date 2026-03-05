import { useState } from 'react';

const STORAGE_KEY = 'arabic-quiz-api-key';

export function useSettings() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(STORAGE_KEY) ?? '');

  const saveApiKey = (key: string) => {
    localStorage.setItem(STORAGE_KEY, key);
    setApiKey(key);
  };

  return { apiKey, saveApiKey };
}
