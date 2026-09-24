import { useEffect, useState } from 'react';

/**
 * Table-shaped placeholder shown while market data loads. Keeps the layout stable and, if the
 * upstream API is slow, says so instead of leaving an anonymous spinner that looks like a hang.
 */
export default function TableSkeleton({ rows = 8, columns = 5, slowAfterMs = 3000, slowMessage = 'Universalis 回應較慢，仍在載入中…' }) {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsSlow(true), slowAfterMs);
    return () => clearTimeout(timer);
  }, [slowAfterMs]);

  return (
    <div className="bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 rounded-lg border border-purple-500/20 p-3 flex-1" aria-busy="true">
      <div className="space-y-2">
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="flex gap-3">
            {Array.from({ length: columns }, (_, col) => (
              <div
                key={col}
                className="h-4 rounded bg-slate-700/50 skeleton-shimmer"
                style={{ flex: col === 0 ? 2 : 1, opacity: 1 - row * 0.07 }}
              />
            ))}
          </div>
        ))}
      </div>
      {isSlow && <p className="mt-3 text-xs text-gray-400 text-center">{slowMessage}</p>}
    </div>
  );
}
