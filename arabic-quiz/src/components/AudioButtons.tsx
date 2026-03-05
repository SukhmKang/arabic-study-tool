import { playAudio } from '@/lib/audio';

interface Props {
  slug: string;
}

export function AudioButtons({ slug }: Props) {
  return (
    <div className="flex gap-1">
      <button
        onClick={() => playAudio(slug, 'names')}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-border transition-colors text-muted hover:text-ink"
        title="Play name"
        aria-label="Play letter name"
      >
        ♪
      </button>
      <button
        onClick={() => playAudio(slug, 'pronunciation')}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-border transition-colors text-muted hover:text-ink"
        title="Play pronunciation"
        aria-label="Play pronunciation"
      >
        ◎
      </button>
    </div>
  );
}
