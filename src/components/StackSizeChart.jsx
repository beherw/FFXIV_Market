import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from 'recharts';
import { useMemo } from 'react';

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-slate-900/95 border border-purple-500/40 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-ffxiv-gold font-semibold">堆疊數: {d.size}</p>
      <p className="text-gray-300">成交次數: <span className="text-emerald-400 font-semibold">{d.count}</span></p>
    </div>
  );
};

export default function StackSizeChart({ stackSizeHistogram }) {
  const data = useMemo(() => {
    if (!stackSizeHistogram || typeof stackSizeHistogram !== 'object') return [];
    return Object.entries(stackSizeHistogram)
      .map(([k, v]) => ({ size: Number(k), count: Number(v) }))
      .filter(d => d.count > 0)
      .sort((a, b) => a.size - b.size);
  }, [stackSizeHistogram]);

  const maxCount = useMemo(() => Math.max(...data.map(d => d.count), 1), [data]);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 rounded-lg border border-purple-500/20">
        暫無堆疊分佈數據
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 rounded-lg border border-purple-500/20 p-3 sm:p-4 select-none">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base sm:text-lg font-semibold text-ffxiv-gold">堆疊數量分佈</h3>
        <span className="text-xs text-gray-500">{data.length} 種堆疊</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.15)" vertical={false} />
          <XAxis
            dataKey="size"
            stroke="#6b7280"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(139,92,246,0.2)' }}
            label={{ value: '堆疊數', position: 'insideBottom', offset: -2, fill: '#6b7280', fontSize: 10 }}
          />
          <YAxis
            stroke="#6b7280"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(139,92,246,0.2)' }}
            width={40}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(139,92,246,0.1)' }} />
          <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={48}>
            {data.map((entry) => (
              <Cell
                key={entry.size}
                fill={`rgba(139,92,246,${0.4 + 0.6 * (entry.count / maxCount)})`}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
