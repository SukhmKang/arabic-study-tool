import { useState, useCallback, useRef, useMemo } from 'react';
import { DrawCanvas, type DrawCanvasRef } from '@/components/DrawCanvas';
import { speakArabic } from '@/lib/audio';
import { splitIntoGlyphs, stripDiacritics, type PoolEntry, type WordResult } from '@/data/vocab';

interface Props {
  wordPool: PoolEntry[];
  onDone: (results: WordResult[]) => void;
  onExit: () => void;
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
    <span dir="rtl" className="font-arabic text-5xl">
      {glyphs.map((g, i) => (
        <span key={i} style={colorCoded ? { color: GLYPH_COLORS[i % GLYPH_COLORS.length] } : undefined}>
          {g.display}
        </span>
      ))}
    </span>
  );
}

type DrawPhase = 'drawing' | 'self-grade';
type SelfGradeChoice = 'got-it' | 'almost' | 'missed';

export function BuildDrawScreen({ wordPool, onDone, onExit }: Props) {
  const [wordIdx, setWordIdx] = useState(0);
  const [drawPhase, setDrawPhase] = useState<DrawPhase>('drawing');
  const [selfGrade, setSelfGrade] = useState<SelfGradeChoice | null>(null);
  const [sessionResults, setSessionResults] = useState<WordResult[]>([]);
  const [isEmpty, setIsEmpty] = useState(true);
  const [colorCoded, setColorCoded] = useState(false);
  const canvasRef = useRef<DrawCanvasRef>(null);

  const currentEntry = wordPool[wordIdx];
  const isLastWord = wordIdx === wordPool.length - 1;

  const handleCanvasChange = useCallback(() => {
    setIsEmpty(canvasRef.current?.isEmpty() ?? true);
  }, []);

  const handleSubmit = useCallback(() => {
    setDrawPhase('self-grade');
  }, []);

  const handleSelfGrade = useCallback((choice: SelfGradeChoice) => {
    setSelfGrade(choice);
  }, []);

  const handleNext = useCallback(() => {
    const correct = selfGrade === 'got-it' ? 1 : 0;
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
      setDrawPhase('drawing');
      setSelfGrade(null);
      setIsEmpty(true);
      canvasRef.current?.clear();
    }
  }, [selfGrade, currentEntry, sessionResults, isLastWord, onDone]);

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

        {/* Decomposed word prompt — always visible */}
        <div className="bg-surface rounded-2xl border border-border p-6 flex flex-col items-center gap-3">
          <div className="flex items-center justify-between w-full">
            <p className="font-mono text-xs text-muted">
              {drawPhase === 'drawing' ? 'Write the connected form of these letters' : 'Correct answer'}
            </p>
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
          {drawPhase === 'self-grade' && (
            <>
              <div className="flex items-center gap-3">
                <ConnectedWord arabic={currentEntry.entry.arabic} colorCoded={colorCoded} />
                <button
                  onClick={() => speakArabic(currentEntry.entry.arabic)}
                  className="min-h-[36px] min-w-[36px] rounded-full border border-border bg-surface text-muted hover:text-ink transition-colors flex items-center justify-center"
                  aria-label="Hear pronunciation"
                >
                  ♪
                </button>
              </div>
              <p className="font-mono text-sm text-muted">{currentEntry.entry.translation}</p>
            </>
          )}
        </div>

        {/* Canvas area */}
        <div className="bg-surface rounded-2xl border border-border p-4 flex flex-col gap-3">
          <div
            onPointerDown={() => setIsEmpty(false)}
            onPointerUp={handleCanvasChange}
          >
            <DrawCanvas ref={canvasRef} />
          </div>

          {drawPhase === 'drawing' && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  canvasRef.current?.clear();
                  setIsEmpty(true);
                }}
                className="flex-1 min-h-[44px] rounded-xl border-2 border-border font-mono text-sm text-muted hover:border-muted hover:text-ink transition-colors"
              >
                Clear
              </button>
              <button
                onClick={handleSubmit}
                disabled={isEmpty}
                className="flex-1 min-h-[44px] rounded-xl bg-ink text-surface font-mono text-sm font-medium hover:bg-ink/90 transition-colors disabled:opacity-40"
              >
                Submit
              </button>
            </div>
          )}
        </div>

        {/* Self-grade area */}
        {drawPhase === 'self-grade' && (
          <div className="bg-surface rounded-2xl border border-border p-4 flex flex-col gap-3">
            {selfGrade === null ? (
              <>
                <p className="font-mono text-xs text-muted text-center">How did you do?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSelfGrade('missed')}
                    className="flex-1 min-h-[44px] rounded-xl border-2 border-accent bg-accent-light font-mono text-sm text-accent hover:bg-accent/10 transition-colors"
                  >
                    Missed it
                  </button>
                  <button
                    onClick={() => handleSelfGrade('almost')}
                    className="flex-1 min-h-[44px] rounded-xl border-2 border-warning bg-warning-light font-mono text-sm text-warning hover:bg-warning/10 transition-colors"
                  >
                    Almost
                  </button>
                  <button
                    onClick={() => handleSelfGrade('got-it')}
                    className="flex-1 min-h-[44px] rounded-xl border-2 border-success bg-success-light font-mono text-sm text-success hover:bg-success/10 transition-colors"
                  >
                    Got it ✓
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={handleNext}
                className="w-full min-h-[48px] rounded-xl bg-ink text-surface font-mono text-sm font-medium hover:bg-ink/90 transition-colors"
              >
                {isLastWord ? 'See results' : 'Next →'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
