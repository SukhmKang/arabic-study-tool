import { useState, useEffect, useCallback } from 'react';
import { LETTERS } from '@/data/letters';
import { speakArabic } from '@/lib/audio';
import { splitIntoGlyphs, type ArabicGlyph, type PoolEntry, type WordResult } from '@/data/vocab';
import type { AnswerMode } from './ConnectedFormsSelectScreen';

interface Props {
  wordPool: PoolEntry[];
  answerMode: AnswerMode;
  onDone: (results: WordResult[]) => void;
  onExit: () => void;
}

type GlyphPhase = 'question' | 'feedback';
type WordPhase = 'glyphs' | 'summary';

export function IdentifyScreen({ wordPool, answerMode, onDone, onExit }: Props) {
  const [wordIdx, setWordIdx] = useState(0);
  const [glyphs, setGlyphs] = useState<ArabicGlyph[]>([]);
  const [glyphIdx, setGlyphIdx] = useState(0);
  const [glyphPhase, setGlyphPhase] = useState<GlyphPhase>('question');
  const [wordPhase, setWordPhase] = useState<WordPhase>('glyphs');
  const [selectedPos, setSelectedPos] = useState<number | null>(null);
  const [wordGlyphCorrects, setWordGlyphCorrects] = useState<boolean[]>([]);
  const [sessionResults, setSessionResults] = useState<WordResult[]>([]);

  // Build glyphs for the current word
  useEffect(() => {
    if (wordIdx >= wordPool.length) return;
    const entry = wordPool[wordIdx].entry;
    const g = splitIntoGlyphs(entry.arabic);
    setGlyphs(g);
    setGlyphIdx(0);
    setGlyphPhase('question');
    setWordPhase('glyphs');
    setSelectedPos(null);
    setWordGlyphCorrects([]);
  }, [wordIdx, wordPool]);

  const currentWord = wordPool[wordIdx];
  const currentGlyph: ArabicGlyph | undefined = glyphs[glyphIdx];
  const isLastGlyph = glyphIdx === glyphs.length - 1;
  const isLastWord = wordIdx === wordPool.length - 1;

  const handleAnswer = useCallback((letterPos: number) => {
    if (glyphPhase !== 'question' || !currentGlyph) return;
    const correct = letterPos === currentGlyph.letterPos;
    setSelectedPos(letterPos);
    setGlyphPhase('feedback');
    setWordGlyphCorrects(prev => [...prev, correct]);
  }, [glyphPhase, currentGlyph]);

  const handleNextGlyph = useCallback(() => {
    if (isLastGlyph) {
      setWordPhase('summary');
    } else {
      setGlyphIdx(i => i + 1);
      setGlyphPhase('question');
      setSelectedPos(null);
    }
  }, [isLastGlyph]);

  const handleNextWord = useCallback(() => {
    if (!currentWord) return;
    const correct = wordGlyphCorrects.filter(Boolean).length;
    const total = wordGlyphCorrects.length;
    const result: WordResult = {
      entry: currentWord.entry,
      unit: currentWord.unit,
      correct,
      total,
    };
    const newResults = [...sessionResults, result];
    setSessionResults(newResults);

    if (isLastWord) {
      onDone(newResults);
    } else {
      setWordIdx(i => i + 1);
    }
  }, [currentWord, wordGlyphCorrects, sessionResults, isLastWord, onDone]);

  // Skip words that have no identifiable glyphs (e.g. punctuation-only entries)
  useEffect(() => {
    if (glyphs.length === 0 && wordPool.length > 0) {
      if (wordIdx < wordPool.length - 1) {
        setWordIdx(i => i + 1);
      } else {
        onDone(sessionResults);
      }
    }
  }, [glyphs.length, wordIdx, wordPool.length, sessionResults, onDone]);

  if (!currentWord || glyphs.length === 0) return null;

  const correctLetter = currentGlyph ? LETTERS.find(l => l.pos === currentGlyph.letterPos) : null;
  const selectedLetter = selectedPos !== null ? LETTERS.find(l => l.pos === selectedPos) : null;
  const wasCorrect = selectedPos !== null && selectedPos === (currentGlyph?.letterPos ?? -1);
  const wordGlyphsCorrect = wordGlyphCorrects.filter(Boolean).length;

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-lg mx-auto px-4 pt-4 pb-8 flex flex-col gap-4">
        {/* Progress + exit */}
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-muted">
            Word {wordIdx + 1} / {wordPool.length}
          </span>
          <button
            onClick={onExit}
            className="min-h-[44px] rounded-xl border border-border px-3 font-mono text-xs text-muted hover:border-muted hover:text-ink transition-colors"
          >
            Exit
          </button>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-ink rounded-full transition-all"
            style={{ width: `${((wordIdx) / wordPool.length) * 100}%` }}
          />
        </div>

        {wordPhase === 'glyphs' ? (
          <>
            {/* Word display */}
            <div className="bg-surface rounded-2xl border border-border p-6 flex flex-col items-center gap-4">
              <p className="font-mono text-xs text-muted">Identify the highlighted letter</p>

              {/* Full word with highlighted glyph */}
              <div dir="rtl" className="font-arabic text-6xl text-center leading-relaxed">
                {glyphs.map((g, i) => (
                  <span
                    key={i}
                    className={
                      i === glyphIdx
                        ? 'text-ink border-b-4 border-accent'
                        : i < glyphIdx && glyphPhase === 'question'
                        ? 'text-success/70'
                        : 'text-muted/50'
                    }
                  >
                    {g.display}
                  </span>
                ))}
              </div>

              {/* Letter position indicators */}
              <div dir="rtl" className="flex justify-center gap-1.5">
                {glyphs.map((_, i) => (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-sm transition-colors ${
                      i < glyphIdx
                        ? 'bg-success'
                        : i === glyphIdx
                        ? 'bg-ink'
                        : 'bg-border'
                    }`}
                  />
                ))}
              </div>

              <p className="font-mono text-xs text-muted">
                Letter {glyphIdx + 1} of {glyphs.length}
              </p>
            </div>

            {/* Feedback area */}
            {glyphPhase === 'feedback' && correctLetter && (
              <div
                className={`rounded-2xl border p-4 flex flex-col gap-3 ${
                  wasCorrect
                    ? 'bg-success-light border-success'
                    : 'bg-accent-light border-accent'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="text-center min-w-[60px]">
                    <p dir="rtl" className="font-arabic text-5xl leading-none">{correctLetter.arabic}</p>
                  </div>
                  <div>
                    {wasCorrect ? (
                      <p className="font-mono text-sm text-success font-medium">Correct!</p>
                    ) : (
                      <p className="font-mono text-sm text-accent font-medium">
                        You chose: {selectedLetter?.name ?? '?'}
                      </p>
                    )}
                    <p className="font-mono text-base text-ink font-medium">{correctLetter.name}</p>
                    <p className="font-mono text-xs text-muted">{correctLetter.roman}</p>
                  </div>
                </div>
                <button
                  onClick={handleNextGlyph}
                  className="w-full min-h-[44px] rounded-xl bg-ink text-surface font-mono text-sm font-medium hover:bg-ink/90 transition-colors"
                >
                  {isLastGlyph ? 'See word summary →' : 'Next letter →'}
                </button>
              </div>
            )}

            {/* Answer grid */}
            {glyphPhase === 'question' && (
              <div className="grid grid-cols-4 gap-2">
                {LETTERS.map(letter => (
                  <button
                    key={letter.pos}
                    onClick={() => handleAnswer(letter.pos)}
                    className="min-h-[48px] rounded-xl border-2 border-border bg-surface hover:border-muted transition-colors flex items-center justify-center"
                  >
                    {answerMode === 'arabic' ? (
                      <span className="font-arabic text-2xl">{letter.arabic}</span>
                    ) : (
                      <span className="font-mono text-xs">{letter.name}</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Answered grid (shows correct/wrong highlights) */}
            {glyphPhase === 'feedback' && currentGlyph && (
              <div className="grid grid-cols-4 gap-2">
                {LETTERS.map(letter => {
                  const isCorrectCell = letter.pos === currentGlyph.letterPos;
                  const isSelectedCell = letter.pos === selectedPos;
                  return (
                    <div
                      key={letter.pos}
                      className={`min-h-[48px] rounded-xl border-2 flex items-center justify-center ${
                        isCorrectCell
                          ? 'bg-success border-success'
                          : isSelectedCell && !isCorrectCell
                          ? 'bg-accent border-accent'
                          : 'border-border bg-surface opacity-50'
                      }`}
                    >
                      {answerMode === 'arabic' ? (
                        <span className={`font-arabic text-2xl ${isCorrectCell || isSelectedCell ? 'text-white' : ''}`}>
                          {letter.arabic}
                        </span>
                      ) : (
                        <span className={`font-mono text-xs ${isCorrectCell || isSelectedCell ? 'text-white' : ''}`}>
                          {letter.name}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* Word summary */
          <div className="bg-surface rounded-2xl border border-border p-6 flex flex-col gap-4">
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-3">
                <p dir="rtl" className="font-arabic text-5xl text-ink">{currentWord.entry.arabic}</p>
                <button
                  onClick={() => speakArabic(currentWord.entry.arabic)}
                  className="min-h-[36px] min-w-[36px] rounded-full border border-border bg-surface text-muted hover:text-ink transition-colors flex items-center justify-center"
                  aria-label="Hear pronunciation"
                >
                  ♪
                </button>
              </div>
              <p className="font-mono text-sm text-muted">{currentWord.entry.translation}</p>
            </div>

            <div className={`rounded-xl border p-3 text-center ${
              wordGlyphsCorrect === glyphs.length
                ? 'bg-success-light border-success'
                : wordGlyphsCorrect >= glyphs.length / 2
                ? 'bg-warning-light border-warning'
                : 'bg-accent-light border-accent'
            }`}>
              <p className="font-mono text-sm font-medium text-ink">
                {wordGlyphsCorrect === glyphs.length
                  ? 'All letters correct!'
                  : `${wordGlyphsCorrect} / ${glyphs.length} letters correct`}
              </p>
            </div>

            <button
              onClick={handleNextWord}
              className="w-full min-h-[48px] rounded-xl bg-ink text-surface font-mono text-sm font-medium hover:bg-ink/90 transition-colors"
            >
              {isLastWord ? 'See results' : 'Next word →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
