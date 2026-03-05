interface Props {
  correct: number;
  wrong: number;
  mode: string;
}

export function ScoreChips({ correct, wrong, mode }: Props) {
  return (
    <div className="flex items-center gap-2 font-mono text-sm">
      <span className="px-2 py-0.5 rounded-full bg-success-light text-success font-medium">
        ✓ {correct}
      </span>
      <span className="px-2 py-0.5 rounded-full bg-accent-light text-accent font-medium">
        ✗ {wrong}
      </span>
      <span className="ml-auto px-2 py-0.5 rounded-full bg-border text-muted text-xs uppercase tracking-wide">
        {mode}
      </span>
    </div>
  );
}
