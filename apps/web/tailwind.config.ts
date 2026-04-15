import type { Config } from 'tailwindcss'
import forms from '@tailwindcss/forms'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        coin: '#2563eb',
        diamond: '#7c3aed',
      },
    },
  },
  plugins: [forms],
}

export default config
