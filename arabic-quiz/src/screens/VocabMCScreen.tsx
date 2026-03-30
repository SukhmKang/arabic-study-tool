import { useState, useCallback, useMemo } from 'react';
import { shuffle } from '@/lib/quiz';
import { speakArabic } from '@/lib/audio';
import { type PoolEntry, type WordResult } from '@/data/vocab';
import type { VocabDirection } from './ConnectedFormsSelectScreen';

interface Props {
  wordPool: PoolEntry[];
  direction: VocabDirection;
  onDone: (results: WordResult[]) => void;
  onExit: () => void;
}

export function VocabMCScreen({ wordPool, direction, onDone, onExit }: Props) {
  const [wordIdx, setWordIdx] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [sessionResults, setSessionResults] = useState<WordResult[]>([]);

  const currentEntry = wordPool[wordIdx];
  const isLastWord = wordIdx === wordPool.length - 1;

  const options = useMemo(() => {
    const others = wordPool.filter((_, i) => i !== wordIdx);
    const distractors = shuffle(others).slice(0, 3);
    return shuffle([
      { entry: currentEntry.entry, unit: currentEntry.unit, isCorrect: true },
      ...distractors.map(p => ({ entry: p.entry, unit: p.unit, isCorrect: false })),
    ]);
  }, [wordIdx, wordPool, currentEntry]);

  const handleSelect = useCallback((idx: number) => {
    if (answered) return;
    setSelectedIdx(idx);
    setAnswered(true);
  }, [answered]);

  const handleNext = useCallback(() => {
    const correct = options[selectedIdx ?? -1]?.isCorrect ? 1 : 0;
    const newResults = [...sessionResults, {
      entry: currentEntry.entry,
      unit: currentEntry.unit,
      correct,
      total: 1,
    }];
    setSessionResults(newResults);

    if (isLastWord) {
      onDone(newResults);
    } else {
      setWordIdx(i => i + 1);
      setAnswered(false);
      setSelectedIdx(null);
    }
  }, [options, selectedIdx, currentEntry, sessionResults, isLastWord, onDone]);

  const correctIdx = options.findIndex(o => o.isCorrect);
  const wasCorrect = options[selectedIdx ?? -1]?.isCorrect;

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-lg mx-auto px-4 pt-4 pb-8 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-muted">
            Word {wordIdx + 1} / {wordPool.length}
          </span>
          <button
            onClick={onExit}
            className="min-h-[44px] rounded-xl border border-border px-3 font-mono text-xs text-muted hover:border-muted hover:text-ink transition-colors"
          >
            Exit
          </button>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-ink rounded-full transition-all"
            style={{ width: `${(wordIdx / wordPool.length) * 100}%` }}
          />
        </div>

        {/* Prompt */}
        <div className="bg-surface rounded-2xl border border-border p-8 flex flex-col items-center gap-2">
          {direction === 'en2ar' ? (
            <>
              <p className="font-mono text-xs text-muted">Which word means…</p>
              <p className="font-display text-4xl text-ink text-center">{currentEntry.entry.translation}</p>
            </>
          ) : (
            <>
              <p className="font-mono text-xs text-muted">What does this mean?</p>
              <p dir="rtl" className="font-arabic text-6xl text-ink text-center">{currentEntry.entry.arabic}</p>
              <button
                onClick={() => speakArabic(currentEntry.entry.arabic)}
                className="min-h-[36px] min-w-[36px] rounded-full border border-border text-muted hover:text-ink transition-colors flex items-center justify-center"
                aria-label="Hear pronunciation"
              >
                ♪
              </button>
            </>
          )}
        </div>

        {/* Options */}
        <div className="flex flex-col gap-2">
          {options.map((opt, idx) => {
            const isSelected = selectedIdx === idx;
            const isCorrectOpt = opt.isCorrect;
            let cls = 'bg-surface border-border hover:border-muted';
            if (answered) {
              if (isCorrectOpt) cls = 'bg-success-light border-success';
              else if (isSelected) cls = 'bg-accent-light border-accent';
              else cls = 'bg-surface border-border opacity-40';
            }
            return (
              <button
                key={idx}
                onClick={() => handleSelect(idx)}
                disabled={answered}
                className={`w-full min-h-[56px] rounded-xl border-2 px-4 transition-colors flex items-center justify-center ${cls}`}
              >
                {direction === 'en2ar' ? (
                  <span dir="rtl" className="font-arabic text-3xl">{opt.entry.arabic}</span>
                ) : (
                  <span className="font-mono text-sm text-center">{opt.entry.translation}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Feedback */}
        {answered && (
          <div className={`rounded-2xl border p-4 flex flex-col gap-3 ${
            wasCorrect ? 'bg-success-light border-success' : 'bg-accent-light border-accent'
          }`}>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <p dir="rtl" className="font-arabic text-4xl text-ink">{options[correctIdx].entry.arabic}</p>
                <button
                  onClick={() => speakArabic(options[correctIdx].entry.arabic)}
                  className="min-h-[32px] min-w-[32px] rounded-full border border-border bg-surface text-muted hover:text-ink transition-colors flex items-center justify-center text-sm"
                  aria-label="Hear pronunciation"
                >
                  ♪
                </button>
              </div>
              <div>
                <p className={`font-mono text-sm font-medium ${wasCorrect ? 'text-success' : 'text-accent'}`}>
                  {wasCorrect ? 'Correct!' : 'Not quite'}
                </p>
                <p className="font-mono text-xs text-muted">{options[correctIdx].entry.translation}</p>
              </div>
            </div>
            <button
              onClick={handleNext}
              className="w-full min-h-[44px] rounded-xl bg-ink text-surface font-mono text-sm font-medium hover:bg-ink/90 transition-colors"
            >
              {isLastWord ? 'See results' : 'Next →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
