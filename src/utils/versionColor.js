// Version color palette - colors are assigned sequentially by major version number
// This ensures consistent colors across sessions and automatic color assignment for new versions
const VERSION_COLOR_PALETTE = [
  '#4A90E2',   // 0: Blue (for version 2.X - ARR)
  '#7B68EE',   // 1: Slate Blue (for version 3.X - Heavensward)
  '#FF6B6B',   // 2: Red (for version 4.X - Stormblood)
  '#FFD93D',   // 3: Yellow (for version 5.X - Shadowbringers)
  '#6BCF7F',   // 4: Green (for version 6.X - Endwalker)
  '#FF8C42',   // 5: Orange (for version 7.X - Dawntrail)
  '#9B59B6',   // 6: Purple (for future versions)
  '#1ABC9C',   // 7: Turquoise
  '#E74C3C',   // 8: Red
  '#3498DB',   // 9: Light Blue
  '#F39C12',   // 10: Orange
  '#16A085',   // 11: Green
  '#E67E22',   // 12: Dark Orange
  '#C0392B',   // 13: Dark Red
  '#8E44AD',   // 14: Dark Purple
  '#27AE60',   // 15: Dark Green
  '#2980B9',   // 16: Dark Blue
  '#D35400',   // 17: Brown
  '#34495E',   // 18: Dark Gray
  '#95A5A6',   // 19: Light Gray
];
const FALLBACK_COLOR = '#9CA3AF';

// The palette is tuned for the dark theme; on a light background several entries
// (yellow, green, orange) are too pale to read. Light mode darkens each color, keeping
// its hue, until it reaches 5:1 contrast (above WCAG AA 4.5:1) on the light surfaces.
const LIGHT_SURFACE = [247, 248, 250];
const MIN_CONTRAST = 5;

const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const luminance = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

function darkenForLightTheme(hex) {
  let rgb = toRgb(hex);
  while (contrast(rgb, LIGHT_SURFACE) < MIN_CONTRAST) {
    rgb = rgb.map((v) => v * 0.94);
  }
  return toHex(rgb);
}

const LIGHT_PALETTE = VERSION_COLOR_PALETTE.map(darkenForLightTheme);
const LIGHT_FALLBACK_COLOR = darkenForLightTheme(FALLBACK_COLOR);

// Version color mapping - assigns colors from palette based on major version number
// Same color for all patches in the same major version (e.g., 7.0-7.5 all use same color)
// Version 2.X uses index 0, version 3.X uses index 1, etc.
// Supports both "7.4" format and "7.X" format. Returns a 6-digit hex so callers can
// append an alpha suffix (e.g. `${color}20`).
export function getVersionColor(versionString, theme = 'dark') {
  const palette = theme === 'light' ? LIGHT_PALETTE : VERSION_COLOR_PALETTE;
  const fallback = theme === 'light' ? LIGHT_FALLBACK_COLOR : FALLBACK_COLOR;
  if (!versionString) return fallback;

  // Extract major version number (e.g., "7.4" -> 7, "6.5" -> 6, "6.X" -> 6)
  const majorVersion = parseInt(versionString.split('.')[0], 10);

  // Convert version to palette index: version 2.X -> index 0, version 3.X -> index 1, etc.
  const paletteIndex = majorVersion - 2;

  // For versions beyond palette, cycle through colors
  if (paletteIndex >= 0) {
    return palette[paletteIndex % palette.length];
  }

  // Default gray for invalid or very old versions (< 2.X)
  return fallback;
}
