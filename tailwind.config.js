/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        'narrow': '520px', // 隐藏服务器分类按钮断点
        'mid': '890px',  // 搜索栏换排断点
        'detail': '980px', // 物品详情换排断点
      },
      colors: {
        'ffxiv-dark': '#0f172a',
        'ffxiv-darker': '#020617',
        'ffxiv-blue': '#3b82f6',
        'ffxiv-blue-light': '#60a5fa',
        'ffxiv-purple': '#8b5cf6',
        'ffxiv-purple-light': '#a78bfa',
        'ffxiv-gold': '#fbbf24',
        'ffxiv-gold-dark': '#f59e0b',
        'ffxiv-accent': '#a78bfa',
        'ffxiv-accent-light': '#c4b5fd',
      },
      backgroundImage: {
        'gradient-fantasy': 'linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(236, 72, 153, 0.25) 50%, rgba(99, 102, 241, 0.3) 100%)',
        'gradient-header': 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 50%, #6366f1 100%)',
      },
      boxShadow: {
        'fantasy': '0 8px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 0 30px rgba(251, 191, 36, 0.15)',
        'glow-gold': '0 0 10px rgba(251, 191, 36, 0.4), 0 0 20px rgba(251, 191, 36, 0.15)',
        'glow-blue': '0 0 10px rgba(139, 92, 246, 0.4), 0 0 20px rgba(139, 92, 246, 0.15)',
      },
    },
  },
  plugins: [],
}
