export function playAudio(slug: string, type: 'names' | 'pronunciation'): void {
  try {
    const audio = new Audio(`/audio/${type}/${slug}.mp3`);
    audio.play().catch(() => {});
  } catch {
    // fail silently
  }
}

export function speakArabic(text: string): void {
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ar-SA';
    utter.rate = 0.9;
    window.speechSynthesis.speak(utter);
  } catch {
    // fail silently
  }
}
