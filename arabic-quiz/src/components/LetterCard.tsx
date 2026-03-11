import { useEffect, useMemo, useRef, useState } from 'react';
import { Letter } from '@/data/letters';
import { AudioButtons } from './AudioButtons';
import { QuizMode } from '@/hooks/useQuiz';
import { DrawCanvas, type DrawCanvasRef } from '@/components/DrawCanvas';
import { useGrading } from '@/hooks/useGrading';
import { checkServerHealth, type GradeResult } from '@/lib/grading';
import { GradingOverlay } from '@/components/GradingOverlay';
import { GradingResult } from '@/components/GradingResult';

interface Props {
  letter: Letter;
  mode: QuizMode;
  direction: 'ar2en' | 'en2ar';
  selectedLetters: Letter[];
  answered: boolean;
  isCorrect: boolean | null;
  unlocked: boolean;
  onSubmit: (answer: string | boolean) => void;
  onSkip: () => void;
  onNext: () => void;
}

export function LetterCard({
  letter,
  mode,
  direction,
  selectedLetters,
  answered,
  isCorrect,
  unlocked,
  onSubmit,
  onSkip,
  onNext,
}: Props) {
  const [inputValue, setInputValue] = useState('');
  const [serverReachable, setServerReachable] = useState(true);
  const [checkingServer, setCheckingServer] = useState(false);
  const [studentImageSrc, setStudentImageSrc] = useState<string>('');
  const [localResult, setLocalResult] = useState<GradeResult | null>(null);
  const [online, setOnline] = useState<boolean>(() => navigator.onLine);
  const [showRomanizationHint, setShowRomanizationHint] = useState(false);
  const [selfGrading, setSelfGrading] = useState(false);
  const [selfGraded, setSelfGraded] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const drawRef = useRef<DrawCanvasRef>(null);

  const { grade, status, result, error, reset } = useGrading();

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const checkHealth = async () => {
    setCheckingServer(true);
    const ok = await checkServerHealth();
    setServerReachable(ok);
    setCheckingServer(false);
  };

  useEffect(() => {
    setInputValue('');
    setLocalResult(null);
    setStudentImageSrc('');
    setShowRomanizationHint(false);
    setSelfGrading(false);
    setSelfGraded(false);
    reset();

    if (mode === 'type' && direction === 'ar2en') {
      setTimeout(() => inputRef.current?.focus(), 50);
    }

    if (mode !== 'type' && unlocked) {
      void checkHealth();
    }
  }, [letter, mode, direction, reset]);

  useEffect(() => {
    if (result) setLocalResult(result);
  }, [result]);

  const isDrawMode = mode === 'draw';

  const handleCheckTyped = () => {
    if (!inputValue.trim()) return;
    onSubmit(inputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (answered) onNext();
      else handleCheckTyped();
    }
  };

  const imageDataToDataUrl = (
    imageData: ImageData,
    mediaType: 'image/png',
    padding = 24,
  ): string => {
    const bounds = findInkBounds(imageData, 245);
    const srcX = bounds ? bounds.minX : 0;
    const srcY = bounds ? bounds.minY : 0;
    const srcW = bounds ? bounds.maxX - bounds.minX + 1 : imageData.width;
    const srcH = bounds ? bounds.maxY - bounds.minY + 1 : imageData.height;

    const canvas = document.createElement('canvas');
    canvas.width = srcW + padding * 2;
    canvas.height = srcH + padding * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const source = document.createElement('canvas');
    source.width = imageData.width;
    source.height = imageData.height;
    const sctx = source.getContext('2d');
    if (!sctx) return '';
    sctx.putImageData(imageData, 0, 0);

    ctx.drawImage(source, srcX, srcY, srcW, srcH, padding, padding, srcW, srcH);
    return canvas.toDataURL(mediaType);
  };

  const findInkBounds = (
    imageData: ImageData,
    whiteThreshold: number,
  ): { minX: number; minY: number; maxX: number; maxY: number } | null => {
    const { data, width, height } = imageData;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (r < whiteThreshold || g < whiteThreshold || b < whiteThreshold) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < 0 || maxY < 0) return null;
    return { minX, minY, maxX, maxY };
  };

  const submitHandwriting = async () => {
    if (mode !== 'draw') return;
    if (drawRef.current?.isEmpty()) return;
    const imageData = drawRef.current?.getImageData() ?? null;
    if (!imageData) return;

    const preview = imageDataToDataUrl(imageData, 'image/png', 28);
    setStudentImageSrc(preview);

    // Locked, offline, or server unreachable — fall back to self-grade
    if (!unlocked || !online || !serverReachable) {
      setSelfGrading(true);
      return;
    }

    const graded = await grade({ imageData, mediaType: 'image/png', letterPos: letter.pos });

    if (graded) {
      const dbg = graded.debug ?? {};
      const detected = (dbg as { detected_dot_count?: number }).detected_dot_count;
      const expected = (dbg as { expected_dot_count?: number }).expected_dot_count;
      if (typeof detected === 'number' || typeof expected === 'number') {
        console.log('[grading] dot-count', { letter: letter.arabic, letterPos: letter.pos, detected_dot_count: detected, expected_dot_count: expected });
      }
      onSubmit(graded.correct);
    }
  };

  const giveUp = () => {
    setLocalResult(null);
    setStudentImageSrc('');
    reset();
    onSkip();
  };

  const handleNextFromResult = () => {
    setLocalResult(null);
    setStudentImageSrc('');
    reset();
    onNext();
  };

  const dirLabel = direction === 'ar2en' ? 'Arabic → Name' : 'Name → Arabic';
  const feedbackColor = isCorrect ? 'text-success' : 'text-accent';
  const inputBorderColor = answered
    ? isCorrect
      ? 'border-success bg-success-light'
      : 'border-accent bg-accent-light'
    : 'border-border focus:border-ink';

  const offlineBadge = useMemo(() => {
    if (!isDrawMode || !unlocked || (online && serverReachable)) return null;
    return (
      <div className="flex items-center justify-between rounded-lg bg-border/50 px-3 py-2">
        <span className="font-mono text-xs text-muted">
          {!online ? 'Offline' : 'Server unreachable'} — self-grade mode
        </span>
        {online && !serverReachable && (
          <button
            onClick={checkHealth}
            disabled={checkingServer}
            className="font-mono text-xs text-muted underline hover:text-ink disabled:opacity-50"
          >
            {checkingServer ? 'Checking…' : 'Retry'}
          </button>
        )}
      </div>
    );
  }, [checkingServer, isDrawMode, online, serverReachable, unlocked]);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <span className="rounded-full bg-border px-2 py-1 font-mono text-xs text-muted">{dirLabel}</span>
        <AudioButtons slug={letter.slug} />
      </div>

      {isDrawMode ? (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <p className="font-mono text-sm text-muted">
            Listen to the letter audio, then draw it from memory.
          </p>
          <button
            onClick={() => setShowRomanizationHint(prev => !prev)}
            className="rounded-lg border border-border px-3 py-1 font-mono text-xs text-muted hover:border-muted hover:text-ink"
          >
            {showRomanizationHint ? 'Hide Romanization' : 'Show Romanization'}
          </button>
          {showRomanizationHint && (
            <p className="font-mono text-sm text-ink">
              {letter.name} ({letter.roman})
            </p>
          )}
        </div>
      ) : (
        <div className="flex min-h-[80px] items-center justify-center py-4">
          {direction === 'ar2en' ? (
            <span className="font-arabic text-7xl leading-none" dir="rtl">
              {letter.arabic}
            </span>
          ) : (
            <span className="font-display text-5xl">{letter.name}</span>
          )}
        </div>
      )}

      {mode === 'type' && (
        <div className="flex flex-col gap-3">
          {direction === 'ar2en' ? (
            <>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={answered}
                placeholder="Type the name…"
                dir="ltr"
                className={`w-full rounded-xl border-2 px-4 py-3 font-mono text-base outline-none transition-colors ${inputBorderColor} disabled:opacity-80`}
              />
              {answered && (
                <p className={`font-mono text-sm font-medium ${feedbackColor}`}>
                  {isCorrect ? '✓ correct' : `✗ it's ${letter.name} (${letter.roman})`}
                </p>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-1.5">
                {selectedLetters.map(l => (
                  <button
                    key={l.pos}
                    onClick={() => !answered && onSubmit(l.pos === letter.pos)}
                    disabled={answered}
                    className={`min-h-[44px] rounded-lg border-2 font-arabic text-2xl transition-all ${
                      answered && l.pos === letter.pos
                        ? 'border-success bg-success-light'
                        : 'border-border bg-surface hover:border-muted hover:bg-bg active:bg-border'
                    } disabled:opacity-70`}
                    dir="rtl"
                  >
                    {l.arabic}
                  </button>
                ))}
              </div>
              {answered && (
                <p className={`font-mono text-sm font-medium ${feedbackColor}`}>
                  {isCorrect ? '✓ correct' : `✗ it's ${letter.arabic} (${letter.name})`}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {isDrawMode && offlineBadge}

      {mode === 'draw' && !answered && !selfGrading && (
        <div className="relative">
          <DrawCanvas ref={drawRef} />
          {status === 'grading' && <GradingOverlay />}
        </div>
      )}

      {isDrawMode && selfGrading && studentImageSrc && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col items-center gap-1">
              <div className="flex h-36 w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-white p-2">
                <img src={studentImageSrc} alt="Your attempt" className="h-full w-full object-contain" />
              </div>
              <span className="font-mono text-xs text-muted">Your attempt</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="flex h-36 w-full items-center justify-center rounded-lg border border-border bg-white">
                <span className="font-arabic text-7xl text-ink" dir="rtl">{letter.arabic}</span>
              </div>
              <span className="font-mono text-xs text-muted">Reference</span>
            </div>
          </div>
          <p className="font-mono text-xs text-center text-muted">Did your drawing match?</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { setSelfGrading(false); setSelfGraded(true); onSubmit(false); }}
              className="min-h-[48px] rounded-xl border-2 border-accent font-mono text-sm font-medium text-accent hover:bg-accent-light transition-colors"
            >
              Not quite
            </button>
            <button
              onClick={() => { setSelfGrading(false); setSelfGraded(true); onSubmit(true); }}
              className="min-h-[48px] rounded-xl bg-success font-mono text-sm font-medium text-white hover:bg-success/90 transition-colors"
            >
              Got it ✓
            </button>
          </div>
        </div>
      )}

      {isDrawMode && answered && localResult && studentImageSrc && (
        <GradingResult result={localResult} letter={letter} studentImageSrc={studentImageSrc} onNext={handleNextFromResult} />
      )}

      {isDrawMode && answered && selfGraded && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-bg p-4">
          <p className={`font-mono text-sm font-medium ${isCorrect ? 'text-success' : 'text-accent'}`}>
            {isCorrect ? '✓ marked correct' : '✗ marked incorrect'}
          </p>
          <p className="font-mono text-sm text-muted">
            Reference: <span className="font-arabic text-2xl align-middle text-ink" dir="rtl">{letter.arabic}</span> — {letter.name} ({letter.roman})
          </p>
          <button
            onClick={onNext}
            className="w-full rounded-xl bg-ink py-3 font-mono text-sm uppercase tracking-wide text-surface transition hover:bg-ink/90"
          >
            Next →
          </button>
        </div>
      )}

      {isDrawMode && answered && !localResult && !selfGraded && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-bg p-4">
          <p className="font-mono text-sm text-accent">You gave up on this one.</p>
          <p className="font-mono text-sm text-ink">
            Correct letter: <span className="font-arabic text-2xl align-middle">{letter.arabic}</span> ({letter.name})
          </p>
          <button
            onClick={onNext}
            className="w-full rounded-xl bg-ink py-3 font-mono text-sm uppercase tracking-wide text-surface transition hover:bg-ink/90"
          >
            Next →
          </button>
        </div>
      )}

      {isDrawMode && error && (
        <div className="rounded-xl border border-accent bg-accent-light p-3 font-mono text-sm text-accent">{error}</div>
      )}

      {!isDrawMode && (
        <div className="flex justify-end gap-2 pt-1">
          {!answered ? (
            <>
              <button
                onClick={onSkip}
                className="min-h-[44px] rounded-xl border-2 border-border px-4 font-mono text-sm text-muted transition-colors hover:border-muted"
              >
                Skip
              </button>
              {mode === 'type' && direction === 'ar2en' && (
                <button
                  onClick={handleCheckTyped}
                  disabled={!inputValue.trim()}
                  className="min-h-[44px] rounded-xl bg-ink px-5 font-mono text-sm font-medium text-surface transition-colors hover:bg-ink/90 disabled:opacity-40"
                >
                  Check
                </button>
              )}
            </>
          ) : (
            <button
              onClick={onNext}
              className="min-h-[44px] rounded-xl bg-ink px-5 font-mono text-sm font-medium text-surface transition-colors hover:bg-ink/90"
            >
              Next →
            </button>
          )}
        </div>
      )}

      {isDrawMode && !answered && !selfGrading && (
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={giveUp}
            className="min-h-[44px] rounded-xl border-2 border-border px-4 font-mono text-sm text-muted transition-colors hover:border-muted"
          >
            Give up
          </button>
          <button
            onClick={() => {
              drawRef.current?.clear();
              setStudentImageSrc('');
              setLocalResult(null);
              reset();
            }}
            className="min-h-[44px] rounded-xl border border-border px-4 font-mono text-sm text-muted transition-colors hover:border-muted"
          >
            Clear
          </button>
          <button
            onClick={submitHandwriting}
            disabled={status === 'grading'}
            className="min-h-[44px] rounded-xl bg-ink px-5 font-mono text-sm font-medium text-surface transition-colors hover:bg-ink/90 disabled:opacity-40"
          >
            Submit
          </button>
        </div>
      )}
    </div>
  );
}
