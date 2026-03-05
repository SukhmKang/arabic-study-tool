export function SettingsScreen() {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="text-center">
          <h1 className="font-display text-4xl text-ink mb-2">Arabic Quiz</h1>
          <p className="font-mono text-sm text-muted">28 Arabic letters</p>
        </div>

        <div className="bg-surface rounded-2xl border border-border p-6 flex flex-col gap-4">
          <p className="font-mono text-sm text-ink leading-relaxed">
            This app never asks for or sends API keys from the browser.
          </p>
          <p className="font-mono text-xs text-muted leading-relaxed">
            Draw grading uses the backend server configuration only. Set keys in
            the backend <code>.env</code>, then restart the grading server.
          </p>
        </div>
      </div>
    </div>
  );
}
