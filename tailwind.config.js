import defaultColors from 'tailwindcss/colors'
import plugin from 'tailwindcss/plugin'

/*
 * Theming (day/night mode)
 *
 * Every palette color resolves to a CSS variable, e.g. `bg-slate-900/80` →
 * `rgb(var(--c-slate-900) / 0.8)`. Dark mode keeps Tailwind's stock values, so
 * existing class names render exactly as before. Light mode (html[data-theme="light"])
 * swaps the variables:
 *   - hue ramps are mirrored (900↔100, 700↔300 …) so dark tints become light tints
 *     and pale text becomes deep text;
 *   - neutral ramps use a tuned map: 900 → white panels, 950 → page background,
 *     400/300 → readable secondary text;
 *   - `white` (mostly used as primary text) becomes near-black.
 * Hardcoded colors in CSS should use the same variables: rgb(var(--c-purple-500) / 0.3).
 */

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]

const HUE_FAMILIES = [
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan',
  'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
]
const NEUTRAL_FAMILIES = ['slate', 'gray', 'zinc', 'neutral', 'stone']

// Light-mode source shade for each neutral shade.
const NEUTRAL_LIGHT_MAP = {
  50: 950, 100: 900, 200: 800, 300: 700, 400: 600, 500: 500,
  600: 300, 700: 200, 800: 100, 900: 'white', 950: 100,
}

// Brand colors: [dark value, light value]
const BRAND_COLORS = {
  'ffxiv-dark': [defaultColors.slate[900], defaultColors.slate[100]],
  'ffxiv-darker': [defaultColors.slate[950], defaultColors.slate[50]],
  'ffxiv-blue': [defaultColors.blue[500], defaultColors.blue[600]],
  'ffxiv-blue-light': [defaultColors.blue[400], defaultColors.blue[700]],
  'ffxiv-purple': [defaultColors.violet[500], defaultColors.violet[600]],
  'ffxiv-purple-light': [defaultColors.violet[400], defaultColors.violet[700]],
  'ffxiv-gold': [defaultColors.amber[400], defaultColors.amber[700]],
  'ffxiv-gold-dark': [defaultColors.amber[500], defaultColors.amber[800]],
  'ffxiv-accent': [defaultColors.violet[400], defaultColors.violet[600]],
  'ffxiv-accent-light': [defaultColors.violet[300], defaultColors.violet[700]],
}

const toRgbChannels = (hex) => {
  const value = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)).join(' ')
}

const themedColor = (name) => `rgb(var(--c-${name}) / <alpha-value>)`

const darkVars = { '--c-white': toRgbChannels('#ffffff') }
const lightVars = { '--c-white': toRgbChannels(defaultColors.slate[900]) }
const colors = {
  transparent: 'transparent',
  current: 'currentColor',
  inherit: 'inherit',
  black: defaultColors.black,
  white: themedColor('white'),
}

for (const family of [...NEUTRAL_FAMILIES, ...HUE_FAMILIES]) {
  colors[family] = {}
  for (const shade of SHADES) {
    const name = `${family}-${shade}`
    colors[family][shade] = themedColor(name)
    darkVars[`--c-${name}`] = toRgbChannels(defaultColors[family][shade])
    const lightSource = NEUTRAL_FAMILIES.includes(family)
      ? NEUTRAL_LIGHT_MAP[shade]
      : 1000 - shade
    lightVars[`--c-${name}`] = toRgbChannels(
      lightSource === 'white' ? '#ffffff' : defaultColors[family][lightSource],
    )
  }
}

for (const [name, [dark, light]] of Object.entries(BRAND_COLORS)) {
  colors[name] = themedColor(name)
  darkVars[`--c-${name}`] = toRgbChannels(dark)
  lightVars[`--c-${name}`] = toRgbChannels(light)
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    colors,
    extend: {
      screens: {
        'narrow': '520px', // 隐藏服务器分类按钮断点
        'mid': '890px',  // 搜索栏换排断点
        'detail': '980px', // 物品详情换排断点
      },
      backgroundImage: {
        'gradient-fantasy': 'linear-gradient(135deg, rgb(var(--c-violet-500) / 0.3) 0%, rgb(var(--c-pink-500) / 0.25) 50%, rgb(var(--c-indigo-500) / 0.3) 100%)',
        'gradient-header': 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 50%, #6366f1 100%)',
      },
      boxShadow: {
        'fantasy': '0 8px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 0 30px rgba(251, 191, 36, 0.15)',
        'glow-gold': '0 0 10px rgba(251, 191, 36, 0.4), 0 0 20px rgba(251, 191, 36, 0.15)',
        'glow-blue': '0 0 10px rgba(139, 92, 246, 0.4), 0 0 20px rgba(139, 92, 246, 0.15)',
      },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ':root': darkVars,
        ':root[data-theme="light"]': lightVars,
      })
    }),
  ],
}
