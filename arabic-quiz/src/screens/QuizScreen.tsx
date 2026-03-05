import { useEffect, useRef } from 'react';
import { Letter } from '@/data/letters';
import { QuizMode, QuizDirection } from '@/hooks/useQuiz';
import { ProgressBar } from '@/components/ProgressBar';
import { ScoreChips } from '@/components/ScoreChips';
import { LetterCard } from '@/components/LetterCard';
import { playAudio } from '@/lib/audio';

interface Props {
  current: Letter | null;
  index: number;
  total: number;
  correctCount: number;
  wrongCount: number;
  mode: QuizMode;
  direction: QuizDirection;
  cardDirection: 'ar2en' | 'en2ar';
  answered: boolean;
  isCorrect: boolean | null;
  selectedLetters: Letter[];
  onSubmit: (answer: string | boolean) => void;
  onSkip: () => void;
  onNext: () => void;
  onExit: () => void;
}

export function QuizScreen({
  current,
  index,
  total,
  correctCount,
  wrongCount,
  mode,
  cardDirection,
  answered,
  isCorrect,
  selectedLetters,
  onSubmit,
  onSkip,
  onNext,
  onExit,
}: Props) {
  const lastSlugRef = useRef<string | null>(null);

  useEffect(() => {
    if (current && current.slug !== lastSlugRef.current) {
      lastSlugRef.current = current.slug;
      playAudio(current.slug, 'names');
    }
  }, [current]);

  // Auto-advance after feedback
  useEffect(() => {
    if (!answered || !current) return;
    const delay = isCorrect ? 1300 : 1800;
    // Only auto-advance in type mode
    if (mode !== 'type') return;
    const timer = setTimeout(onNext, delay);
    return () => clearTimeout(timer);
  }, [answered, isCorrect, mode, current, onNext]);

  if (!current) return null;

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-lg mx-auto px-4 pt-4 pb-8 flex flex-col gap-4">
        <ProgressBar current={index} total={total} />
        <div className="flex justify-end">
          <button
            onClick={onExit}
            className="min-h-[44px] rounded-xl border border-border px-3 py-1 font-mono text-xs text-muted transition-colors hover:border-muted hover:text-ink"
          >
            End Quiz
          </button>
        </div>
        <ScoreChips correct={correctCount} wrong={wrongCount} mode={mode} />
        <p className="font-mono text-xs text-muted text-right">
          {index + 1} / {total}
        </p>
        <LetterCard
          letter={current}
          mode={mode}
          direction={cardDirection}
          selectedLetters={selectedLetters}
          answered={answered}
          isCorrect={isCorrect}
          onSubmit={onSubmit}
          onSkip={onSkip}
          onNext={onNext}
        />
      </div>
    </div>
  );
}
