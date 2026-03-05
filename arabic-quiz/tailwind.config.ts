import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#f7f4ef',
        surface: '#ffffff',
        ink: '#1a1a18',
        muted: '#888880',
        border: '#e2ddd6',
        accent: { DEFAULT: '#c0392b', light: '#f9ede9' },
        success: { DEFAULT: '#27ae60', light: '#eafaf1' },
        warning: { DEFAULT: '#e67e22', light: '#fef5ec' },
      },
      fontFamily: {
        display: ['"DM Serif Display"', 'serif'],
        mono: ['"DM Mono"', 'monospace'],
        arabic: ['"Noto Naskh Arabic"', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
