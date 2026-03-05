export function playAudio(slug: string, type: 'names' | 'pronunciation'): void {
  try {
    const audio = new Audio(`/audio/${type}/${slug}.mp3`);
    audio.play().catch(() => {});
  } catch {
    // fail silently
  }
}
