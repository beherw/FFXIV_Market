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
 *   - surfaces: neutral gray page, white panels, and clear nested/hover levels;
 *   - dark tints (bg-*-800/900/950) become pale, desaturated tints;
 *   - solid accents (bg-*-50…700) keep their real color so buttons stay vivid;
 *   - pale text (text-*-300) becomes deep text (text-*-700);
 *   - `text-white` becomes dark primary text; `bg-white` remains a white surface.
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
    50: '#1f2937', 100: '#1f2937', 200: '#273142', 300: '#374151', 400: '#4b5563', 500: '#6b7280',
    600: '#6b7280', 700: '#6b7280',
    // Dark text only ever sits on light/solid fills, so it stays dark.
    800: defaultColors.slate[800], 900: defaultColors.slate[900], 950: defaultColors.slate[950],
  },
  // Light surfaces retain the distinct page, card, nested, and hover levels.
  bg: {
    50: '#1f2937', 100: '#374151', 200: '#4b5563', 300: '#6b7280', 400: '#9ca3af', 500: '#c5cdd8',
    600: '#d8dee8', 700: '#f3f4f6', 800: '#ffffff', 900: '#f8fafc', 950: '#f5f7fa',
  },
  // Borders use neutral hierarchy rather than tinted accent colors.
  border: {
    50: '#1f2937', 100: '#374151', 200: '#4b5563', 300: '#6b7280', 400: '#9ca3af', 500: '#c5cdd8',
    600: '#c5cdd8', 700: '#e5e9f0', 800: '#d8dee8', 900: '#d8dee8', 950: '#d8dee8',
  },
}
const LIGHT_PAGE = '#F5F7FA'
const LIGHT_BORDER_GRAY = '#D8DEE8'
const LIGHT_THEME_TOKENS = {
  '--bg-page': LIGHT_PAGE,
  '--bg-surface': '#FFFFFF',
  '--bg-surface-secondary': '#F8FAFC',
  '--bg-surface-hover': '#F3F4F6',
  '--border-default': '#D8DEE8',
  '--border-subtle': '#E5E9F0',
  '--border-strong': '#C5CDD8',
  '--border-input': '#CBD3DF',
  '--text-primary': '#1F2937',
  '--text-secondary': '#4B5563',
  '--text-muted': '#6B7280',
  '--text-disabled': '#9CA3AF',
  '--text-placeholder': '#7C8798',
  '--accent-orange': '#B45309',
  '--accent-purple': '#7C3AED',
  '--accent-purple-hover': '#6D28D9',
  '--accent-purple-soft': '#F3E8FF',
  '--accent-cyan': '#0891B2',
  '--accent-cyan-soft': '#ECFEFF',
  '--shadow-card': '0 1px 2px rgba(15, 23, 42, 0.04)',
  '--shadow-floating': '0 4px 6px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.08)',
}

// Brand colors: { dark, text, bg, border } (light values)
const BRAND_COLORS = {
  'ffxiv-dark': { dark: defaultColors.slate[900], text: '#1f2937', bg: LIGHT_PAGE, border: '#D8DEE8' },
  'ffxiv-darker': { dark: defaultColors.slate[950], text: '#111827', bg: LIGHT_PAGE, border: '#c3c9d2' },
  'ffxiv-blue': { dark: defaultColors.blue[500], text: defaultColors.blue[600], bg: defaultColors.blue[500], border: defaultColors.blue[400] },
  'ffxiv-blue-light': { dark: defaultColors.blue[400], text: defaultColors.blue[700], bg: defaultColors.blue[400], border: defaultColors.blue[300] },
  'ffxiv-purple': { dark: defaultColors.violet[500], text: '#6D28D9', bg: '#7C3AED', border: '#7C3AED' },
  'ffxiv-purple-light': { dark: defaultColors.violet[400], text: '#6D28D9', bg: '#F3E8FF', border: '#D8B4FE' },
  'ffxiv-gold': { dark: defaultColors.amber[400], text: '#B45309', bg: defaultColors.amber[400], border: defaultColors.amber[500] },
  'ffxiv-gold-dark': { dark: defaultColors.amber[500], text: defaultColors.amber[800], bg: defaultColors.amber[500], border: defaultColors.amber[600] },
  'ffxiv-accent': { dark: defaultColors.violet[400], text: '#7C3AED', bg: '#7C3AED', border: '#7C3AED' },
  'ffxiv-accent-light': { dark: defaultColors.violet[300], text: '#6D28D9', bg: '#F3E8FF', border: '#D8B4FE' },
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

// Light-mode text must stay comfortably readable on light surfaces (5:1, above WCAG AA 4.5:1). Mirrored hue
// shades such as yellow-600 or green-600 fall short, so darken them along their own hue.
const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
const readableOnLight = (hex) => {
  let color = hex
  while (contrast(color, LIGHT_PAGE) < 5) color = mix(color, '#000000', 0.06)
  return color
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

define('white', '#ffffff', { c: '#1f2937', bg: '#ffffff', bd: '#d8dee8' })
darkVars['--bd-default'] = channels(defaultColors.gray[200])
lightVars['--bd-default'] = channels('#D8DEE8')

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
      c: readableOnLight(mirrored),
      bg: shade >= 800 ? mix(mirrored, LIGHT_PAGE, 0.45) : ramp[shade],
      bd: mix(mirrored, LIGHT_BORDER_GRAY, 0.4),
    })
  }
}

for (const [name, { dark, text, bg, border }] of Object.entries(BRAND_COLORS)) {
  define(name, dark, { c: readableOnLight(text), bg, bd: border })
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
    borderColor: { ...borderPalette, DEFAULT: 'rgb(var(--bd-default) / <alpha-value>)' },
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
    plugin(({ addBase, addVariant }) => {
      addBase({
        ':root': darkVars,
        ':root[data-theme="light"]': { ...lightVars, ...LIGHT_THEME_TOKENS },
      })
      // One-off light-mode tweaks: `light:text-amber-400` applies only in day mode.
      addVariant('light', ':root[data-theme="light"] &')
    }),
  ],
}
