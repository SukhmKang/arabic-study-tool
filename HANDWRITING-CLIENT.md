# Arabic Handwriting Grading — Frontend Integration (HANDWRITING-CLIENT.md)

## Overview

This document covers the React PWA changes needed to integrate with the grading server specified in `HANDWRITING-SERVER.md`. Read alongside `CLAUDE.md`.

The changes are contained — only the Draw and Camera mode grading logic changes. All other screens, quiz state, audio, and type mode are unaffected.

---

## New files

```
src/
  lib/
    grading.ts          # API call to grading server
  hooks/
    useGrading.ts       # React hook wrapping the grading call
  components/
    GradingOverlay.tsx  # progress UI during grading
    GradingResult.tsx   # result display (score + feedback + images)
```

---

## Environment config

```
# .env.development
VITE_GRADING_SERVER_URL=http://localhost:8000

# .env.production
VITE_GRADING_SERVER_URL=https://your-deployed-server.fly.dev
```

Access in code as `import.meta.env.VITE_GRADING_SERVER_URL`.

---

## src/lib/grading.ts

```ts
export interface GradeRequest {
  imageData: ImageData;
  mediaType: 'image/png' | 'image/jpeg';
  letterPos: number;
  apiKey: string;
}

export interface GradeResult {
  correct: boolean;
  score: 'excellent' | 'good' | 'close' | 'incorrect';
  feedback: string;
  debug?: {
    classifierTop3: { label: string; arabic: string; probability: number }[];
    dotCount: number;
    dotScore: number;
    templateScore: number;
    baselineAngle: number;
    finalScore: number;
  };
}

function imageDataToBase64(imageData: ImageData, mediaType: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);
  const dataUrl = canvas.toDataURL(mediaType);
  return dataUrl.split(',')[1]; // strip prefix
}

export async function gradeHandwriting(req: GradeRequest): Promise<GradeResult> {
  const base64 = imageDataToBase64(req.imageData, req.mediaType);
  const serverUrl = import.meta.env.VITE_GRADING_SERVER_URL;

  const res = await fetch(`${serverUrl}/grade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: base64,
      media_type: req.mediaType,
      letter_pos: req.letterPos,
      api_key: req.apiKey,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `Server error ${res.status}` }));
    throw new Error(err.detail ?? 'Grading failed');
  }

  return res.json();
}

export async function checkServerHealth(): Promise<boolean> {
  try {
    const res = await fetch(
      `${import.meta.env.VITE_GRADING_SERVER_URL}/health`,
      { signal: AbortSignal.timeout(3000) }
    );
    return res.ok;
  } catch {
    return false;
  }
}
```

---

## src/hooks/useGrading.ts

```ts
import { useState, useCallback } from 'react';
import { gradeHandwriting, GradeRequest, GradeResult } from '@/lib/grading';

export type GradingStatus = 'idle' | 'grading' | 'done' | 'error';

export interface UseGradingReturn {
  grade: (req: GradeRequest) => Promise<void>;
  status: GradingStatus;
  result: GradeResult | null;
  error: string | null;
  reset: () => void;
}

export function useGrading(): UseGradingReturn {
  const [status, setStatus] = useState<GradingStatus>('idle');
  const [result, setResult] = useState<GradeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const grade = useCallback(async (req: GradeRequest) => {
    setStatus('grading');
    setResult(null);
    setError(null);
    try {
      const res = await gradeHandwriting(req);
      setResult(res);
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setStatus('error');
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setResult(null);
    setError(null);
  }, []);

  return { grade, status, result, error, reset };
}
```

---

## src/components/GradingOverlay.tsx

Shown while `status === 'grading'`. Overlays the quiz card.

```tsx
export function GradingOverlay() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center
                    bg-white/90 rounded-2xl gap-4 z-10">
      <div className="w-8 h-8 border-2 border-ink border-t-transparent
                      rounded-full animate-spin" />
      <p className="text-sm font-mono text-muted tracking-wide">
        Grading…
      </p>
    </div>
  );
}
```

---

## src/components/GradingResult.tsx

Shown when `status === 'done'`. Replaces the canvas/camera preview area.

```tsx
import { GradeResult } from '@/lib/grading';
import { Letter } from '@/data/letters';

interface Props {
  result: GradeResult;
  letter: Letter;
  studentImageSrc: string;   // data URL of student's drawing/photo
  onNext: () => void;
}

const VERDICT_STYLES = {
  excellent: 'bg-success-light text-success',
  good:      'bg-success-light text-success',
  close:     'bg-warning-light text-warning',
  incorrect: 'bg-error-light text-error',
};

const VERDICT_LABELS = {
  excellent: '✓ excellent',
  good:      '✓ good',
  close:     '~ close',
  incorrect: '✗ incorrect',
};

export function GradingResult({ result, letter, studentImageSrc, onNext }: Props) {
  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Verdict badge */}
      <div className={`self-start px-3 py-1 rounded-full text-xs font-mono
                       tracking-widest uppercase ${VERDICT_STYLES[result.score]}`}>
        {VERDICT_LABELS[result.score]}
      </div>

      {/* Side-by-side images */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col items-center gap-1">
          <img src={studentImageSrc} alt="Your attempt"
               className="w-full rounded-lg border border-border bg-white" />
          <span className="text-xs text-muted font-mono">Your attempt</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          {/* Reference: show the Arabic character in large type as fallback */}
          <div className="w-full rounded-lg border border-border bg-white
                          flex items-center justify-center min-h-[120px]">
            <span className="font-arabic text-7xl text-ink">{letter.arabic}</span>
          </div>
          <span className="text-xs text-muted font-mono">Reference</span>
        </div>
      </div>

      {/* Feedback */}
      <p className="text-sm text-ink leading-relaxed">{result.feedback}</p>

      {/* Next button */}
      <button
        onClick={onNext}
        className="w-full py-3 bg-ink text-white rounded-xl font-mono
                   text-sm tracking-wide uppercase hover:bg-neutral-800 transition"
      >
        Next →
      </button>
    </div>
  );
}
```

**Note on reference image:** the server returns the best-match template as PNG bytes but the API response currently only returns the score/feedback/debug — not the reference image bytes. Two options:

1. Add a `reference_image` field to the `/grade` response (base64 PNG) — cleanest
2. Use the Arabic character rendered in large type as reference (shown above as fallback)

Option 1 is better UX. Update `HANDWRITING-SERVER.md` and `main.py` to include it if desired.

---

## DrawCanvas component updates

`DrawCanvas` needs to expose `getImageData()` for the grading call.

```tsx
// src/components/DrawCanvas.tsx
import { useRef, useImperativeHandle, forwardRef } from 'react';

export interface DrawCanvasRef {
  clear: () => void;
  getImageData: () => ImageData;
  isEmpty: () => boolean;
}

export const DrawCanvas = forwardRef<DrawCanvasRef, {}>((_, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useImperativeHandle(ref, () => ({
    clear() {
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    },
    getImageData() {
      const canvas = canvasRef.current!;
      return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
    },
    isEmpty() {
      const canvas = canvasRef.current!;
      const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
      // Check if all pixels are white (255,255,255,255)
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] < 250) return false;
      }
      return true;
    }
  }));

  // ... mouse/touch drawing handlers (unchanged from CLAUDE.md spec)

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-xl border border-border touch-none bg-white"
      style={{ height: '260px' }}
    />
  );
});
```

---

## CameraCapture component updates

`CameraCapture` needs to expose `getImageData()` and `getMediaType()`.

```tsx
export interface CameraRef {
  getImageData: () => ImageData | null;
  getMediaType: () => 'image/png' | 'image/jpeg';
  reset: () => void;
}
```

Convert the captured file to `ImageData` by drawing it to an offscreen canvas:

```ts
async function fileToImageData(file: File): Promise<ImageData> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext('2d')!.drawImage(img, 0, 0);
  URL.revokeObjectURL(url);
  return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
}
```

---

## QuizScreen integration

```tsx
// In QuizScreen.tsx — Draw/Camera submit handler

import { useGrading } from '@/hooks/useGrading';
import { checkServerHealth } from '@/lib/grading';

const { grade, status, result, error, reset } = useGrading();
const drawRef = useRef<DrawCanvasRef>(null);
const cameraRef = useRef<CameraRef>(null);

// Check server on mount (Draw/Camera modes only)
useEffect(() => {
  if (quizMode !== 'type') {
    checkServerHealth().then(ok => {
      if (!ok) setServerWarning('Grading server not reachable. Start the server to use this mode.');
    });
  }
}, [quizMode]);

const handleSubmit = async () => {
  let imageData: ImageData | null = null;
  let mediaType: 'image/png' | 'image/jpeg' = 'image/png';

  if (quizMode === 'draw') {
    if (drawRef.current?.isEmpty()) return;
    imageData = drawRef.current!.getImageData();
  } else if (quizMode === 'camera') {
    imageData = cameraRef.current?.getImageData() ?? null;
    mediaType = cameraRef.current?.getMediaType() ?? 'image/jpeg';
  }

  if (!imageData) return;

  await grade({
    imageData,
    mediaType,
    letterPos: current.pos,
    apiKey,
  });
};

// After grading done — mark correct/incorrect in quiz state
useEffect(() => {
  if (status === 'done' && result) {
    if (result.correct) {
      setCorrectCount(c => c + 1);
    } else {
      setWrongCount(c => c + 1);
      setMissed(m => [...m, current]);
    }
  }
}, [status, result]);
```

---

## Server availability UX

If the health check fails, show a banner on the Draw/Camera quiz card:

```
┌─────────────────────────────────────────────┐
│ ⚠ Grading server not running                │
│ Start it with: uvicorn main:app --port 8000  │
└─────────────────────────────────────────────┘
```

Disable the Submit button while the server is unreachable. Re-check health when the user taps "Retry".

---

## Error handling

| Error | Display |
|---|---|
| Server not reachable | Banner + retry button, Submit disabled |
| 400 bad input | Inline: "Invalid image — try drawing again" |
| 500 server error | Inline: server's error message + retry |
| Timeout (>30s) | Inline: "Server took too long — try again" |

All errors: show retry button, do not advance to next card.

---

## PWA / offline behaviour

Draw and Camera modes require the server — they cannot work offline. Handle this gracefully:

- If the app is offline (check `navigator.onLine`), show a message: "Draw and Camera modes need a connection to the grading server. Switch to Type mode to practice offline."
- Type mode and audio continue to work fully offline as before

---

## Implementation order

1. Add `VITE_GRADING_SERVER_URL` to `.env.development`
2. Implement `grading.ts` and test `/health` and `/grade` calls against the running server
3. Implement `useGrading.ts`
4. Update `DrawCanvas` with `getImageData()` / `isEmpty()` via ref
5. Update `CameraCapture` with `getImageData()` / `getMediaType()` via ref
6. Implement `GradingOverlay` and `GradingResult`
7. Wire up submit handler in `QuizScreen`
8. Add server health check + offline handling
9. Test full round-trip: draw a letter → submit → see feedback