import { useState, useCallback, useMemo } from 'react';
import { shuffle } from '@/lib/quiz';
import { speakArabic } from '@/lib/audio';
import { splitIntoGlyphs, stripDiacritics, type PoolEntry, type WordResult } from '@/data/vocab';

interface Props {
  wordPool: PoolEntry[];
  onDone: (results: WordResult[]) => void;
  onExit: () => void;
}

interface Option {
  entry: PoolEntry['entry'];
  isCorrect: boolean;
}

const GLYPH_COLORS = [
  '#c0392b', // red
  '#2471a3', // blue
  '#1e8449', // green
  '#d68910', // amber
  '#7d3c98', // purple
  '#117a65', // teal
  '#ba4a00', // burnt orange
  '#1a5276', // navy
];

function DecomposedWord({ arabic, colorCoded }: { arabic: string; colorCoded: boolean }) {
  const glyphs = useMemo(() => splitIntoGlyphs(arabic), [arabic]);
  return (
    <div dir="rtl" className="flex items-center justify-center gap-2 flex-wrap">
      {glyphs.map((g, i) => {
        const color = colorCoded ? GLYPH_COLORS[i % GLYPH_COLORS.length] : undefined;
        return (
          <span key={i} className="contents">
            {i > 0 && <span className="text-muted font-mono text-xl">+</span>}
            <span
              className="font-arabic text-4xl leading-none rounded-lg px-2 py-1"
              style={{
                unicodeBidi: 'isolate',
                direction: 'rtl',
                color: color ?? 'inherit',
                backgroundColor: color ? color + '18' : undefined,
              }}
            >
              {stripDiacritics(g.display)}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function ConnectedWord({ arabic, colorCoded }: { arabic: string; colorCoded: boolean }) {
  const glyphs = useMemo(() => splitIntoGlyphs(arabic), [arabic]);
  return (
    <span dir="rtl" className="font-arabic text-3xl">
      {glyphs.map((g, i) => (
        <span key={i} style={colorCoded ? { color: GLYPH_COLORS[i % GLYPH_COLORS.length] } : undefined}>
          {g.display}
        </span>
      ))}
    </span>
  );
}

export function BuildMCScreen({ wordPool, onDone, onExit }: Props) {
  const [wordIdx, setWordIdx] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [sessionResults, setSessionResults] = useState<WordResult[]>([]);
  const [colorCoded, setColorCoded] = useState(false);

  const currentEntry = wordPool[wordIdx];
  const isLastWord = wordIdx === wordPool.length - 1;

  const options: Option[] = useMemo(() => {
    const others = wordPool
      .filter((_, i) => i !== wordIdx)
      .map(p => p.entry);
    const distractors = shuffle(others).slice(0, 3);
    const all: Option[] = [
      { entry: currentEntry.entry, isCorrect: true },
      ...distractors.map(e => ({ entry: e, isCorrect: false })),
    ];
    return shuffle(all);
  }, [wordIdx, wordPool, currentEntry]);

  const handleSelect = useCallback((idx: number) => {
    if (answered) return;
    setSelectedIdx(idx);
    setAnswered(true);
  }, [answered]);

  const handleNext = useCallback(() => {
    const correct = options[selectedIdx ?? -1]?.isCorrect ? 1 : 0;
    const result: WordResult = {
      entry: currentEntry.entry,
      unit: currentEntry.unit,
      correct,
      total: 1,
    };
    const newResults = [...sessionResults, result];
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

        {/* Decomposed word prompt */}
        <div className="bg-surface rounded-2xl border border-border p-6 flex flex-col items-center gap-3">
          <div className="flex items-center justify-between w-full">
            <p className="font-mono text-xs text-muted">Which connected form matches these letters?</p>
            <button
              onClick={() => setColorCoded(c => !c)}
              className={`font-mono text-xs px-2 py-1 rounded-lg border transition-colors ${
                colorCoded ? 'bg-ink text-surface border-ink' : 'border-border text-muted hover:border-muted hover:text-ink'
              }`}
            >
              color
            </button>
          </div>
          <DecomposedWord arabic={currentEntry.entry.arabic} colorCoded={colorCoded} />
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
                <ConnectedWord arabic={opt.entry.arabic} colorCoded={colorCoded && answered && isCorrectOpt} />
              </button>
            );
          })}
        </div>

        {/* Feedback + Next */}
        {answered && (
          <div className={`rounded-2xl border p-4 flex flex-col gap-3 ${
            options[selectedIdx ?? -1]?.isCorrect
              ? 'bg-success-light border-success'
              : 'bg-accent-light border-accent'
          }`}>
            <div className="flex items-center gap-2">
              <p className={`font-mono text-sm font-medium ${
                options[selectedIdx ?? -1]?.isCorrect ? 'text-success' : 'text-accent'
              }`}>
                {options[selectedIdx ?? -1]?.isCorrect ? 'Correct!' : 'Not quite'}
              </p>
              <button
                onClick={() => speakArabic(options[correctIdx].entry.arabic)}
                className="min-h-[32px] min-w-[32px] rounded-full border border-border bg-surface text-muted hover:text-ink transition-colors flex items-center justify-center text-sm"
                aria-label="Hear pronunciation"
              >
                ♪
              </button>
            </div>
            <p className="font-mono text-xs text-muted">{options[correctIdx].entry.translation}</p>
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
