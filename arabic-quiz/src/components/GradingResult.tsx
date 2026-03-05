import type { Letter } from '@/data/letters';
import type { GradeResult } from '@/lib/grading';

interface Props {
  result: GradeResult;
  letter: Letter;
  studentImageSrc: string;
  onNext: () => void;
}

const VERDICT_STYLES = {
  excellent: 'bg-success-light text-success',
  good: 'bg-success-light text-success',
  close: 'bg-warning-light text-warning',
  incorrect: 'bg-accent-light text-accent',
} as const;

const VERDICT_LABELS = {
  excellent: 'excellent',
  good: 'good',
  close: 'close',
  incorrect: 'incorrect',
} as const;

export function GradingResult({ result, letter, studentImageSrc, onNext }: Props) {
  const referenceSrc = result.reference_image ? `data:image/png;base64,${result.reference_image}` : null;

  return (
    <div className="flex w-full flex-col gap-4">
      <div className={`self-start rounded-full px-3 py-1 font-mono text-xs uppercase tracking-widest ${VERDICT_STYLES[result.score]}`}>
        {VERDICT_LABELS[result.score]}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col items-center gap-1">
          <div className="flex h-36 w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-white p-2">
            <img src={studentImageSrc} alt="Your attempt" className="h-full w-full object-contain" />
          </div>
          <span className="font-mono text-xs text-muted">Your attempt</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          {referenceSrc ? (
            <div className="flex h-36 w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-white p-2">
              <img src={referenceSrc} alt="Reference" className="h-full w-full object-contain" />
            </div>
          ) : (
            <div className="flex h-36 w-full items-center justify-center rounded-lg border border-border bg-white">
              <span className="font-arabic text-7xl text-ink">{letter.arabic}</span>
            </div>
          )}
          <span className="font-mono text-xs text-muted">Reference</span>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-ink">{result.feedback}</p>

      <button
        onClick={onNext}
        className="w-full rounded-xl bg-ink py-3 font-mono text-sm uppercase tracking-wide text-surface transition hover:bg-ink/90"
      >
        Next →
      </button>
    </div>
  );
}
