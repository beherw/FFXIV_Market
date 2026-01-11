/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'ffxiv-dark': '#0a0e1a',
        'ffxiv-darker': '#050810',
        'ffxiv-blue': '#1e3a5f',
        'ffxiv-blue-light': '#2a4a6f',
        'ffxiv-purple': '#4a2c5a',
        'ffxiv-purple-light': '#5a3c6a',
        'ffxiv-gold': '#d4af37',
        'ffxiv-gold-dark': '#b8941f',
        'ffxiv-accent': '#5b9bd5',
        'ffxiv-accent-light': '#7bb5e5',
      },
      backgroundImage: {
        'gradient-fantasy': 'linear-gradient(135deg, rgba(30, 58, 95, 0.4) 0%, rgba(74, 44, 90, 0.4) 100%)',
        'gradient-header': 'linear-gradient(135deg, #1e3a5f 0%, #4a2c5a 50%, #1e3a5f 100%)',
      },
      boxShadow: {
        'fantasy': '0 8px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 0 30px rgba(212, 175, 55, 0.1)',
        'glow-gold': '0 0 10px rgba(212, 175, 55, 0.3), 0 0 20px rgba(212, 175, 55, 0.1)',
        'glow-blue': '0 0 10px rgba(91, 155, 213, 0.3), 0 0 20px rgba(91, 155, 213, 0.1)',
      },
    },
  },
  plugins: [],
}
