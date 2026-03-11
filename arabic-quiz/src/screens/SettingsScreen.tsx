import { useState } from 'react';

interface Props {
  unlocked: boolean;
  onUnlock: (password: string) => Promise<boolean>;
  onLock: () => void;
}

export function SettingsScreen({ unlocked, onUnlock, onLock }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleSubmit = async () => {
    if (!password.trim()) return;
    setChecking(true);
    setError(false);
    const ok = await onUnlock(password);
    setChecking(false);
    if (!ok) {
      setError(true);
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="text-center">
          <h1 className="font-display text-4xl text-ink mb-2">Arabic Quiz</h1>
          <p className="font-mono text-sm text-muted">28 Arabic letters</p>
        </div>

        <div className="bg-surface rounded-2xl border border-border p-6 flex flex-col gap-4">
          {unlocked ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-success font-mono text-sm font-medium">✓ AI grading unlocked</span>
              </div>
              <p className="font-mono text-xs text-muted leading-relaxed">
                Draw mode will use AI grading when the server is reachable.
              </p>
              <button
                onClick={onLock}
                className="w-full min-h-[44px] rounded-xl border-2 border-border font-mono text-sm text-muted hover:border-muted hover:text-ink transition-colors"
              >
                Lock
              </button>
            </>
          ) : (
            <>
              <p className="font-mono text-xs text-muted leading-relaxed">
                Enter the password to enable AI grading in Draw mode.
              </p>
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(false); }}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="Password"
                className={`w-full px-4 py-3 rounded-xl border-2 font-mono text-sm outline-none transition-colors ${
                  error ? 'border-accent bg-accent-light' : 'border-border focus:border-ink'
                }`}
              />
              {error && <p className="font-mono text-xs text-accent">Incorrect password.</p>}
              <button
                onClick={handleSubmit}
                disabled={!password.trim() || checking}
                className="w-full min-h-[48px] rounded-xl bg-ink text-surface font-mono text-sm font-medium hover:bg-ink/90 transition-colors disabled:opacity-40"
              >
                {checking ? 'Checking…' : 'Unlock'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
