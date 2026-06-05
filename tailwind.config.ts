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
        brand: {
          50: '#f0f9ff',
          500: '#0ea5e9',
          600: '#0284c7',
        },
        economy: {
          positive: '#22c55e',
          negative: '#ef4444',
          neutral: '#6b7280',
          warning: '#f59e0b',
        },
        notion: {
          bg: '#ffffff',
          sidebar: '#f7f7f5',
          hover: '#efefed',
          border: '#e9e9e7',
          text: '#37352f',
          secondary: '#6b6b6b',
          muted: '#9b9b9b',
        },
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: '65ch',
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
  ],
}
export default config
