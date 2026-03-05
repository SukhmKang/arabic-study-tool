export interface GradeRequest {
  imageData: ImageData;
  mediaType: 'image/png';
  letterPos: number;
}

export interface GradeResult {
  correct: boolean;
  score: 'excellent' | 'good' | 'close' | 'incorrect';
  feedback: string;
  reference_image?: string | null;
  debug?: {
    dot_count?: number;
    dot_score?: number;
    template_score?: number;
    baseline_angle?: number;
    final_score?: number;
    feedback_source?: 'deterministic' | 'llm' | 'deterministic_fallback' | string;
    evidence?: unknown;
  };
}

function imageDataToBase64(imageData: ImageData, mediaType: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas context unavailable');
  }
  ctx.putImageData(imageData, 0, 0);
  const dataUrl = canvas.toDataURL(mediaType);
  return dataUrl.split(',')[1] ?? '';
}

export async function gradeHandwriting(req: GradeRequest): Promise<GradeResult> {
  const base64 = imageDataToBase64(req.imageData, req.mediaType);
  const serverUrl = import.meta.env.VITE_GRADING_SERVER_URL ?? 'http://localhost:8000';

  const res = await fetch(`${serverUrl}/grade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: base64,
      media_type: req.mediaType,
      letter_pos: req.letterPos,
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
    const url = import.meta.env.VITE_GRADING_SERVER_URL ?? 'http://localhost:8000';
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
