import { Letter } from '@/data/letters';

interface Props {
  correctCount: number;
  total: number;
  missed: Letter[];
  onStartAgain: () => void;
  onReviewMissed: () => void;
  onChangeLetters: () => void;
  onHome?: () => void;
}

function getMessage(pct: number): string {
  if (pct === 100) return 'Perfect! Mastery achieved.';
  if (pct >= 80) return 'Great work! Almost there.';
  if (pct >= 50) return 'Good effort — keep practising!';
  return 'Keep going — practice makes perfect.';
}

export function DoneScreen({
  correctCount,
  total,
  missed,
  onStartAgain,
  onReviewMissed,
  onChangeLetters,
  onHome,
}: Props) {
  const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="text-center">
          <div className="font-display text-6xl text-ink mb-2">{pct}%</div>
          <p className="font-mono text-sm text-muted">{getMessage(pct)}</p>
          <p className="font-mono text-xs text-muted mt-1">
            {correctCount} / {total} correct
          </p>
        </div>

        {missed.length > 0 && (
          <div className="bg-surface rounded-2xl border border-border p-4">
            <h3 className="font-mono text-xs text-muted uppercase tracking-wide mb-3">
              Missed letters
            </h3>
            <div className="flex flex-col gap-2">
              {missed.map(l => (
                <div key={l.pos} className="flex items-center gap-3">
                  <span className="font-arabic text-2xl w-8 text-center" dir="rtl">
                    {l.arabic}
                  </span>
                  <span className="font-mono text-sm text-ink">{l.name}</span>
                  <span className="font-mono text-xs text-muted ml-auto">{l.roman}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button
            onClick={onStartAgain}
            className="w-full min-h-[48px] rounded-xl bg-ink text-surface font-mono text-sm font-medium hover:bg-ink/90 transition-colors"
          >
            Start again
          </button>
          {missed.length > 0 && (
            <button
              onClick={onReviewMissed}
              className="w-full min-h-[48px] rounded-xl border-2 border-accent text-accent font-mono text-sm font-medium hover:bg-accent-light transition-colors"
            >
              Review missed ({missed.length})
            </button>
          )}
          <button
            onClick={onChangeLetters}
            className="w-full min-h-[48px] rounded-xl border-2 border-border text-muted font-mono text-sm font-medium hover:border-ink hover:text-ink transition-colors"
          >
            Change letters
          </button>
          {onHome && (
            <button
              onClick={onHome}
              className="w-full min-h-[48px] rounded-xl border-2 border-border text-muted font-mono text-sm font-medium hover:border-ink hover:text-ink transition-colors"
            >
              Home
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
