import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)',
        'paper-deep': 'var(--paper-deep)',
        ink: 'var(--ink)',
        'ink-soft': 'var(--ink-soft)',
        'stamp-red': 'var(--stamp-red)',
        'stamp-red-deep': 'var(--stamp-red-deep)',
        gold: 'var(--gold)',
        line: 'var(--line)',
        cream: 'var(--white)',
        'amber-bg': 'var(--amber-bg)',
        'amber-line': 'var(--amber-line)',
        good: 'var(--good)',
        'good-bg': 'var(--good-bg)',
        'warn-bg': 'var(--warn-bg)',
        'warn-line': 'var(--warn-line)',
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'serif'],
        sans: ['var(--font-sans)', 'Inter', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
}
export default config
