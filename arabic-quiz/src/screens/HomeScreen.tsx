interface Props {
  onCharQuiz: () => void;
  onConnectedForms: () => void;
}

export function HomeScreen({ onCharQuiz, onConnectedForms }: Props) {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="text-center">
          <h1 className="font-display text-5xl text-ink mb-2">Arabic Quiz</h1>
          <p className="font-mono text-sm text-muted">Choose a study mode</p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={onCharQuiz}
            className="w-full rounded-2xl bg-ink text-surface font-mono flex flex-col items-center justify-center gap-2 hover:bg-ink/90 transition-colors px-6 py-6"
          >
            <span className="font-arabic text-4xl leading-none">أ ب ت</span>
            <span className="text-base font-medium">Character Quiz</span>
            <span className="text-xs text-surface/60">Identify &amp; write the 28 letters</span>
          </button>

          <button
            onClick={onConnectedForms}
            className="w-full rounded-2xl bg-surface border-2 border-border text-ink font-mono flex flex-col items-center justify-center gap-2 hover:border-muted transition-colors px-6 py-6"
          >
            <span className="font-arabic text-4xl leading-none">كتاب</span>
            <span className="text-base font-medium">Connected Forms</span>
            <span className="text-xs text-muted">Read &amp; build words in context</span>
          </button>
        </div>
      </div>
    </div>
  );
}
