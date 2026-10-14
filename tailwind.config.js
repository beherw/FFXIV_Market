import defaultColors from 'tailwindcss/colors'
import plugin from 'tailwindcss/plugin'

/*
 * Theming (day/night mode)
 *
 * Every palette color resolves to a CSS variable, e.g. `bg-slate-900/80` →
 * `rgb(var(--bg-slate-900) / 0.8)`. There are three variable sets because the
 * same class name means different things depending on the property:
 *   --c-*   text, icons, rings, fills   (`text-slate-900` is ink on a gold button)
 *   --bg-*  backgrounds and gradients   (`bg-slate-900` is a dark panel)
 *   --bd-*  borders and dividers
 * Dark mode uses Tailwind's stock values for all three, so existing class names
 * render exactly as before. Light mode (html[data-theme="light"]) remaps them:
 *   - surfaces: page #f3f4f6, panels white, soft gray borders;
 *   - dark tints (bg-*-800/900/950) become pale, desaturated tints;
 *   - solid accents (bg-*-50…700) keep their real color so buttons stay vivid;
 *   - pale text (text-*-300) becomes deep text (text-*-700);
 *   - `white` (mostly primary text and faint overlays) becomes dark.
 * Hardcoded colors in CSS can use the same variables: rgb(var(--bd-purple-500) / 0.3).
 */

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]

const HUE_FAMILIES = [
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan',
  'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
]
const NEUTRAL_FAMILIES = ['slate', 'gray', 'zinc', 'neutral', 'stone']

// Light-mode neutral ramps, indexed by the dark-mode shade a class names.
const LIGHT_NEUTRAL = {
  text: {
    50: '#111827', 100: '#1f2937', 200: '#273142', 300: '#374151', 400: '#4b5563', 500: '#6b7280',
    600: '#9ca3af', 700: '#c4c9d1',
    // Dark text only ever sits on light/solid fills, so it stays dark.
    800: defaultColors.slate[800], 900: defaultColors.slate[900], 950: defaultColors.slate[950],
  },
  bg: {
    50: '#1f2937', 100: '#374151', 200: '#4b5563', 300: '#6b7280', 400: '#9ca3af', 500: '#c4c9d1',
    600: '#dfe2e7', 700: '#eceef1', 800: '#f7f8fa', 900: '#ffffff', 950: '#f3f4f6',
  },
  border: {
    50: '#1f2937', 100: '#374151', 200: '#4b5563', 300: '#6b7280', 400: '#9ca3af', 500: '#c4c9d1',
    600: '#d5d9df', 700: '#e3e6ea', 800: '#eceef1', 900: '#eceef1', 950: '#eceef1',
  },
}
const LIGHT_PAGE = LIGHT_NEUTRAL.bg[950]
const LIGHT_BORDER_GRAY = '#9ca3af'

// Brand colors: { dark, text, bg, border } (light values)
const BRAND_COLORS = {
  'ffxiv-dark': { dark: defaultColors.slate[900], text: '#1f2937', bg: LIGHT_PAGE, border: '#e3e6ea' },
  'ffxiv-darker': { dark: defaultColors.slate[950], text: '#111827', bg: LIGHT_PAGE, border: '#e3e6ea' },
  'ffxiv-blue': { dark: defaultColors.blue[500], text: defaultColors.blue[600], bg: defaultColors.blue[500], border: defaultColors.blue[400] },
  'ffxiv-blue-light': { dark: defaultColors.blue[400], text: defaultColors.blue[700], bg: defaultColors.blue[400], border: defaultColors.blue[300] },
  'ffxiv-purple': { dark: defaultColors.violet[500], text: defaultColors.violet[600], bg: defaultColors.violet[500], border: defaultColors.violet[400] },
  'ffxiv-purple-light': { dark: defaultColors.violet[400], text: defaultColors.violet[700], bg: defaultColors.violet[400], border: defaultColors.violet[300] },
  'ffxiv-gold': { dark: defaultColors.amber[400], text: '#b45309', bg: defaultColors.amber[400], border: defaultColors.amber[500] },
  'ffxiv-gold-dark': { dark: defaultColors.amber[500], text: defaultColors.amber[800], bg: defaultColors.amber[500], border: defaultColors.amber[600] },
  'ffxiv-accent': { dark: defaultColors.violet[400], text: defaultColors.violet[600], bg: defaultColors.violet[400], border: defaultColors.violet[300] },
  'ffxiv-accent-light': { dark: defaultColors.violet[300], text: defaultColors.violet[700], bg: defaultColors.violet[300], border: defaultColors.violet[200] },
}

const hexToRgb = (hex) => {
  const value = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16))
}
const channels = (hex) => hexToRgb(hex).join(' ')
// Blend `hex` toward `target` by `amount` (0 = hex, 1 = target).
const mix = (hex, target, amount) => {
  const a = hexToRgb(hex)
  const b = hexToRgb(target)
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * amount).toString(16).padStart(2, '0')).join('')
}

const SETS = ['c', 'bg', 'bd']
const palettes = { c: {}, bg: {}, bd: {} }
const darkVars = {}
const lightVars = {}

const define = (name, dark, light) => {
  for (const set of SETS) {
    palettes[set][name] = `rgb(var(--${set}-${name}) / <alpha-value>)`
    darkVars[`--${set}-${name}`] = channels(dark)
    lightVars[`--${set}-${name}`] = channels(light[set])
  }
}

const nest = (palette) => {
  const nested = {}
  for (const [name, value] of Object.entries(palette)) {
    const match = name.match(/^([a-z]+)-(\d+)$/)
    if (match && SHADES.includes(Number(match[2]))) {
      nested[match[1]] ??= {}
      nested[match[1]][match[2]] = value
    } else {
      nested[name] = value
    }
  }
  return nested
}

define('white', '#ffffff', { c: '#1f2937', bg: '#0f172a', bd: '#0f172a' })

for (const family of NEUTRAL_FAMILIES) {
  for (const shade of SHADES) {
    define(`${family}-${shade}`, defaultColors[family][shade], {
      c: LIGHT_NEUTRAL.text[shade],
      bg: LIGHT_NEUTRAL.bg[shade],
      bd: LIGHT_NEUTRAL.border[shade],
    })
  }
}

for (const family of HUE_FAMILIES) {
  const ramp = defaultColors[family]
  for (const shade of SHADES) {
    const mirrored = ramp[1000 - shade]
    define(`${family}-${shade}`, ramp[shade], {
      c: mirrored,
      bg: shade >= 800 ? mix(mirrored, LIGHT_PAGE, 0.45) : ramp[shade],
      bd: mix(mirrored, LIGHT_BORDER_GRAY, 0.45),
    })
  }
}

for (const [name, { dark, text, bg, border }] of Object.entries(BRAND_COLORS)) {
  define(name, dark, { c: text, bg, bd: border })
}

const fixed = {
  transparent: 'transparent',
  current: 'currentColor',
  inherit: 'inherit',
  black: defaultColors.black,
  // Same in both themes: text on solid accent fills (e.g. white on a purple button).
  'on-accent': '#ffffff',
}

const textPalette = { ...fixed, ...nest(palettes.c) }
const bgPalette = { ...fixed, ...nest(palettes.bg) }
const borderPalette = { ...fixed, ...nest(palettes.bd) }

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    colors: textPalette,
    backgroundColor: bgPalette,
    gradientColorStops: bgPalette,
    borderColor: { ...borderPalette, DEFAULT: 'rgb(var(--bd-gray-200) / <alpha-value>)' },
    divideColor: borderPalette,
    extend: {
      screens: {
        'narrow': '520px', // 隐藏服务器分类按钮断点
        'mid': '890px',  // 搜索栏换排断点
        'detail': '980px', // 物品详情换排断点
      },
      backgroundImage: {
        'gradient-fantasy': 'linear-gradient(135deg, rgb(var(--bg-violet-500) / 0.3) 0%, rgb(var(--bg-pink-500) / 0.25) 50%, rgb(var(--bg-indigo-500) / 0.3) 100%)',
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
