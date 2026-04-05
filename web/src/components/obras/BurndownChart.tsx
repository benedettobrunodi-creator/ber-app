'use client';

import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';

interface SeqEtapa {
  id: string;
  name: string;
  order: number;
  estimatedDays: number;
  startDate: string | null;
  endDate: string | null;
  status: string;
  approvedAt: string | null;
}

interface BurndownChartProps {
  etapas: SeqEtapa[];
}

const DAY_MS = 86400000;

function formatDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

export default function BurndownChart({ etapas }: BurndownChartProps) {
  const data = useMemo(() => {
    if (!etapas.length) return null;

    const total = etapas.length;
    const sorted = [...etapas].sort((a, b) => a.order - b.order);

    // Find project start: earliest startDate among etapas, or fallback to first etapa
    const startDates = sorted.map(e => e.startDate).filter(Boolean) as string[];
    if (!startDates.length) return null;
    const projectStart = new Date(startDates.reduce((min, d) => d < min ? d : min, startDates[0]));

    // Total estimated days = sum of all estimatedDays
    const totalEstDays = sorted.reduce((sum, e) => sum + (e.estimatedDays || 0), 0);
    if (totalEstDays === 0) return null;
    const projectEnd = addDays(projectStart, totalEstDays);

    // Collect approved dates (etapas that have been completed/approved)
    const approvedDates: Date[] = sorted
      .filter(e => e.endDate || e.approvedAt)
      .map(e => new Date((e.endDate || e.approvedAt)!))
      .sort((a, b) => a.getTime() - b.getTime());

    // Build data points
    // We create one point per day from start to max(today, projectEnd, lastApproved)
    const today = new Date();
    const lastApproved = approvedDates.length ? approvedDates[approvedDates.length - 1] : projectStart;
    const chartEnd = new Date(Math.max(projectEnd.getTime(), today.getTime(), lastApproved.getTime()));

    const totalDays = Math.ceil((chartEnd.getTime() - projectStart.getTime()) / DAY_MS);

    // Sample at most ~60 points for performance
    const step = Math.max(1, Math.floor(totalDays / 60));
    const points: { date: string; dateTs: number; ideal: number; real: number | null }[] = [];

    for (let d = 0; d <= totalDays; d += step) {
      const currentDate = addDays(projectStart, d);
      const dateStr = formatDate(currentDate);
      const dateTs = currentDate.getTime();

      // Ideal: linear decrease from total to 0 over totalEstDays
      const idealProgress = Math.min(d / totalEstDays, 1);
      const ideal = Math.max(0, Math.round((total - total * idealProgress) * 10) / 10);

      // Real: count how many etapas were NOT yet approved by this date
      const approvedByDate = approvedDates.filter(ad => ad.getTime() <= dateTs).length;
      // Only show real line up to today (not into the future)
      const real = currentDate.getTime() <= today.getTime() + DAY_MS
        ? total - approvedByDate
        : null;

      points.push({ date: dateStr, dateTs, ideal, real });
    }

    // Ensure last point is included
    const lastDate = addDays(projectStart, totalDays);
    if (points.length === 0 || points[points.length - 1].dateTs < lastDate.getTime() - DAY_MS) {
      const approvedByEnd = approvedDates.filter(ad => ad.getTime() <= lastDate.getTime()).length;
      points.push({
        date: formatDate(lastDate),
        dateTs: lastDate.getTime(),
        ideal: 0,
        real: lastDate.getTime() <= today.getTime() + DAY_MS ? total - approvedByEnd : null,
      });
    }

    // Determine status
    const todayPoint = points.find(p => p.dateTs >= today.getTime() - DAY_MS && p.dateTs <= today.getTime() + DAY_MS);
    const isLate = todayPoint && todayPoint.real !== null && todayPoint.real > todayPoint.ideal;

    return { points, total, isLate, projectStart, projectEnd, approvedCount: approvedDates.length };
  }, [etapas]);

  if (!data) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-gray-400">Configure o sequenciamento para ver o burndown</p>
      </div>
    );
  }

  const { points, total, isLate, approvedCount } = data;
  const realColor = isLate ? '#EF4444' : '#22C55E';

  return (
    <div>
      {/* Summary badges */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs font-semibold text-gray-500">
          {approvedCount}/{total} etapas concluídas
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
          isLate ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
        }`}>
          {isLate ? 'Atrasado' : 'No prazo'}
        </span>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={points} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#9CA3AF' }}
            interval="preserveStartEnd"
            tickCount={8}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#9CA3AF' }}
            domain={[0, total]}
            allowDecimals={false}
            width={30}
            label={{ value: 'Restantes', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#9CA3AF' }}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
            formatter={(value: any, name: string) => [
              value !== null ? `${value} etapa${value !== 1 ? 's' : ''}` : '—',
              name === 'ideal' ? 'Ideal' : 'Real',
            ]}
          />
          <Legend
            verticalAlign="top"
            height={28}
            formatter={(value: string) => (
              <span style={{ fontSize: 11, color: '#6B7280' }}>
                {value === 'ideal' ? 'Ideal' : 'Real'}
              </span>
            )}
          />
          {/* Today reference line */}
          <ReferenceLine
            x={formatDate(new Date())}
            stroke="#9CA3AF"
            strokeDasharray="4 4"
            label={{ value: 'Hoje', fontSize: 10, fill: '#9CA3AF', position: 'top' }}
          />
          {/* Ideal line */}
          <Line
            type="monotone"
            dataKey="ideal"
            stroke="#94A3B8"
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={false}
            connectNulls
          />
          {/* Real line */}
          <Line
            type="stepAfter"
            dataKey="real"
            stroke={realColor}
            strokeWidth={2.5}
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
