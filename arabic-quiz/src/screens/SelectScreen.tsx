import { useState, useEffect } from 'react';
import { LETTERS, SUN_LETTERS, MOON_LETTERS, Letter } from '@/data/letters';
import { LetterGrid } from '@/components/LetterGrid';
import { ModePills } from '@/components/ModePills';
import { QuizMode, QuizDirection } from '@/hooks/useQuiz';

const SELECTION_KEY = 'arabic-quiz-selected';

interface Props {
  onStart: (letters: Letter[], mode: QuizMode, direction: QuizDirection) => void;
  onHome?: () => void;
}

function loadSelection(): Set<number> {
  try {
    const raw = localStorage.getItem(SELECTION_KEY);
    if (raw) return new Set(JSON.parse(raw) as number[]);
  } catch {}
  return new Set(LETTERS.map(l => l.pos));
}

function saveSelection(sel: Set<number>) {
  localStorage.setItem(SELECTION_KEY, JSON.stringify([...sel]));
}

export function SelectScreen({ onStart, onHome }: Props) {
  const [selected, setSelected] = useState<Set<number>>(loadSelection);
  const [mode, setMode] = useState<QuizMode>('type');
  const [direction, setDirection] = useState<QuizDirection>('ar2en');

  useEffect(() => {
    saveSelection(selected);
  }, [selected]);

  const toggle = (pos: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(pos)) next.delete(pos);
      else next.add(pos);
      return next;
    });
  };

  const selectGroup = (letters: Letter[]) => {
    setSelected(new Set(letters.map(l => l.pos)));
  };

  const selectedLetters = LETTERS.filter(l => selected.has(l.pos));

  return (
    <div className="min-h-screen bg-bg pb-8">
      <div className="max-w-lg mx-auto px-4 pt-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          {onHome && (
            <button
              onClick={onHome}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-border text-muted hover:text-ink transition-colors"
            >
              ←
            </button>
          )}
          <h2 className="font-display text-3xl text-ink">Select letters</h2>
        </div>

        {/* Group pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => selectGroup(LETTERS)}
            className="px-3 py-1.5 rounded-full font-mono text-xs border-2 border-ink bg-ink text-surface min-h-[36px]"
          >
            All
          </button>
          <button
            onClick={() => selectGroup(SUN_LETTERS)}
            className="px-3 py-1.5 rounded-full font-mono text-xs border-2 border-border text-muted hover:border-ink hover:text-ink transition-colors min-h-[36px]"
          >
            Sun
          </button>
          <button
            onClick={() => selectGroup(MOON_LETTERS)}
            className="px-3 py-1.5 rounded-full font-mono text-xs border-2 border-border text-muted hover:border-ink hover:text-ink transition-colors min-h-[36px]"
          >
            Moon
          </button>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setSelected(new Set(LETTERS.map(l => l.pos)))}
              className="font-mono text-xs text-muted hover:text-ink transition-colors min-h-[36px] px-2"
            >
              Select all
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="font-mono text-xs text-muted hover:text-ink transition-colors min-h-[36px] px-2"
            >
              Clear
            </button>
          </div>
        </div>

        <LetterGrid letters={LETTERS} selected={selected} onToggle={toggle} />

        <ModePills
          mode={mode}
          onMode={setMode}
          direction={direction}
          onDirection={setDirection}
        />

        <button
          onClick={() => selectedLetters.length > 0 && onStart(selectedLetters, mode, direction)}
          disabled={selectedLetters.length === 0}
          className="w-full min-h-[52px] rounded-xl bg-ink text-surface font-mono text-sm font-medium hover:bg-ink/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Start with {selectedLetters.length} letter{selectedLetters.length !== 1 ? 's' : ''} →
        </button>
      </div>
    </div>
  );
}
