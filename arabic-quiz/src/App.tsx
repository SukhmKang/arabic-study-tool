import { useState, useEffect } from 'react';
import { Letter } from '@/data/letters';
import { useQuiz, QuizMode, QuizDirection } from '@/hooks/useQuiz';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { SelectScreen } from '@/screens/SelectScreen';
import { QuizScreen } from '@/screens/QuizScreen';
import { DoneScreen } from '@/screens/DoneScreen';

type Screen = 'select' | 'quiz' | 'done';

export default function App() {
  const [screen, setScreen] = useState<Screen>('select');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedLetters, setSelectedLetters] = useState<Letter[]>([]);

  const quiz = useQuiz();

  const handleStart = (letters: Letter[], mode: QuizMode, direction: QuizDirection) => {
    setSelectedLetters(letters);
    quiz.startQuiz(letters, mode, direction);
    setScreen('quiz');
  };

  const handleNext = () => {
    quiz.nextCard();
  };

  // Transition to done when quiz finishes
  useEffect(() => {
    if (screen === 'quiz' && quiz.isDone) {
      setScreen('done');
    }
  }, [screen, quiz.isDone]);

  return (
    <div className="font-mono">
      {/* Gear icon — fixed top-right on all screens except settings */}
      {!showSettings && (
        <button
          onClick={() => setShowSettings(true)}
          className="fixed top-4 right-4 z-50 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-surface border border-border shadow-sm text-muted hover:text-ink transition-colors"
          aria-label="Settings"
        >
          ⚙
        </button>
      )}

      {/* Settings overlay */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-bg/95 backdrop-blur-sm flex flex-col items-center justify-center px-4">
          <button
            onClick={() => setShowSettings(false)}
            className="absolute top-4 right-4 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full border border-border text-muted hover:text-ink"
          >
            ✕
          </button>
          <SettingsScreen />
        </div>
      )}

      {/* Screens */}
      {screen === 'select' && !showSettings && (
        <SelectScreen onStart={handleStart} />
      )}
      {screen === 'quiz' && !showSettings && !quiz.isDone && (
        <QuizScreen
          current={quiz.current}
          index={quiz.index}
          total={quiz.total}
          correctCount={quiz.correctCount}
          wrongCount={quiz.wrongCount}
          mode={quiz.mode}
          direction={quiz.direction}
          cardDirection={quiz.cardDirection}
          answered={quiz.answered}
          isCorrect={quiz.isCorrect}
          selectedLetters={selectedLetters}
          onSubmit={quiz.submitAnswer}
          onSkip={quiz.skipCard}
          onNext={handleNext}
          onExit={() => setScreen('select')}
        />
      )}
      {screen === 'done' && !showSettings && (
        <DoneScreen
          correctCount={quiz.correctCount}
          total={quiz.total}
          missed={quiz.missed}
          onStartAgain={() => {
            quiz.startQuiz(selectedLetters, quiz.mode, quiz.direction);
            setScreen('quiz');
          }}
          onReviewMissed={() => {
            quiz.restartMissed();
            setScreen('quiz');
          }}
          onChangeLetters={() => setScreen('select')}
        />
      )}
    </div>
  );
}
