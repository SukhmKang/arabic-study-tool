import { UNIT_KEYS, UNIT_LABELS, type UnitKey, type WordResult } from '@/data/vocab';

interface Props {
  results: WordResult[];
  onStartAgain: () => void;
  onChangeSettings: () => void;
}

function scoreMessage(pct: number): string {
  if (pct === 100) return 'Perfect!';
  if (pct >= 80) return 'Great work!';
  if (pct >= 50) return 'Keep practicing';
  return 'Keep at it!';
}

export function VocabDoneScreen({ results, onStartAgain, onChangeSettings }: Props) {
  const totalCorrect = results.reduce((n, r) => n + r.correct, 0);
  const totalAnswers = results.reduce((n, r) => n + r.total, 0);
  const pct = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0;

  // Per-unit breakdown
  const unitStats: Partial<Record<UnitKey, { correct: number; total: number }>> = {};
  for (const r of results) {
    const s = unitStats[r.unit] ?? { correct: 0, total: 0 };
    s.correct += r.correct;
    s.total += r.total;
    unitStats[r.unit] = s;
  }

  const usedUnits = UNIT_KEYS.filter(k => unitStats[k] !== undefined);

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="text-center">
          <p className="font-mono text-5xl font-medium text-ink">{pct}%</p>
          <p className="font-display text-2xl text-ink mt-1">{scoreMessage(pct)}</p>
          <p className="font-mono text-sm text-muted mt-1">
            {totalCorrect} / {totalAnswers} correct
          </p>
        </div>

        {usedUnits.length > 1 && (
          <div className="bg-surface rounded-2xl border border-border p-4 flex flex-col gap-2">
            <p className="font-mono text-xs text-muted uppercase tracking-wide mb-1">By unit</p>
            {usedUnits.map(unit => {
              const s = unitStats[unit]!;
              const unitPct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
              return (
                <div key={unit} className="flex items-center justify-between">
                  <span className="font-mono text-sm text-ink">{UNIT_LABELS[unit]}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-ink rounded-full"
                        style={{ width: `${unitPct}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs text-muted w-8 text-right">{unitPct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button
            onClick={onStartAgain}
            className="w-full min-h-[48px] rounded-xl bg-ink text-surface font-mono text-sm font-medium hover:bg-ink/90 transition-colors"
          >
            Start again
          </button>
          <button
            onClick={onChangeSettings}
            className="w-full min-h-[48px] rounded-xl border-2 border-border font-mono text-sm text-muted hover:border-muted hover:text-ink transition-colors"
          >
            Change settings
          </button>
        </div>
      </div>
    </div>
  );
}
