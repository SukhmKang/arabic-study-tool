# Arabic Letters Quiz — CLAUDE.md

## Project overview

A React + Vite PWA that quizzes a user on the 28 Arabic letters. Installable on iOS (Safari "Add to Home Screen") and Android (Chrome install prompt). Designed as a personal gift for someone learning Arabic.

Three quiz modes:
1. **Type** — see a letter, type the name/romanization (or vice versa)
2. **Draw** — see a letter, draw it on a canvas, graded by the FastAPI server (see HANDWRITING-SERVER.md)
3. **Camera** — see a letter, photograph handwriting on paper, graded by the FastAPI server

Draw and Camera modes require the grading server to be running locally. Type mode works fully offline.

---

## Tech stack

| | |
|---|---|
| Framework | React 18 |
| Build tool | Vite |
| PWA | `vite-plugin-pwa` (Workbox) |
| Styling | Tailwind CSS |
| Language | TypeScript |
| HTTP | native `fetch` |
| Audio | HTML5 `<audio>` |
| Storage | `localStorage` |

No UI component library. Custom components only.

---

## Project structure

```
arabic-quiz/
├── public/
│   ├── audio/
│   │   ├── names/          # alif.mp3 … ya.mp3 (28 files)
│   │   └── pronunciation/  # alif.mp3 … ya.mp3 (28 files)
│   ├── icons/              # PWA icons (192, 512, maskable)
│   └── manifest.webmanifest
├── src/
│   ├── data/
│   │   └── letters.ts      # letter data + accepted answers
│   ├── lib/
│   │   ├── grading.ts      # grading server API call (draw/camera modes)
│   │   ├── audio.ts        # audio playback helpers
│   │   └── quiz.ts         # shuffle, scoring, normalisation logic
│   ├── hooks/
│   │   ├── useQuiz.ts      # quiz session state
│   │   ├── useGrading.ts   # grading server state (draw/camera)
│   │   └── useSettings.ts  # API key + preferences
│   ├── screens/
│   │   ├── SettingsScreen.tsx
│   │   ├── SelectScreen.tsx
│   │   ├── QuizScreen.tsx
│   │   └── DoneScreen.tsx
│   ├── components/
│   │   ├── LetterCard.tsx       # the flippable quiz card
│   │   ├── DrawCanvas.tsx       # touch/mouse drawing canvas
│   │   ├── CameraCapture.tsx    # file input + preview
│   │   ├── AudioButtons.tsx     # ♪ and ◎ buttons
│   │   ├── ProgressBar.tsx
│   │   ├── ScoreChips.tsx
│   │   ├── LetterGrid.tsx       # selection screen grid
│   │   ├── ModePills.tsx
│   │   ├── GradingOverlay.tsx   # progress UI while server grades
│   │   └── GradingResult.tsx    # result display (score + feedback + images)
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── vite.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## Data model

```ts
// src/data/letters.ts

export interface Letter {
  arabic: string;       // Unicode Arabic character
  name: string;         // canonical English name e.g. "alif"
  roman: string;        // display romanization e.g. "a / ā"
  slug: string;         // audio filename stem e.g. "alif"
  pos: number;          // 1–28, abjad order
  accepted: string[];   // normalised accepted answers for type mode
  sunMoon: 'sun' | 'moon';
}

export const LETTERS: Letter[] = [
  { arabic: 'أ', name: 'alif',  roman: 'a / ā',  slug: 'alif',  pos: 1,  accepted: ['alif','a','aa'],          sunMoon: 'moon' },
  { arabic: 'ب', name: 'ba',    roman: 'b',       slug: 'ba',    pos: 2,  accepted: ['ba','b'],                 sunMoon: 'moon' },
  { arabic: 'ت', name: 'ta',    roman: 't',       slug: 'ta',    pos: 3,  accepted: ['ta','t'],                 sunMoon: 'sun'  },
  { arabic: 'ث', name: 'tha',   roman: 'th',      slug: 'tha',   pos: 4,  accepted: ['tha','th'],               sunMoon: 'sun'  },
  { arabic: 'ج', name: 'jiim',  roman: 'j',       slug: 'jiim',  pos: 5,  accepted: ['jiim','jeem','j'],        sunMoon: 'moon' },
  { arabic: 'ح', name: 'hha',   roman: 'ḥ',       slug: 'hha',   pos: 6,  accepted: ['hha','ha','h'],           sunMoon: 'moon' },
  { arabic: 'خ', name: 'kha',   roman: 'kh',      slug: 'kha',   pos: 7,  accepted: ['kha','kh'],               sunMoon: 'moon' },
  { arabic: 'د', name: 'daal',  roman: 'd',       slug: 'daal',  pos: 8,  accepted: ['daal','dal','d'],         sunMoon: 'sun'  },
  { arabic: 'ذ', name: 'thaal', roman: 'dh',      slug: 'thaal', pos: 9,  accepted: ['thaal','thal','dh','dhal'],sunMoon: 'sun' },
  { arabic: 'ر', name: 'ra',    roman: 'r',       slug: 'ra',    pos: 10, accepted: ['ra','r'],                 sunMoon: 'sun'  },
  { arabic: 'ز', name: 'zay',   roman: 'z',       slug: 'zay',   pos: 11, accepted: ['zay','zayn','zain','z'],  sunMoon: 'sun'  },
  { arabic: 'س', name: 'siin',  roman: 's',       slug: 'siin',  pos: 12, accepted: ['siin','seen','sin','s'],  sunMoon: 'sun'  },
  { arabic: 'ش', name: 'shiin', roman: 'sh',      slug: 'shiin', pos: 13, accepted: ['shiin','sheen','shin','sh'],sunMoon:'sun' },
  { arabic: 'ص', name: 'saad',  roman: 'ṣ',       slug: 'saad',  pos: 14, accepted: ['saad','sad','s'],         sunMoon: 'sun'  },
  { arabic: 'ض', name: 'daad',  roman: 'ḍ',       slug: 'daad',  pos: 15, accepted: ['daad','dad','d'],         sunMoon: 'sun'  },
  { arabic: 'ط', name: 'taa',   roman: 'ṭ',       slug: 'taa',   pos: 16, accepted: ['taa','ta','t'],           sunMoon: 'sun'  },
  { arabic: 'ظ', name: 'thaa',  roman: 'ẓ',       slug: 'thaa',  pos: 17, accepted: ['thaa','tha','dha','zh'],  sunMoon: 'sun'  },
  { arabic: 'ع', name: 'ayn',   roman: 'ʿ',       slug: 'ayn',   pos: 18, accepted: ['ayn','ain'],              sunMoon: 'moon' },
  { arabic: 'غ', name: 'ghayn', roman: 'gh',      slug: 'ghayn', pos: 19, accepted: ['ghayn','ghain','gh'],     sunMoon: 'moon' },
  { arabic: 'ف', name: 'fa',    roman: 'f',       slug: 'fa',    pos: 20, accepted: ['fa','f'],                 sunMoon: 'moon' },
  { arabic: 'ق', name: 'qaf',   roman: 'q',       slug: 'qaf',   pos: 21, accepted: ['qaf','q'],                sunMoon: 'moon' },
  { arabic: 'ك', name: 'kaf',   roman: 'k',       slug: 'kaf',   pos: 22, accepted: ['kaf','k'],                sunMoon: 'moon' },
  { arabic: 'ل', name: 'lam',   roman: 'l',       slug: 'lam',   pos: 23, accepted: ['lam','l'],                sunMoon: 'sun'  },
  { arabic: 'م', name: 'miim',  roman: 'm',       slug: 'miim',  pos: 24, accepted: ['miim','meem','m'],        sunMoon: 'moon' },
  { arabic: 'ن', name: 'nuun',  roman: 'n',       slug: 'nuun',  pos: 25, accepted: ['nuun','nun','n'],         sunMoon: 'sun'  },
  { arabic: 'ه', name: 'ha',    roman: 'h',       slug: 'ha',    pos: 26, accepted: ['ha','h'],                 sunMoon: 'moon' },
  { arabic: 'و', name: 'waw',   roman: 'w / ū',   slug: 'waw',   pos: 27, accepted: ['waw','w'],                sunMoon: 'moon' },
  { arabic: 'ي', name: 'ya',    roman: 'y / ī',   slug: 'ya',    pos: 28, accepted: ['ya','y'],                 sunMoon: 'moon' },
];

export const SUN_LETTERS = LETTERS.filter(l => l.sunMoon === 'sun');
export const MOON_LETTERS = LETTERS.filter(l => l.sunMoon === 'moon');
```

---

## App state / navigation

Use React `useState` at the `App` level to manage the current screen. No router needed.

```ts
type Screen = 'settings' | 'select' | 'quiz' | 'done';
```

Navigation flow:
```
settings → select → quiz → done
                       ↑        ↘ back to select
                       └── review missed ←┘
```

Show settings screen automatically on first load if no API key in localStorage.

A persistent **⚙** icon button fixed top-right opens a settings drawer/modal on any screen.

---

## useSettings hook

```ts
// src/hooks/useSettings.ts
// Manages API key persisted to localStorage

const STORAGE_KEY = 'arabic-quiz-api-key';

export function useSettings() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(STORAGE_KEY) ?? '');

  const saveApiKey = (key: string) => {
    localStorage.setItem(STORAGE_KEY, key);
    setApiKey(key);
  };

  return { apiKey, saveApiKey };
}
```

---

## useQuiz hook

```ts
// src/hooks/useQuiz.ts
// Manages all quiz session state

interface QuizState {
  deck: Letter[];
  current: Letter | null;
  correctCount: number;
  wrongCount: number;
  missed: Letter[];
  answered: boolean;
  total: number;
}

// Exposes:
// startQuiz(letters: Letter[]) — shuffles and begins
// submitAnswer(answer: string | boolean) — handles type mode answer (string) or draw/camera result (boolean from Claude)
// skipCard() — counts as wrong
// nextCard() — advances to next
// restartMissed() — starts new round with missed letters only
```

---

## Screen: Settings

- Input field for Anthropic API key (type="password")
- "Save & continue" button → saves to localStorage → navigates to Select
- Show if first visit or opened via ⚙ icon
- Include a brief note: "Your API key is stored locally on this device only. Required for Draw and Camera modes."

---

## Screen: Select

### Letter grid
- Responsive CSS grid: 4 columns on desktop, 3 on mobile
- Each cell: Arabic character (large) + name (small)
- Toggle selected/deselected on tap/click
- Selected: dark background, white text; deselected: white + border
- Persist selection to `localStorage` key `arabic-quiz-selected` (array of `pos` ints)

### Controls (above grid)
- Group pills: **All** · **Sun** · **Moon** — clicking a group selects those letters and deselects others
- **Select all** / **Clear** text buttons

### Controls (below grid)
- Mode pills: **Type** · **Draw** · **Camera**
- Direction pills (visible only in Type mode): **Arabic → Name** · **Name → Arabic** · **Random**
- **Start →** button (disabled when 0 selected), shows count: "Start with 12 letters"

---

## Screen: Quiz

### Layout (mobile-first, centred, max-width 480px)

```
[progress bar — full width]
[✓ N correct]  [✗ N wrong]  [mode badge]
─────────────────────────────────────────
[quiz card]
─────────────────────────────────────────
```

### Quiz card

All three modes share the same card shell:
- White surface, rounded corners, subtle shadow
- Direction tag top-left (e.g. "Arabic → Name")
- ♪ and ◎ audio buttons top-right
- Prompt area (Arabic character or letter name, large)
- Answer area (varies by mode — see below)
- Skip / Check buttons (or Next in draw/camera after grading)

### Audio behaviour
- Auto-play name audio (`/audio/names/{slug}.mp3`) on each new card
- ♪ replays name; ◎ plays pronunciation (`/audio/pronunciation/{slug}.mp3`)
- Use a ref to an `<audio>` element, set `src` and call `.play()` — don't preload all files
- Fail silently if file missing

---

## Mode: Type

### ar2en
- Prompt: Arabic character (~5rem, Noto Naskh Arabic or system Arabic font)
- Input: text input, autofocus, `dir="ltr"`, submit on Enter or Check button
- Normalise answer: lowercase, trim, strip diacritics (`/[\u064B-\u065F]/g`), strip `ˤˁʿʕ./`
- Match against `letter.accepted` array
- Correct → green input + "✓ correct", auto-advance after 1.3s
- Wrong → red input + "✗ it's [name] ([roman])", auto-advance after 1.8s

### en2ar
- Prompt: letter name (~3rem)
- Input: on-screen keyboard — buttons for each letter in the selected set (Noto Naskh Arabic font)
- Tapping a letter immediately submits it
- Same feedback pattern

---

## Mode: Draw

### DrawCanvas component
- `<canvas>` element, full card width, 280px tall desktop / 220px mobile
- White fill, black stroke, lineWidth 3 (desktop) / 4 (mobile, detect via `window.innerWidth`)
- Mouse events: `mousedown` → start path, `mousemove` → draw if down, `mouseup/mouseleave` → end
- Touch events: `touchstart/touchmove/touchend` — use `touch.clientX/Y` with `getBoundingClientRect()` offset
- `touch-action: none` on the canvas element to prevent scroll interference
- Expose `clear()` and `toDataURL()` via `useImperativeHandle` ref

### Grading flow
1. User draws, clicks "Submit to Claude"
2. Canvas → `canvas.toDataURL('image/png')` → strip `data:image/png;base64,` prefix
3. Call `api.gradeImage(base64, 'image/png', letter)` (see API section)
4. Show `<GradingOverlay>` (spinner + "Claude is grading…") while awaiting
5. Display result: score badge + feedback text + correct Arabic letter large
6. "Next →" button to advance (no auto-advance)

---

## Mode: Camera

### CameraCapture component
- Render a hidden `<input type="file" accept="image/*" capture="environment">`
- "📷 Take photo" button triggers the input's click
- On `change`: read file → show preview in an `<img>` tag → enable Submit button
- "Retake" clears the preview and re-triggers
- Convert to base64 via `FileReader.readAsDataURL`, strip prefix
- Detect media type from `file.type` (image/jpeg or image/png)

### Grading flow
Same as Draw mode — call `api.gradeImage(base64, mediaType, letter)`, show overlay, display result.

---

## Grading server — src/lib/grading.ts

Draw and Camera modes send images to the FastAPI grading server rather than calling Claude directly. See `HANDWRITING-SERVER.md` for the server spec and `HANDWRITING-CLIENT.md` for the full integration details.

```ts
export interface GradeResult {
  correct: boolean;
  score: 'excellent' | 'good' | 'close' | 'incorrect';
  feedback: string;
  reference_image?: string;  // base64 PNG of best-match template, for display
}

export async function gradeHandwriting(
  imageData: ImageData,
  mediaType: 'image/png' | 'image/jpeg',
  letterPos: number,
  apiKey: string,
): Promise<GradeResult>

export async function checkServerHealth(): Promise<boolean>
```

Server URL is read from `import.meta.env.VITE_GRADING_SERVER_URL` (default `http://localhost:8000`).

If the server is unreachable, show a banner: "Grading server not running. Start it with: `uvicorn main:app --port 8000`"

---

## Screen: Done

- Score as `Math.round(correct / total * 100)`%
- Message bracket: 100% · ≥80% · ≥50% · <50%
- Missed letters list: arabic · name · roman
- Buttons: **Start again** · **Review missed** · **Change letters**

---

## PWA configuration

Use `vite-plugin-pwa` with Workbox.

```ts
// vite.config.ts (relevant section)
VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: 'Arabic Letters Quiz',
    short_name: 'Arabic Quiz',
    description: 'Learn the 28 Arabic letters',
    theme_color: '#f7f4ef',
    background_color: '#f7f4ef',
    display: 'standalone',
    orientation: 'portrait',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,png,mp3}'],
    // Cache all audio files so the app works offline after first load
    runtimeCaching: [
      {
        urlPattern: /\/audio\//,
        handler: 'CacheFirst',
        options: { cacheName: 'audio-cache' },
      },
    ],
  },
})
```

This makes the app:
- Installable on iOS via Safari "Add to Home Screen"
- Installable on Android via Chrome install prompt
- Fully offline after first load (audio, fonts, all assets cached)

Generate placeholder PWA icons (simple Arabic letter on coloured background) — can be replaced later.

---

## Styling

Use Tailwind CSS utility classes throughout. No custom CSS files except `index.css` for:
- Google Fonts import (`DM Serif Display`, `DM Mono`, `Noto Naskh Arabic`)
- Tailwind base/components/utilities directives
- A handful of custom utilities if needed (e.g. `.font-arabic`)

### Colour palette (extend Tailwind config)
```ts
colors: {
  bg: '#f7f4ef',
  surface: '#ffffff',
  ink: '#1a1a18',
  muted: '#888880',
  border: '#e2ddd6',
  accent: { DEFAULT: '#c0392b', light: '#f9ede9' },
  success: { DEFAULT: '#27ae60', light: '#eafaf1' },
  warning: { DEFAULT: '#e67e22', light: '#fef5ec' },
}
```

### Typography
- Arabic characters: `font-arabic` (Noto Naskh Arabic), `text-7xl` for prompts, `dir="rtl"`
- Display / roman prompts: `DM Serif Display`, `text-5xl`
- UI labels, inputs, buttons: `DM Mono`

---

## Responsive / mobile requirements

- Mobile-first layout, `max-w-lg mx-auto` card container
- All tap targets `min-h-[44px] min-w-[44px]`
- Canvas: `touch-action: none` to prevent scroll during drawing
- Camera input: `capture="environment"` attribute on mobile for rear camera
- Letter grid: `grid-cols-3 sm:grid-cols-4`
- Test on 375px width (iPhone SE) as minimum target

---

## Constraints

- React 18 + Vite + TypeScript + Tailwind + vite-plugin-pwa
- No UI component libraries (shadcn, MUI, etc.) — custom components only
- Type mode works fully offline; Draw and Camera modes require the grading server (HANDWRITING-SERVER.md)
- API key stored in localStorage, passed to grading server per-request, never stored server-side
- Audio files in `public/audio/` (names/ and pronunciation/ subdirectories)
- App must work fully offline for Type mode after first install (service worker caches all assets)
- Grading server URL configured via `VITE_GRADING_SERVER_URL` env var