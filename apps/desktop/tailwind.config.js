/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./electron/**/*.{js,ts}",
  ],
  theme: {
    extend: {
      colors: {
        nero: {
          bg: '#0a0a0f',
          'bg-secondary': '#0d0d14',
          'bg-tertiary': '#11111a',
          surface: 'rgba(255, 255, 255, 0.03)',
          'surface-hover': 'rgba(255, 255, 255, 0.06)',
          border: 'rgba(255, 255, 255, 0.08)',
          cyan: '#00d4ff',
          'cyan-dim': '#00aacc',
          'cyan-glow': 'rgba(0, 212, 255, 0.15)',
          blue: '#1a2a4a',
          'blue-accent': '#2563eb',
          text: '#e2e8f0',
          'text-muted': '#64748b',
          'text-dim': '#334155',
          error: '#ef4444',
          success: '#10b981',
          warning: '#f59e0b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      backgroundImage: {
        'nero-gradient': 'linear-gradient(135deg, #0a0a0f 0%, #0d0d1a 50%, #0a0f1a 100%)',
        'cyan-glow': 'radial-gradient(circle, rgba(0, 212, 255, 0.15) 0%, transparent 70%)',
        'glass': 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)',
      },
      animation: {
        'pulse-cyan': 'pulse-cyan 2s ease-in-out infinite',
        'spin-slow': 'spin 8s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        'pulse-cyan': {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        glow: {
          from: { boxShadow: '0 0 20px rgba(0, 212, 255, 0.3)' },
          to: { boxShadow: '0 0 40px rgba(0, 212, 255, 0.6)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
