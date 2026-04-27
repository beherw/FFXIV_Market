import {
  ComposedChart,
  Scatter,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useMemo } from 'react';

function formatPrice(v) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return String(v);
}

function formatDate(ts) {
  const d = new Date(ts * 1000);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${m}/${day} ${h}:${min}`;
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  // Find the scatter payload (moving avg line payload has no timestamp)
  const scatter = payload.find(p => p.payload?.timestamp);
  if (!scatter) return null;
  const d = scatter.payload;
  return (
    <div className="bg-slate-900/95 border border-purple-500/40 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-ffxiv-gold font-semibold">{d.pricePerUnit?.toLocaleString()} gil{d.hq ? ' · HQ' : ' · NQ'}</p>
      <p className="text-gray-400">數量: {d.quantity}　合計: {d.total?.toLocaleString()}</p>
      {d.worldName && <p className="text-gray-400">{d.worldName}</p>}
      <p className="text-gray-500">{formatDate(d.timestamp)}</p>
    </div>
  );
};

function movingAverage(data, windowSize) {
  return data.map((point, i) => {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(data.length, start + windowSize);
    const slice = data.slice(start, end);
    const avg = Math.round(slice.reduce((s, p) => s + p.pricePerUnit, 0) / slice.length);
    return { x: point.timestamp, ma: avg };
  });
}

export default function PriceHistoryChart({ history }) {
  const { nqData, hqData, nqMa, hqMa, medianPrice, xDomain, yDomain, hasHq, hasNq } = useMemo(() => {
    if (!history?.length) return { nqData: [], hqData: [], nqMa: [], hqMa: [], medianPrice: null, xDomain: ['auto', 'auto'], yDomain: ['auto', 'auto'], hasHq: false, hasNq: false };

    const sorted = [...history].sort((a, b) => a.timestamp - b.timestamp);
    const nqSorted = sorted.filter(e => !e.hq);
    const hqSorted = sorted.filter(e => e.hq);

    const nqData = nqSorted.map(e => ({ ...e, x: e.timestamp, y: e.pricePerUnit }));
    const hqData = hqSorted.map(e => ({ ...e, x: e.timestamp, y: e.pricePerUnit }));

    // Window size: ~10% of dataset, min 5, max 20
    const nqWindow = Math.min(20, Math.max(5, Math.round(nqSorted.length * 0.1)));
    const hqWindow = Math.min(20, Math.max(5, Math.round(hqSorted.length * 0.1)));
    const nqMa = nqSorted.length >= 3 ? movingAverage(nqSorted, nqWindow) : [];
    const hqMa = hqSorted.length >= 3 ? movingAverage(hqSorted, hqWindow) : [];

    const allPrices = sorted.map(e => e.pricePerUnit).sort((a, b) => a - b);
    const mid = Math.floor(allPrices.length / 2);
    const medianPrice = allPrices.length % 2 === 0
      ? Math.round((allPrices[mid - 1] + allPrices[mid]) / 2)
      : allPrices[mid];

    // Trim top 2% outliers so chart isn't squashed by spikes
    const cutoff = allPrices[Math.floor(allPrices.length * 0.98)] ?? allPrices[allPrices.length - 1];
    const yMax = Math.ceil(cutoff * 1.08);

    const allTs = sorted.map(e => e.timestamp);
    const xMin = allTs[0];
    const xMax = allTs[allTs.length - 1];
    const xPad = Math.max((xMax - xMin) * 0.02, 3600);

    return {
      nqData, hqData, nqMa, hqMa, medianPrice,
      xDomain: [xMin - xPad, xMax + xPad],
      yDomain: [0, yMax],
      hasNq: nqData.length > 0,
      hasHq: hqData.length > 0,
    };
  }, [history]);

  if (!history?.length) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 rounded-lg border border-purple-500/20">
        暫無歷史數據
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 rounded-lg border border-purple-500/20 p-3 sm:p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base sm:text-lg font-semibold text-ffxiv-gold">成交價格走勢</h3>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {hasNq && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-5 h-0.5 bg-emerald-400/60 rounded"></span>
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400/80"></span>NQ
            </span>
          )}
          {hasHq && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-5 h-0.5 bg-ffxiv-gold/60 rounded"></span>
              <span className="inline-block w-2 h-2 rounded-full bg-ffxiv-gold/80"></span>HQ
            </span>
          )}
          <span className="text-gray-500">({history.length} 筆)</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart margin={{ top: 12, right: 20, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.12)" />
          <XAxis
            dataKey="x"
            type="number"
            domain={xDomain}
            scale="time"
            tickCount={5}
            tickFormatter={ts => {
              const d = new Date(ts * 1000);
              return `${d.getMonth() + 1}/${d.getDate()}`;
            }}
            stroke="#6b7280"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(139,92,246,0.2)' }}
          />
          <YAxis
            type="number"
            domain={yDomain}
            tickFormatter={formatPrice}
            stroke="#6b7280"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(139,92,246,0.2)' }}
            width={52}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(212,175,55,0.2)', strokeWidth: 1 }} />

          {/* Scatter dots — rendered first (bottom layer) */}
          {hasNq && (
            <Scatter name="NQ" data={nqData} fill="rgba(52,211,153,0.45)" r={2.5} line={false} />
          )}
          {hasHq && (
            <Scatter name="HQ" data={hqData} fill="rgba(212,175,55,0.55)" r={2.5} line={false} />
          )}

          {/* Moving average lines — rendered above dots */}
          {nqMa.length > 0 && (
            <Line
              data={nqMa}
              dataKey="ma"
              dot={false}
              activeDot={false}
              stroke="rgba(52,211,153,0.9)"
              strokeWidth={2}
              type="monotone"
              isAnimationActive={false}
            />
          )}
          {hqMa.length > 0 && (
            <Line
              data={hqMa}
              dataKey="ma"
              dot={false}
              activeDot={false}
              stroke="rgba(212,175,55,0.95)"
              strokeWidth={2}
              type="monotone"
              isAnimationActive={false}
            />
          )}

          {/* Median reference line — rendered last so it sits on top */}
          {medianPrice !== null && (
            <ReferenceLine
              y={medianPrice}
              stroke="rgba(148,163,184,0.55)"
              strokeDasharray="5 4"
              strokeWidth={1.5}
              label={{ value: `中位 ${formatPrice(medianPrice)}`, position: 'insideTopRight', fill: 'rgba(148,163,184,0.8)', fontSize: 10 }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
