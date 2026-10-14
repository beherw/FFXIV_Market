import { useTheme } from '../hooks/useTheme';

const SUN = 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z';
const MOON = 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z';

export default function ThemeToggle({ showLabel = false }) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';
  const label = isLight ? '切換為夜間模式' : '切換為日間模式';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`tb-btn ${showLabel ? '' : 'tb-btn-icon'}`}
      title={label}
      aria-label={label}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="tb-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isLight ? MOON : SUN} />
      </svg>
      {showLabel && <span>{isLight ? '夜間模式' : '日間模式'}</span>}
    </button>
  );
}
