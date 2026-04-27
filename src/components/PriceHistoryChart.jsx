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
import { useMemo, useState, useCallback, useRef, useEffect } from 'react';

// Must match ComposedChart margin.left + YAxis width, and margin.right
const CHART_L = 8 + 52; // 60
const CHART_R = 20;
const CHART_T = 12;
const CHART_B = 8;        // chart margin.bottom (passed to Recharts)
const OVERLAY_B = 30;     // overlay clips above x-axis ticks (~22px) + margin (8px)

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

function calcMedian(prices) {
  if (!prices.length) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function movingAverage(data, windowSize) {
  return data.map((point, i) => {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(data.length, start + windowSize);
    const slice = data.slice(start, end);
    const avg = Math.round(slice.reduce((s, p) => s + p.pricePerUnit, 0) / slice.length);
    return { x: point.timestamp, ma: avg };
  });
}

function CustomTooltip({ active, payload, dataRef }) {
  if (!active || !payload?.length) return null;
  // Use find — Line (MA) entries appear first in payload and have no .timestamp
  const hovered = payload.find(p => p.payload?.timestamp)?.payload;
  if (!hovered) return null;

  const ctx = dataRef?.current;
  const xDomain = ctx?.xDomain;
  const hasNumericDomain = Array.isArray(xDomain) && typeof xDomain[0] === 'number';

  let items = null;
  if (ctx && hasNumericDomain) {
    const { showNq, showHq, visibleNqData, visibleHqData } = ctx;
    const hoveredTs = hovered.timestamp;
    const threshold = (xDomain[1] - xDomain[0]) * 0.04;
    const nearest = (data) => {
      if (!data?.length) return null;
      const p = data.reduce((best, p) =>
        Math.abs(p.timestamp - hoveredTs) < Math.abs(best.timestamp - hoveredTs) ? p : best
      );
      return Math.abs(p.timestamp - hoveredTs) <= threshold ? p : null;
    };
    const found = [
      showNq ? nearest(visibleNqData) : null,
      showHq ? nearest(visibleHqData) : null,
    ].filter(Boolean);
    if (found.length) items = found;
  }

  // Fallback: show the recharts-hovered point directly
  if (!items) items = [hovered];

  return (
    <div className="bg-slate-900/95 border border-purple-500/40 rounded-lg px-3 py-2 text-xs shadow-xl space-y-2">
      {items.map((d, i) => (
        <div key={i} className={i > 0 ? 'pt-2 border-t border-slate-700/50' : ''}>
          <p className={`${d.hq ? 'text-ffxiv-gold' : 'text-emerald-400'} font-semibold`}>
            {d.pricePerUnit?.toLocaleString()} gil · {d.hq ? 'HQ' : 'NQ'}
          </p>
          <p className="text-gray-400">數量: {d.quantity}　合計: {d.total?.toLocaleString()}</p>
          {d.worldName && <p className="text-gray-400">{d.worldName}</p>}
          <p className="text-gray-500">{formatDate(d.timestamp)}</p>
        </div>
      ))}
    </div>
  );
}

const VerticalCursor = ({ points, height }) => {
  if (!points?.length) return null;
  return (
    <line
      x1={points[0].x} y1={0}
      x2={points[0].x} y2={height}
      stroke="rgba(212,175,55,0.35)"
      strokeWidth={1}
      strokeDasharray="4 3"
    />
  );
};


export default function PriceHistoryChart({ history }) {
  const [filter, setFilter] = useState('all');
  const [zoomDomain, setZoomDomain] = useState(null);

  // Drag state in refs — no re-renders during drag
  const containerRef = useRef(null);
  const overlayRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartPxRef = useRef(null);
  const dragStartTsRef = useRef(null);
  const xDomainRef = useRef(null); // kept in sync with xDomain for use inside raw event handlers

  const base = useMemo(() => {
    if (!history?.length) return null;
    const sorted = [...history].sort((a, b) => a.timestamp - b.timestamp);
    const nqSorted = sorted.filter(e => !e.hq);
    const hqSorted = sorted.filter(e => e.hq);
    const nqData = nqSorted.map(e => ({ ...e, x: e.timestamp, y: e.pricePerUnit }));
    const hqData = hqSorted.map(e => ({ ...e, x: e.timestamp, y: e.pricePerUnit }));
    const nqWindow = Math.min(20, Math.max(5, Math.round(nqSorted.length * 0.1)));
    const hqWindow = Math.min(20, Math.max(5, Math.round(hqSorted.length * 0.1)));
    const nqMa = nqSorted.length >= 3 ? movingAverage(nqSorted, nqWindow) : [];
    const hqMa = hqSorted.length >= 3 ? movingAverage(hqSorted, hqWindow) : [];
    const allTs = sorted.map(e => e.timestamp);
    const xMin = allTs[0];
    const xMax = allTs[allTs.length - 1];

    const domainFor = (ts) => {
      if (!ts.length) return null;
      const pad = Math.max((ts[ts.length - 1] - ts[0]) * 0.005, 300);
      return [ts[0] - pad, ts[ts.length - 1] + pad];
    };
    const allXDomain = domainFor(allTs);
    const nqXDomain = domainFor(nqSorted.map(e => e.timestamp));
    const hqXDomain = domainFor(hqSorted.map(e => e.timestamp));

    return {
      nqData, hqData, nqMa, hqMa,
      allXDomain, nqXDomain, hqXDomain,
      hasNq: nqData.length > 0,
      hasHq: hqData.length > 0,
    };
  }, [history]);

  const { visibleNqData, visibleHqData, visibleNqMa, visibleHqMa, nqMedian, hqMedian, allMedian, xDomain, yDomain } = useMemo(() => {
    if (!base) return { visibleNqData: [], visibleHqData: [], visibleNqMa: [], visibleHqMa: [], nqMedian: null, hqMedian: null, allMedian: null, xDomain: ['auto', 'auto'], yDomain: ['auto', 'auto'] };
    const activeFilter = (!base.hasNq || !base.hasHq) ? 'all' : filter;
    const baseDomain = zoomDomain ?? (
      activeFilter === 'nq' ? base.nqXDomain :
      activeFilter === 'hq' ? base.hqXDomain :
      base.allXDomain
    );
    const [x1, x2] = baseDomain;
    const xLo = Math.min(x1, x2);
    const xHi = Math.max(x1, x2);
    const visibleNqData = base.nqData.filter(e => e.x >= xLo && e.x <= xHi);
    const visibleHqData = base.hqData.filter(e => e.x >= xLo && e.x <= xHi);
    const visibleNqMa = base.nqMa.filter(e => e.x >= xLo && e.x <= xHi);
    const visibleHqMa = base.hqMa.filter(e => e.x >= xLo && e.x <= xHi);
    const nqMedian = calcMedian(visibleNqData.map(e => e.pricePerUnit));
    const hqMedian = calcMedian(visibleHqData.map(e => e.pricePerUnit));
    const allMedian = calcMedian([...visibleNqData, ...visibleHqData].map(e => e.pricePerUnit));
    const prices = [...visibleNqData, ...visibleHqData].map(e => e.pricePerUnit).sort((a, b) => a - b);
    const cutoff = prices[Math.floor(prices.length * 0.98)] ?? prices[prices.length - 1] ?? 0;
    return {
      visibleNqData, visibleHqData, visibleNqMa, visibleHqMa,
      nqMedian, hqMedian, allMedian,
      xDomain: [xLo, xHi],
      yDomain: [0, Math.ceil(cutoff * 1.08) || 1],
    };
  }, [base, zoomDomain, filter]);

  // Keep a ref in sync so raw DOM handlers can read current xDomain
  useEffect(() => { xDomainRef.current = xDomain; }, [xDomain]);

  const effectiveFilter = (!base?.hasNq || !base?.hasHq) ? 'all' : filter;
  const showNq = effectiveFilter === 'all' || effectiveFilter === 'nq';
  const showHq = effectiveFilter === 'all' || effectiveFilter === 'hq';
  const medianPrice = effectiveFilter === 'nq' ? nqMedian : effectiveFilter === 'hq' ? hqMedian : allMedian;
  const medianLabel = effectiveFilter === 'nq' ? 'NQ中位' : effectiveFilter === 'hq' ? 'HQ中位' : '中位';
  const visibleCount = (showNq ? visibleNqData.length : 0) + (showHq ? visibleHqData.length : 0);
  const isZoomed = zoomDomain !== null;

  const tooltipDataRef = useRef({});
  tooltipDataRef.current = { showNq, showHq, visibleNqData, visibleHqData, xDomain };

  // Convert container-relative px to timestamp using current xDomain + chart margins
  const pxToTs = useCallback((px, containerWidth) => {
    const [tsMin, tsMax] = xDomainRef.current ?? ['auto', 'auto'];
    const innerW = containerWidth - CHART_L - CHART_R;
    const ratio = Math.max(0, Math.min(1, (px - CHART_L) / innerW));
    return tsMin + ratio * (tsMax - tsMin);
  }, []);

  // Raw DOM events on the container — bypasses React reconciliation entirely during drag
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onDown = (e) => {
      if (e.button !== 0) return;
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      if (px < CHART_L || px > rect.width - CHART_R) return;
      isDraggingRef.current = true;
      dragStartPxRef.current = px;
      dragStartTsRef.current = pxToTs(px, rect.width);
      el.style.cursor = 'col-resize';
      if (overlayRef.current) overlayRef.current.style.display = 'none';
      e.preventDefault();
    };

    const onMove = (e) => {
      if (!isDraggingRef.current) return;
      const rect = el.getBoundingClientRect();
      const px = Math.max(CHART_L, Math.min(e.clientX - rect.left, rect.width - CHART_R));
      const left = Math.min(dragStartPxRef.current, px);
      const width = Math.abs(px - dragStartPxRef.current);
      if (overlayRef.current) {
        overlayRef.current.style.left = `${left}px`;
        overlayRef.current.style.width = `${width}px`;
        overlayRef.current.style.display = 'block';
      }
    };

    const onUp = (e) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      el.style.cursor = 'crosshair';
      if (overlayRef.current) overlayRef.current.style.display = 'none';
      const rect = el.getBoundingClientRect();
      const px = Math.max(CHART_L, Math.min(e.clientX - rect.left, rect.width - CHART_R));
      if (Math.abs(px - dragStartPxRef.current) > 8) {
        const ts1 = dragStartTsRef.current;
        const ts2 = pxToTs(px, rect.width);
        setZoomDomain([Math.min(ts1, ts2), Math.max(ts1, ts2)]);
      }
      dragStartPxRef.current = null;
    };

    const onLeave = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      el.style.cursor = 'crosshair';
      if (overlayRef.current) overlayRef.current.style.display = 'none';
      dragStartPxRef.current = null;
    };

    el.addEventListener('mousedown', onDown);
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseup', onUp);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousedown', onDown);
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseup', onUp);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [pxToTs]);

  const resetZoom = useCallback(() => setZoomDomain(null), []);
  const handleFilterClick = (qual) => setFilter(prev => prev === qual ? 'all' : qual);

  if (!history?.length) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 rounded-lg border border-purple-500/20">
        暫無歷史數據
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 rounded-lg border border-purple-500/20 p-3 sm:p-4 select-none outline-none [&_.recharts-wrapper]:outline-none [&_svg:focus]:outline-none [&_svg]:outline-none">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base sm:text-lg font-semibold text-ffxiv-gold">成交價格走勢</h3>
          {isZoomed ? (
            <button
              onClick={resetZoom}
              className="text-xs px-2 py-0.5 rounded bg-slate-700/60 border border-slate-500/40 text-gray-400 hover:text-white hover:border-slate-400/60 transition-all"
            >
              重置
            </button>
          ) : (
            <span className="text-xs text-gray-600">拖曳可放大</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs">
          {base?.hasNq && (
            <button
              onClick={() => handleFilterClick('nq')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded transition-all ${
                effectiveFilter === 'nq'
                  ? 'bg-emerald-400/20 border border-emerald-400/50 text-emerald-300'
                  : effectiveFilter === 'hq'
                  ? 'opacity-30 text-gray-500'
                  : 'text-gray-400 hover:text-emerald-300'
              }`}
            >
              <span className="inline-block w-4 h-0.5 bg-emerald-400/70 rounded"></span>
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400/80"></span>NQ
            </button>
          )}
          {base?.hasHq && (
            <button
              onClick={() => handleFilterClick('hq')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded transition-all ${
                effectiveFilter === 'hq'
                  ? 'bg-ffxiv-gold/20 border border-ffxiv-gold/50 text-ffxiv-gold'
                  : effectiveFilter === 'nq'
                  ? 'opacity-30 text-gray-500'
                  : 'text-gray-400 hover:text-ffxiv-gold'
              }`}
            >
              <span className="inline-block w-4 h-0.5 bg-ffxiv-gold/70 rounded"></span>
              <span className="inline-block w-2 h-2 rounded-full bg-ffxiv-gold/80"></span>HQ
            </button>
          )}
          <span className="text-gray-500 ml-1">({visibleCount} 筆)</span>
        </div>
      </div>

      {/* Chart area — ref for raw DOM drag events, relative for overlay positioning */}
      <div ref={containerRef} className="relative select-none" style={{ height: 240, cursor: 'crosshair' }}>
        {/* CSS overlay for drag selection — updated via ref, zero re-renders */}
        <div
          ref={overlayRef}
          style={{
            display: 'none',
            position: 'absolute',
            top: CHART_T,
            bottom: OVERLAY_B,
            left: 0,
            width: 0,
            background: 'rgba(212,175,55,0.08)',
            border: '1px solid rgba(212,175,55,0.4)',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        />
        <ResponsiveContainer width="100%" height={240} className="outline-none [&_.recharts-wrapper]:outline-none [&_svg]:outline-none">
          <ComposedChart margin={{ top: CHART_T, right: CHART_R, bottom: CHART_B, left: 8 }}>
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
            <Tooltip
              content={<CustomTooltip dataRef={tooltipDataRef} />}
              cursor={<VerticalCursor />}
              isAnimationActive={false}
              animationDuration={0}
            />

            {showNq && base?.hasNq && (
              <Scatter name="NQ" data={visibleNqData} fill="rgba(52,211,153,0.45)" r={2.5} line={false} />
            )}
            {showHq && base?.hasHq && (
              <Scatter name="HQ" data={visibleHqData} fill="rgba(212,175,55,0.55)" r={2.5} line={false} />
            )}

            {showNq && visibleNqMa.length > 0 && (
              <Line data={visibleNqMa} dataKey="ma"
                dot={visibleNqData.length < 40 ? { r: 2.5, fill: 'rgba(52,211,153,0.75)', stroke: 'none' } : false}
                activeDot={false}
                stroke={visibleNqData.length < 40 ? 'rgba(52,211,153,0.35)' : 'rgba(52,211,153,0.9)'}
                strokeWidth={2} type="monotone" isAnimationActive={false} />
            )}
            {showHq && visibleHqMa.length > 0 && (
              <Line data={visibleHqMa} dataKey="ma"
                dot={visibleHqData.length < 40 ? { r: 2.5, fill: 'rgba(212,175,55,0.75)', stroke: 'none' } : false}
                activeDot={false}
                stroke={visibleHqData.length < 40 ? 'rgba(212,175,55,0.35)' : 'rgba(212,175,55,0.95)'}
                strokeWidth={2} type="monotone" isAnimationActive={false} />
            )}

            {medianPrice !== null && (
              <ReferenceLine
                y={medianPrice}
                stroke="rgba(148,163,184,0.55)"
                strokeDasharray="5 4"
                strokeWidth={1.5}
                label={{ value: `${medianLabel} ${formatPrice(medianPrice)}`, position: 'insideTopRight', fill: 'rgba(148,163,184,0.8)', fontSize: 10 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
