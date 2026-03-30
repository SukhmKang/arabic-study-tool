import { useState, useCallback } from 'react';
import { buildWordPool, type PoolEntry, type UnitKey, type WordResult } from '@/data/vocab';
import { ConnectedFormsSelectScreen, type ConnectedFormsMode, type AnswerMode, type VocabDirection } from './ConnectedFormsSelectScreen';
import { IdentifyScreen } from './IdentifyScreen';
import { BuildMCScreen } from './BuildMCScreen';
import { BuildDrawScreen } from './BuildDrawScreen';
import { VocabMCScreen } from './VocabMCScreen';
import { VocabDoneScreen } from './VocabDoneScreen';

type CFScreen = 'select' | 'identify' | 'build-mc' | 'build-draw' | 'vocab' | 'done';

interface Props {
  onHome: () => void;
}

export function ConnectedFormsApp({ onHome }: Props) {
  const [screen, setScreen] = useState<CFScreen>('select');
  const [mode, setMode] = useState<ConnectedFormsMode>('identify');
  const [answerMode, setAnswerMode] = useState<AnswerMode>('romanization');
  const [vocabDirection, setVocabDirection] = useState<VocabDirection>('en2ar');
  const [selectedUnits, setSelectedUnits] = useState<UnitKey[]>(['unit1']);
  const [wordPool, setWordPool] = useState<PoolEntry[]>([]);
  const [results, setResults] = useState<WordResult[]>([]);

  const handleStart = useCallback((m: ConnectedFormsMode, am: AnswerMode, units: UnitKey[], vd: VocabDirection) => {
    setMode(m);
    setAnswerMode(am);
    setVocabDirection(vd);
    setSelectedUnits(units);
    const pool = buildWordPool(units);
    setWordPool(pool);
    setScreen(m === 'identify' ? 'identify' : m === 'build-mc' ? 'build-mc' : m === 'build-draw' ? 'build-draw' : 'vocab');
  }, []);

  const handleDone = useCallback((rs: WordResult[]) => {
    setResults(rs);
    setScreen('done');
  }, []);

  const handleStartAgain = useCallback(() => {
    const pool = buildWordPool(selectedUnits);
    setWordPool(pool);
    setScreen(mode === 'identify' ? 'identify' : mode === 'build-mc' ? 'build-mc' : mode === 'build-draw' ? 'build-draw' : 'vocab');
  }, [mode, selectedUnits]);

  const handleExit = useCallback(() => {
    setScreen('select');
  }, []);

  if (screen === 'select') {
    return <ConnectedFormsSelectScreen onStart={handleStart} onBack={onHome} />;
  }

  if (screen === 'identify') {
    return (
      <IdentifyScreen
        wordPool={wordPool}
        answerMode={answerMode}
        onDone={handleDone}
        onExit={handleExit}
      />
    );
  }

  if (screen === 'build-mc') {
    return (
      <BuildMCScreen
        wordPool={wordPool}
        onDone={handleDone}
        onExit={handleExit}
      />
    );
  }

  if (screen === 'build-draw') {
    return (
      <BuildDrawScreen
        wordPool={wordPool}
        onDone={handleDone}
        onExit={handleExit}
      />
    );
  }

  if (screen === 'vocab') {
    return (
      <VocabMCScreen
        wordPool={wordPool}
        direction={vocabDirection}
        onDone={handleDone}
        onExit={handleExit}
      />
    );
  }

  return (
    <VocabDoneScreen
      results={results}
      onStartAgain={handleStartAgain}
      onChangeSettings={() => setScreen('select')}
    />
  );
}
