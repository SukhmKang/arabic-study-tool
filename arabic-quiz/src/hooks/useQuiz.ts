import { useState, useCallback } from 'react';
import { Letter } from '@/data/letters';
import { shuffle, normaliseAnswer } from '@/lib/quiz';

export type QuizMode = 'type' | 'draw';
export type QuizDirection = 'ar2en' | 'en2ar' | 'random';

interface QuizState {
  deck: Letter[];
  index: number;
  correctCount: number;
  wrongCount: number;
  missed: Letter[];
  answered: boolean;
  isCorrect: boolean | null;
  total: number;
  mode: QuizMode;
  direction: QuizDirection;
}

const initial: QuizState = {
  deck: [],
  index: 0,
  correctCount: 0,
  wrongCount: 0,
  missed: [],
  answered: false,
  isCorrect: null,
  total: 0,
  mode: 'type',
  direction: 'ar2en',
};

export function useQuiz() {
  const [state, setState] = useState<QuizState>(initial);

  const current = state.deck[state.index] ?? null;

  const resolvedDirection = useCallback(
    (letter: Letter | null): 'ar2en' | 'en2ar' => {
      if (!letter) return 'ar2en';
      if (state.direction === 'random') return Math.random() < 0.5 ? 'ar2en' : 'en2ar';
      return state.direction;
    },
    [state.direction],
  );

  // Per-card effective direction (stable once card is shown)
  const [cardDirection, setCardDirection] = useState<'ar2en' | 'en2ar'>('ar2en');

  const startQuiz = useCallback((letters: Letter[], mode: QuizMode, direction: QuizDirection) => {
    const deck = shuffle(letters);
    const dir = direction === 'random' ? (Math.random() < 0.5 ? 'ar2en' : 'en2ar') : direction;
    setState({
      deck,
      index: 0,
      correctCount: 0,
      wrongCount: 0,
      missed: [],
      answered: false,
      isCorrect: null,
      total: deck.length,
      mode,
      direction,
    });
    setCardDirection(dir);
  }, []);

  const submitAnswer = useCallback((answer: string | boolean) => {
    setState(prev => {
      const letter = prev.deck[prev.index];
      if (!letter || prev.answered) return prev;

      let correct: boolean;
      if (typeof answer === 'boolean') {
        correct = answer;
      } else {
        const norm = normaliseAnswer(answer);
        correct = letter.accepted.includes(norm);
      }

      return {
        ...prev,
        answered: true,
        isCorrect: correct,
        correctCount: correct ? prev.correctCount + 1 : prev.correctCount,
        wrongCount: correct ? prev.wrongCount : prev.wrongCount + 1,
        missed: correct ? prev.missed : [...prev.missed, letter],
      };
    });
  }, []);

  const skipCard = useCallback(() => {
    setState(prev => {
      const letter = prev.deck[prev.index];
      if (!letter || prev.answered) return prev;
      return {
        ...prev,
        answered: true,
        isCorrect: false,
        wrongCount: prev.wrongCount + 1,
        missed: [...prev.missed, letter],
      };
    });
  }, []);

  const nextCard = useCallback((direction: QuizDirection) => {
    setState(prev => {
      const nextIndex = prev.index + 1;
      return { ...prev, index: nextIndex, answered: false, isCorrect: null };
    });
    const dir = direction === 'random' ? (Math.random() < 0.5 ? 'ar2en' : 'en2ar') : direction;
    setCardDirection(dir as 'ar2en' | 'en2ar');
  }, []);

  const restartMissed = useCallback(() => {
    setState(prev => {
      const deck = shuffle(prev.missed);
      const dir = prev.direction === 'random' ? (Math.random() < 0.5 ? 'ar2en' : 'en2ar') : prev.direction;
      setCardDirection(dir as 'ar2en' | 'en2ar');
      return {
        ...prev,
        deck,
        index: 0,
        correctCount: 0,
        wrongCount: 0,
        missed: [],
        answered: false,
        isCorrect: null,
        total: deck.length,
      };
    });
  }, []);

  const isDone = state.deck.length > 0 && state.index >= state.deck.length;

  return {
    ...state,
    current,
    cardDirection,
    isDone,
    effectiveDirection: resolvedDirection,
    startQuiz,
    submitAnswer,
    skipCard,
    nextCard: () => nextCard(state.direction),
    restartMissed,
  };
}
