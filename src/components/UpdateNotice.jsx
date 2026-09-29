// Tells an open tab that a newer build has been deployed, so users don't keep searching old data.
// dist/version.json holds the live build id (see vite.config.js); we compare it with our own.
import { useEffect, useState } from 'react';
import { BUILD_ID } from '../utils/dataUrl';

const FIRST_CHECK_DELAY_MS = 15000; // stay out of the way of first-load requests
const POLL_INTERVAL_MS = 10 * 60 * 1000;
const MIN_GAP_MS = 60 * 1000; // throttle checks triggered by returning to the tab

export default function UpdateNotice() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (import.meta.env.DEV) return undefined;
    let lastCheck = 0;
    let stopped = false;

    const check = async () => {
      if (stopped || Date.now() - lastCheck < MIN_GAP_MS) return;
      lastCheck = Date.now();
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const { buildId } = await res.json();
        if (buildId && buildId !== BUILD_ID && !stopped) {
          stopped = true;
          setUpdateAvailable(true);
        }
      } catch {
        // Offline or blocked; try again on the next tick
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    const firstTimer = setTimeout(check, FIRST_CHECK_DELAY_MS);
    const interval = setInterval(check, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      clearTimeout(firstTimer);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (!updateAvailable) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[110] w-[calc(100%-2rem)] max-w-md bg-ffxiv-blue/95 text-white px-4 py-3 rounded-lg shadow-lg border border-white/20 animate-fadeIn"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm">網站已更新（含新版物品資料），重新載入以使用最新版本。</span>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1 rounded bg-white text-ffxiv-blue text-sm font-bold hover:bg-white/90"
          >
            重新載入
          </button>
          <button
            onClick={() => setUpdateAvailable(false)}
            className="text-white/80 hover:text-white"
            aria-label="關閉"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
