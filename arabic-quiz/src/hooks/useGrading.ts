import { useCallback, useState } from 'react';
import { gradeHandwriting, type GradeRequest, type GradeResult } from '@/lib/grading';

export type GradingStatus = 'idle' | 'grading' | 'done' | 'error';

export interface UseGradingReturn {
  grade: (req: GradeRequest) => Promise<GradeResult | null>;
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
      return res;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setStatus('error');
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setResult(null);
    setError(null);
  }, []);

  return { grade, status, result, error, reset };
}
