import vocabJson from './vocab.json';
import { shuffle } from '@/lib/quiz';

export interface VocabEntry {
  arabic: string;
  translation: string;
}

export type UnitKey = 'unit1' | 'unit2' | 'unit3' | 'unit4' | 'unit5' | 'unit6' | 'unit7' | 'unit9';

export const UNIT_KEYS: UnitKey[] = ['unit1', 'unit2', 'unit3', 'unit4', 'unit5', 'unit6', 'unit7', 'unit9'];

export const UNIT_LABELS: Record<UnitKey, string> = {
  unit1: 'Unit 1',
  unit2: 'Unit 2',
  unit3: 'Unit 3',
  unit4: 'Unit 4',
  unit5: 'Unit 5',
  unit6: 'Unit 6',
  unit7: 'Unit 7',
  unit9: 'Unit 9',
};

type RawVocab = Record<string, Array<{ arabic: string; translation: string }>>;
const raw = vocabJson as RawVocab;

export const VOCAB: Record<UnitKey, VocabEntry[]> = Object.fromEntries(
  UNIT_KEYS.map(k => [k, raw[k] ?? []])
) as Record<UnitKey, VocabEntry[]>;

// ─── Arabic glyph utilities ───────────────────────────────────────────────────

// Diacritics: harakat (U+064B–U+065F) — includes fatha, kasra, damma, shadda, sukun, tanwin, etc.
const DIACRITIC_RE = /[\u064B-\u065F\u0670]/;

// Map base Arabic Unicode character → pos in LETTERS (1–28)
const ARABIC_TO_POS: Record<string, number> = {
  // Alif family → 1
  '\u0627': 1, // ا  alif
  '\u0623': 1, // أ  alif with hamza above
  '\u0625': 1, // إ  alif with hamza below
  '\u0622': 1, // آ  alif with madda
  '\u0671': 1, // ٱ  alif wasla
  '\u0621': 1, // ء  standalone hamza
  '\u0628': 2, // ب  ba
  '\u062A': 3, // ت  ta
  '\u0629': 3, // ة  ta marbuta
  '\u062B': 4, // ث  tha
  '\u062C': 5, // ج  jiim
  '\u062D': 6, // ح  hha
  '\u062E': 7, // خ  kha
  '\u062F': 8, // د  daal
  '\u0630': 9, // ذ  thaal
  '\u0631': 10, // ر  ra
  '\u0632': 11, // ز  zay
  '\u0633': 12, // س  siin
  '\u0634': 13, // ش  shiin
  '\u0635': 14, // ص  saad
  '\u0636': 15, // ض  daad
  '\u0637': 16, // ط  taa
  '\u0638': 17, // ظ  thaa
  '\u0639': 18, // ع  ayn
  '\u063A': 19, // غ  ghayn
  '\u0641': 20, // ف  fa
  '\u0642': 21, // ق  qaf
  '\u0643': 22, // ك  kaf
  '\u0644': 23, // ل  lam
  '\u0645': 24, // م  miim
  '\u0646': 25, // ن  nuun
  '\u0647': 26, // ه  ha
  '\u0648': 27, // و  waw
  '\u0624': 27, // ؤ  waw with hamza
  '\u064A': 28, // ي  ya
  '\u0626': 28, // ئ  ya with hamza
  '\u0649': 28, // ى  alif maqsura
};

export interface ArabicGlyph {
  display: string;  // base character + following diacritics
  baseChar: string; // the base Arabic character
  letterPos: number; // LETTERS pos 1–28
}

/** Split an Arabic string into glyph segments (base letter + diacritics).
 *  Skips tatweel (U+0640), spaces, and characters that don't map to one of the 28 letters. */
export function splitIntoGlyphs(arabic: string): ArabicGlyph[] {
  const glyphs: ArabicGlyph[] = [];
  let current = '';
  let currentBase = '';

  const flush = () => {
    if (!currentBase) { current = ''; return; }
    const pos = ARABIC_TO_POS[currentBase];
    if (pos !== undefined) {
      glyphs.push({ display: current, baseChar: currentBase, letterPos: pos });
    }
    current = '';
    currentBase = '';
  };

  for (const char of arabic) {
    const code = char.codePointAt(0) ?? 0;
    if (code === 0x0640) continue; // tatweel – skip
    if (char === ' ') { flush(); continue; }
    if (DIACRITIC_RE.test(char)) {
      current += char;
    } else {
      flush();
      current = char;
      currentBase = char;
    }
  }
  flush();

  return glyphs;
}

/** Strip diacritics and tatweel from a string (for isolated-letter display). */
export function stripDiacritics(s: string): string {
  return s.replace(DIACRITIC_RE, '').replace(/\u0640/g, '');
}

// ─── Word pool ────────────────────────────────────────────────────────────────

export interface PoolEntry {
  entry: VocabEntry;
  unit: UnitKey;
}

export interface WordResult {
  entry: VocabEntry;
  unit: UnitKey;
  correct: number; // number of correct sub-answers
  total: number;   // total sub-answers (glyphs for Identify, 1 for Build modes)
}

/** Build a shuffled word pool from selected units.
 *  Single words first, then multi-word phrases. */
export function buildWordPool(selectedUnits: UnitKey[]): PoolEntry[] {
  const singles: PoolEntry[] = [];
  const phrases: PoolEntry[] = [];

  for (const unit of selectedUnits) {
    for (const entry of VOCAB[unit]) {
      const cleaned = entry.arabic.trim();
      if (!cleaned) continue;
      const target = cleaned.includes(' ') ? phrases : singles;
      target.push({ entry: { arabic: cleaned, translation: entry.translation }, unit });
    }
  }

  return [...shuffle(singles), ...shuffle(phrases)];
}

export function wordCount(selectedUnits: UnitKey[]): number {
  return selectedUnits.reduce((n, u) => n + VOCAB[u].length, 0);
}
