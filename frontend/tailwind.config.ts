import type { Config } from 'tailwindcss';
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: { extend: { fontFamily: { mono: ['JetBrains Mono','Menlo','monospace'] } } },
  plugins: []
} satisfies Config;
