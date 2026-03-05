import { QuizMode, QuizDirection } from '@/hooks/useQuiz';

interface ModePillsProps {
  mode: QuizMode;
  onMode: (m: QuizMode) => void;
  direction: QuizDirection;
  onDirection: (d: QuizDirection) => void;
}

const MODES: { value: QuizMode; label: string }[] = [
  { value: 'type', label: 'Type' },
  { value: 'draw', label: 'Draw' },
];

const DIRECTIONS: { value: QuizDirection; label: string }[] = [
  { value: 'ar2en', label: 'Arabic → Name' },
  { value: 'en2ar', label: 'Name → Arabic' },
  { value: 'random', label: 'Random' },
];

export function ModePills({ mode, onMode, direction, onDirection }: ModePillsProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {MODES.map(m => (
          <button
            key={m.value}
            onClick={() => onMode(m.value)}
            className={`
              px-4 py-2 rounded-full font-mono text-sm font-medium transition-all min-h-[44px]
              ${mode === m.value
                ? 'bg-ink text-surface'
                : 'bg-border text-muted hover:text-ink'
              }
            `}
          >
            {m.label}
          </button>
        ))}
      </div>
      {mode === 'type' && (
        <div className="flex flex-wrap gap-2">
          {DIRECTIONS.map(d => (
            <button
              key={d.value}
              onClick={() => onDirection(d.value)}
              className={`
                px-3 py-1.5 rounded-full font-mono text-xs font-medium transition-all min-h-[36px]
                ${direction === d.value
                  ? 'bg-accent text-surface'
                  : 'bg-accent-light text-accent hover:bg-accent hover:text-surface'
                }
              `}
            >
              {d.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
