import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export interface DrawCanvasRef {
  clear: () => void;
  getImageData: () => ImageData;
  isEmpty: () => boolean;
}

export const DrawCanvas = forwardRef<DrawCanvasRef, {}>(function DrawCanvas(_props, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * ratio);
    canvas.height = Math.floor(rect.height * ratio);
    ctx.scale(ratio, ratio);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#111111';
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, rect.width, rect.height);
  }, []);

  useImperativeHandle(ref, () => ({
    clear() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, rect.width, rect.height);
      lastPointRef.current = null;
      drawingRef.current = false;
    },
    getImageData() {
      const canvas = canvasRef.current;
      if (!canvas) {
        throw new Error('Canvas is not ready');
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas context unavailable');
      }
      // Read full backing-store pixels (important on Retina/high-DPI screens).
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    },
    isEmpty() {
      const canvas = canvasRef.current;
      if (!canvas) return true;
      const ctx = canvas.getContext('2d');
      if (!ctx) return true;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) return false;
      }
      return true;
    },
  }));

  const pointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const p = pointFromEvent(e);
    lastPointRef.current = p;

    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const p = pointFromEvent(e);
    const last = lastPointRef.current;
    if (!last) {
      lastPointRef.current = p;
      return;
    }

    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPointRef.current = p;
  };

  const endStroke = () => {
    drawingRef.current = false;
    lastPointRef.current = null;
  };

  return (
    <canvas
      ref={canvasRef}
      className="h-[260px] w-full touch-none rounded-xl border border-border bg-white"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endStroke}
      onPointerCancel={endStroke}
      onPointerLeave={endStroke}
    />
  );
});
