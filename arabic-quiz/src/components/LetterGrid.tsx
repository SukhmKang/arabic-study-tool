import { Letter } from '@/data/letters';

interface Props {
  letters: Letter[];
  selected: Set<number>;
  onToggle: (pos: number) => void;
}

export function LetterGrid({ letters, selected, onToggle }: Props) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {letters.map(letter => {
        const isSelected = selected.has(letter.pos);
        return (
          <button
            key={letter.pos}
            onClick={() => onToggle(letter.pos)}
            className={`
              min-h-[72px] rounded-xl border-2 flex flex-col items-center justify-center gap-1
              transition-all duration-150 font-mono
              ${isSelected
                ? 'bg-ink border-ink text-surface'
                : 'bg-surface border-border text-ink hover:border-muted'
              }
            `}
          >
            <span className="font-arabic text-2xl leading-none" dir="rtl">{letter.arabic}</span>
            <span className="text-xs opacity-70">{letter.name}</span>
          </button>
        );
      })}
    </div>
  );
}
