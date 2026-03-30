import { useState, useEffect } from 'react';
import { UNIT_KEYS, UNIT_LABELS, VOCAB, wordCount, type UnitKey } from '@/data/vocab';

export type ConnectedFormsMode = 'identify' | 'build-mc' | 'build-draw' | 'vocab';
export type AnswerMode = 'romanization' | 'arabic';
export type VocabDirection = 'en2ar' | 'ar2en';

interface Props {
  onStart: (mode: ConnectedFormsMode, answerMode: AnswerMode, units: UnitKey[], vocabDirection: VocabDirection) => void;
  onBack: () => void;
}

const STORAGE_KEY = 'arabic-cf-selected-units';
const PREFS_KEY = 'arabic-cf-prefs';

interface SavedPrefs {
  mode?: ConnectedFormsMode;
  answerMode?: AnswerMode;
  vocabDirection?: VocabDirection;
}

function loadSavedUnits(): UnitKey[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as UnitKey[];
    return saved.filter(u => UNIT_KEYS.includes(u));
  } catch {
    return [];
  }
}

function loadSavedPrefs(): SavedPrefs {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as SavedPrefs;
  } catch {
    return {};
  }
}

export function ConnectedFormsSelectScreen({ onStart, onBack }: Props) {
  const [mode, setMode] = useState<ConnectedFormsMode>(() => loadSavedPrefs().mode ?? 'identify');
  const [answerMode, setAnswerMode] = useState<AnswerMode>(() => loadSavedPrefs().answerMode ?? 'romanization');
  const [vocabDirection, setVocabDirection] = useState<VocabDirection>(() => loadSavedPrefs().vocabDirection ?? 'en2ar');
  const [selectedUnits, setSelectedUnits] = useState<UnitKey[]>(() => {
    const saved = loadSavedUnits();
    return saved.length > 0 ? saved : ['unit1'];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedUnits));
  }, [selectedUnits]);

  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ mode, answerMode, vocabDirection }));
  }, [mode, answerMode, vocabDirection]);

  const toggleUnit = (unit: UnitKey) => {
    setSelectedUnits(prev =>
      prev.includes(unit) ? prev.filter(u => u !== unit) : [...prev, unit]
    );
  };

  const count = wordCount(selectedUnits);

  const MODES: { value: ConnectedFormsMode; label: string; sub: string }[] = [
    { value: 'vocab', label: 'Vocab', sub: 'Meaning → word' },
    { value: 'identify', label: 'Identify', sub: 'Which letter is this?' },
    { value: 'build-mc', label: 'Build', sub: 'Letters → word' },
    { value: 'build-draw', label: 'Draw', sub: 'Write the word' },
  ];

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-lg mx-auto px-4 pt-4 pb-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-border text-muted hover:text-ink transition-colors"
          >
            ←
          </button>
          <div>
            <h1 className="font-display text-2xl text-ink">Connected Forms</h1>
            <p className="font-mono text-xs text-muted">Vocabulary practice</p>
          </div>
        </div>

        {/* Mode selection */}
        <div>
          <p className="font-mono text-xs text-muted mb-2 uppercase tracking-wide">Mode</p>
          <div className="grid grid-cols-2 gap-2">
            {MODES.map(m => (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                className={`min-h-[64px] rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-colors px-2 ${
                  mode === m.value
                    ? 'bg-ink text-surface border-ink'
                    : 'bg-surface text-ink border-border hover:border-muted'
                }`}
              >
                <span className="font-mono text-sm font-medium">{m.label}</span>
                <span className={`font-mono text-xs ${mode === m.value ? 'text-surface/60' : 'text-muted'}`}>
                  {m.sub}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Answer mode (identify only) */}
        {mode === 'identify' && (
          <div>
            <p className="font-mono text-xs text-muted mb-2 uppercase tracking-wide">Answer with</p>
            <div className="flex gap-2">
              {(['romanization', 'arabic'] as AnswerMode[]).map(am => (
                <button
                  key={am}
                  onClick={() => setAnswerMode(am)}
                  className={`flex-1 min-h-[44px] rounded-xl border-2 font-mono text-sm transition-colors ${
                    answerMode === am
                      ? 'bg-ink text-surface border-ink'
                      : 'bg-surface text-ink border-border hover:border-muted'
                  }`}
                >
                  {am === 'romanization' ? 'Romanization' : 'Arabic alphabet'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Direction (vocab only) */}
        {mode === 'vocab' && (
          <div>
            <p className="font-mono text-xs text-muted mb-2 uppercase tracking-wide">Direction</p>
            <div className="flex gap-2">
              {([['en2ar', 'English → Arabic'], ['ar2en', 'Arabic → English']] as [VocabDirection, string][]).map(([dir, label]) => (
                <button
                  key={dir}
                  onClick={() => setVocabDirection(dir)}
                  className={`flex-1 min-h-[44px] rounded-xl border-2 font-mono text-sm transition-colors ${
                    vocabDirection === dir
                      ? 'bg-ink text-surface border-ink'
                      : 'bg-surface text-ink border-border hover:border-muted'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Unit selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="font-mono text-xs text-muted uppercase tracking-wide">Units</p>
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedUnits([...UNIT_KEYS])}
                className="font-mono text-xs text-muted hover:text-ink transition-colors"
              >
                Select all
              </button>
              <button
                onClick={() => setSelectedUnits([])}
                className="font-mono text-xs text-muted hover:text-ink transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {UNIT_KEYS.map(unit => {
              const selected = selectedUnits.includes(unit);
              const wc = VOCAB[unit].length;
              return (
                <button
                  key={unit}
                  onClick={() => toggleUnit(unit)}
                  className={`min-h-[64px] rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                    selected
                      ? 'bg-ink text-surface border-ink'
                      : 'bg-surface text-ink border-border hover:border-muted'
                  }`}
                >
                  <span className="font-mono text-sm font-medium">{UNIT_LABELS[unit]}</span>
                  <span className={`font-mono text-xs ${selected ? 'text-surface/60' : 'text-muted'}`}>
                    {wc} words
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Start button */}
        <button
          disabled={selectedUnits.length === 0}
          onClick={() => onStart(mode, answerMode, selectedUnits, vocabDirection)}
          className="w-full min-h-[52px] rounded-xl bg-ink text-surface font-mono text-sm font-medium hover:bg-ink/90 transition-colors disabled:opacity-40"
        >
          {selectedUnits.length === 0
            ? 'Select at least one unit'
            : `Start with ${count} word${count !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}
