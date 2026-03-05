export interface Letter {
  arabic: string;
  name: string;
  roman: string;
  slug: string;
  pos: number;
  accepted: string[];
  sunMoon: 'sun' | 'moon';
}

export const LETTERS: Letter[] = [
  { arabic: 'أ', name: 'alif',  roman: 'a / ā',  slug: 'alif',  pos: 1,  accepted: ['alif','a','aa'],                    sunMoon: 'moon' },
  { arabic: 'ب', name: 'ba',    roman: 'b',       slug: 'ba',    pos: 2,  accepted: ['ba','b'],                           sunMoon: 'moon' },
  { arabic: 'ت', name: 'ta',    roman: 't',       slug: 'ta',    pos: 3,  accepted: ['ta','t'],                           sunMoon: 'sun'  },
  { arabic: 'ث', name: 'tha',   roman: 'th',      slug: 'tha',   pos: 4,  accepted: ['tha','th'],                         sunMoon: 'sun'  },
  { arabic: 'ج', name: 'jiim',  roman: 'j',       slug: 'jiim',  pos: 5,  accepted: ['jiim','jeem','j'],                  sunMoon: 'moon' },
  { arabic: 'ح', name: 'hha',   roman: 'ḥ',       slug: 'hha',   pos: 6,  accepted: ['hha','ha','h'],                    sunMoon: 'moon' },
  { arabic: 'خ', name: 'kha',   roman: 'kh',      slug: 'kha',   pos: 7,  accepted: ['kha','kh'],                         sunMoon: 'moon' },
  { arabic: 'د', name: 'daal',  roman: 'd',       slug: 'daal',  pos: 8,  accepted: ['daal','dal','d'],                  sunMoon: 'sun'  },
  { arabic: 'ذ', name: 'thaal', roman: 'dh',      slug: 'thaal', pos: 9,  accepted: ['thaal','thal','dh','dhal'],         sunMoon: 'sun'  },
  { arabic: 'ر', name: 'ra',    roman: 'r',       slug: 'ra',    pos: 10, accepted: ['ra','r'],                           sunMoon: 'sun'  },
  { arabic: 'ز', name: 'zay',   roman: 'z',       slug: 'zay',   pos: 11, accepted: ['zay','zayn','zain','z'],            sunMoon: 'sun'  },
  { arabic: 'س', name: 'siin',  roman: 's',       slug: 'siin',  pos: 12, accepted: ['siin','seen','sin','s'],            sunMoon: 'sun'  },
  { arabic: 'ش', name: 'shiin', roman: 'sh',      slug: 'shiin', pos: 13, accepted: ['shiin','sheen','shin','sh'],        sunMoon: 'sun'  },
  { arabic: 'ص', name: 'saad',  roman: 'ṣ',       slug: 'saad',  pos: 14, accepted: ['saad','sad','s'],                  sunMoon: 'sun'  },
  { arabic: 'ض', name: 'daad',  roman: 'ḍ',       slug: 'daad',  pos: 15, accepted: ['daad','dad','d'],                  sunMoon: 'sun'  },
  { arabic: 'ط', name: 'taa',   roman: 'ṭ',       slug: 'taa',   pos: 16, accepted: ['taa','ta','t'],                    sunMoon: 'sun'  },
  { arabic: 'ظ', name: 'thaa',  roman: 'ẓ',       slug: 'thaa',  pos: 17, accepted: ['thaa','tha','dha','zh'],            sunMoon: 'sun'  },
  { arabic: 'ع', name: 'ayn',   roman: 'ʿ',       slug: 'ayn',   pos: 18, accepted: ['ayn','ain'],                        sunMoon: 'moon' },
  { arabic: 'غ', name: 'ghayn', roman: 'gh',      slug: 'ghayn', pos: 19, accepted: ['ghayn','ghain','gh'],               sunMoon: 'moon' },
  { arabic: 'ف', name: 'fa',    roman: 'f',       slug: 'fa',    pos: 20, accepted: ['fa','f'],                           sunMoon: 'moon' },
  { arabic: 'ق', name: 'qaf',   roman: 'q',       slug: 'qaf',   pos: 21, accepted: ['qaf','q'],                          sunMoon: 'moon' },
  { arabic: 'ك', name: 'kaf',   roman: 'k',       slug: 'kaf',   pos: 22, accepted: ['kaf','k'],                          sunMoon: 'moon' },
  { arabic: 'ل', name: 'lam',   roman: 'l',       slug: 'lam',   pos: 23, accepted: ['lam','l'],                          sunMoon: 'sun'  },
  { arabic: 'م', name: 'miim',  roman: 'm',       slug: 'miim',  pos: 24, accepted: ['miim','meem','m'],                  sunMoon: 'moon' },
  { arabic: 'ن', name: 'nuun',  roman: 'n',       slug: 'nuun',  pos: 25, accepted: ['nuun','nun','n'],                   sunMoon: 'sun'  },
  { arabic: 'ه', name: 'ha',    roman: 'h',       slug: 'ha',    pos: 26, accepted: ['ha','h'],                           sunMoon: 'moon' },
  { arabic: 'و', name: 'waw',   roman: 'w / ū',   slug: 'waw',   pos: 27, accepted: ['waw','w'],                          sunMoon: 'moon' },
  { arabic: 'ي', name: 'ya',    roman: 'y / ī',   slug: 'ya',    pos: 28, accepted: ['ya','y'],                           sunMoon: 'moon' },
];

export const SUN_LETTERS = LETTERS.filter(l => l.sunMoon === 'sun');
export const MOON_LETTERS = LETTERS.filter(l => l.sunMoon === 'moon');
