export function GradingOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-white/90">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink border-t-transparent" />
      <p className="font-mono text-xs tracking-wide text-muted">Grading…</p>
    </div>
  );
}
