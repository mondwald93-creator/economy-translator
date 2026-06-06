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
        // 디자인 시스템 (에디토리얼)
        brand: {
          green: '#22C55E',
          'green-dark': '#16A34A',
        },
        up: '#16A34A',
        dn: '#DC2626',
        ink: {
          DEFAULT: '#111827',
          muted: '#6B7280',
          subtle: '#9CA3AF',
        },
        line: '#F3F4F6',
        surface: '#F9FAFB',
        // 기존 컴포넌트 호환 alias (Phase 3/4에서 순차 제거)
        notion: {
          bg: '#ffffff',
          sidebar: '#F9FAFB',
          hover: '#F3F4F6',
          border: '#F3F4F6',
          text: '#111827',
          secondary: '#6B7280',
          muted: '#9CA3AF',
        },
        economy: {
          positive: '#22C55E',
          negative: '#DC2626',
          neutral: '#6B7280',
          warning: '#F59E0B',
        },
      },
      fontFamily: {
        sans: ['Noto Sans KR', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      borderRadius: {
        card: '14px',
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
