'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { LogIn, LogOut, MapPin, Clock, AlertCircle, Download, Users, Calendar } from 'lucide-react';

// --- Types ---

interface TimeEntry {
  id: string;
  type: 'checkin' | 'checkout';
  timestamp: string;
  latitude: string | null;
  longitude: string | null;
  address: string | null;
  obra: { id: string; name: string } | null;
}

interface ExportUser {
  id: string;
  name: string;
  role: string;
}

interface StatusResponse {
  isCheckedIn: boolean;
  lastEntry: TimeEntry | null;
  checkedInSince: string | null;
}

interface DayGroup {
  date: string;
  entries: TimeEntry[];
  totalHours: number | null;
}

// --- Helpers ---

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
}

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h${m > 0 ? ` ${m}min` : ''}`;
}

function calcDayHours(entries: TimeEntry[]): number | null {
  const sorted = [...entries].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  let total = 0;
  let hasCheckout = false;

  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].type === 'checkin') {
      const checkout = sorted.find((e, j) => j > i && e.type === 'checkout');
      if (checkout) {
        total += (new Date(checkout.timestamp).getTime() - new Date(sorted[i].timestamp).getTime()) / 3600000;
        hasCheckout = true;
      }
    }
  }

  return hasCheckout ? Math.round(total * 100) / 100 : null;
}

function groupByDay(entries: TimeEntry[]): DayGroup[] {
  const groups: Record<string, TimeEntry[]> = {};

  for (const entry of entries) {
    const date = new Date(entry.timestamp).toISOString().split('T')[0];
    if (!groups[date]) groups[date] = [];
    groups[date].push(entry);
  }

  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, entries]) => ({
      date,
      entries: entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
      totalHours: calcDayHours(entries),
    }));
}

// --- Component ---

export default function PontoPage() {
  const user = useAuthStore((s) => s.user);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState('');

  // Export state
  const canExport = user?.role === 'diretoria' || user?.role === 'coordenacao';
  const [exportUsers, setExportUsers] = useState<ExportUser[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [exportStartDate, setExportStartDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [exportEndDate, setExportEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, entriesRes] = await Promise.all([
        api.get('/time-entries/me/status'),
        api.get('/time-entries/me', { params: { limit: 200 } }),
      ]);
      setStatus(statusRes.data.data);
      setEntries(entriesRes.data.data);
    } catch { /* interceptor */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch users for export
  useEffect(() => {
    if (!canExport) return;
    api.get('/users').then((res) => {
      setExportUsers(res.data.data);
    }).catch(() => {});
  }, [canExport]);

  // Export handler
  async function handleExport() {
    if (selectedUserIds.size === 0) return;
    setExporting(true);
    try {
      const res = await api.get('/time-entries/export', {
        params: {
          userIds: Array.from(selectedUserIds).join(','),
          startDate: exportStartDate,
          endDate: exportEndDate,
        },
        responseType: 'blob',
      });
      const blob = new Blob([res.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-ponto-${exportStartDate}-${exportEndDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // interceptor handles errors
    } finally {
      setExporting(false);
    }
  }

  // Elapsed timer
  useEffect(() => {
    if (!status?.isCheckedIn || !status.checkedInSince) return;

    function updateElapsed() {
      const diff = Date.now() - new Date(status!.checkedInSince!).getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    }

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [status?.isCheckedIn, status?.checkedInSince]);

  async function handleToggle() {
    setError(null);
    setSubmitting(true);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      const payload = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      if (status?.isCheckedIn) {
        await api.post('/time-entries/checkout', payload);
      } else {
        await api.post('/time-entries/checkin', payload);
      }

      await fetchData();
    } catch (err: any) {
      if (err?.code === 1) {
        setError('Permissao de localizacao negada. Habilite nas configuracoes do navegador.');
      } else if (err?.code === 2 || err?.code === 3) {
        setError('Nao foi possivel obter a localizacao. Tente novamente.');
      } else {
        setError(err?.response?.data?.error?.message || 'Erro ao registrar ponto.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const today = new Date().toISOString().split('T')[0];
  const dayGroups = groupByDay(entries);
  const todayGroup = dayGroups.find((g) => g.date === today);
  const historyGroups = dayGroups.filter((g) => g.date !== today);

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-black text-ber-carbon">Ponto</h1>
        <div className="mt-6 py-12 text-center text-sm text-ber-gray">Carregando...</div>
      </div>
    );
  }

  const isCheckedIn = status?.isCheckedIn ?? false;

  return (
    <div>
      <h1 className="text-2xl font-black text-ber-carbon">Ponto</h1>

      {/* Card central */}
      <div className="mx-auto mt-8 max-w-md">
        <div className={`rounded-xl bg-white p-8 text-center shadow-sm ${isCheckedIn ? 'ring-2 ring-ber-olive/30' : ''}`}>
          {/* Status */}
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ber-gray">
            {isCheckedIn ? 'Em expediente' : 'Fora de expediente'}
          </div>

          {/* Timer */}
          {isCheckedIn && elapsed && (
            <div className="mb-4 font-mono text-3xl font-black text-ber-carbon">{elapsed}</div>
          )}

          {/* Checkin time info */}
          {isCheckedIn && status?.checkedInSince && (
            <div className="mb-6 flex items-center justify-center gap-1 text-xs text-ber-gray">
              <Clock size={12} />
              Entrada as {formatTime(status.checkedInSince)}
            </div>
          )}

          {/* Button */}
          <button
            onClick={handleToggle}
            disabled={submitting}
            className={`inline-flex items-center gap-3 rounded-xl px-10 py-4 text-lg font-bold text-white transition-all disabled:opacity-50 ${
              isCheckedIn
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-ber-olive hover:bg-ber-olive/90'
            }`}
          >
            {isCheckedIn ? <LogOut size={24} /> : <LogIn size={24} />}
            {submitting
              ? 'Registrando...'
              : isCheckedIn
                ? 'Registrar Saida'
                : 'Registrar Entrada'}
          </button>

          {/* Location note */}
          <div className="mt-4 flex items-center justify-center gap-1 text-[11px] text-ber-gray/70">
            <MapPin size={10} />
            Localizacao sera solicitada ao registrar
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-600">
              <AlertCircle size={14} className="shrink-0" />
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Registros de hoje */}
      <div className="mx-auto mt-8 max-w-2xl">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ber-gray">Hoje</h2>
        {todayGroup && todayGroup.entries.length > 0 ? (
          <div className="mt-3 rounded-lg bg-white p-4 shadow-sm">
            <div className="space-y-2">
              {todayGroup.entries.map((e) => (
                <div key={e.id} className="flex items-center gap-3 text-sm">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    e.type === 'checkin' ? 'bg-ber-olive/15 text-ber-olive' : 'bg-red-50 text-red-500'
                  }`}>
                    {e.type === 'checkin' ? <LogIn size={10} /> : <LogOut size={10} />}
                    {e.type === 'checkin' ? 'Entrada' : 'Saida'}
                  </span>
                  <span className="font-mono font-semibold text-ber-carbon">{formatTime(e.timestamp)}</span>
                  {e.obra && <span className="text-xs text-ber-teal">{e.obra.name}</span>}
                </div>
              ))}
            </div>
            {todayGroup.totalHours != null && (
              <div className="mt-3 border-t border-ber-gray/10 pt-3 text-right text-sm font-bold text-ber-carbon">
                Total: {formatHours(todayGroup.totalHours)}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-3 rounded-lg bg-white p-4 text-center text-sm text-ber-gray/60 shadow-sm">
            Nenhum registro hoje
          </div>
        )}
      </div>

      {/* Historico */}
      <div className="mx-auto mt-8 max-w-2xl">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ber-gray">Historico</h2>
        {historyGroups.length > 0 ? (
          <div className="mt-3 overflow-hidden rounded-lg bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ber-gray/10 text-xs font-semibold uppercase tracking-wide text-ber-gray">
                  <th className="px-4 py-3 text-left">Data</th>
                  <th className="px-4 py-3 text-left">Entrada</th>
                  <th className="px-4 py-3 text-left">Saida</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {historyGroups.map((group) => {
                  const checkins = group.entries.filter((e) => e.type === 'checkin');
                  const checkouts = group.entries.filter((e) => e.type === 'checkout');
                  return (
                    <tr key={group.date} className="border-b border-ber-gray/5 last:border-0">
                      <td className="px-4 py-3 font-medium text-ber-carbon">{formatDate(group.entries[0].timestamp)}</td>
                      <td className="px-4 py-3 font-mono text-ber-carbon">
                        {checkins.map((e) => formatTime(e.timestamp)).join(', ') || '--'}
                      </td>
                      <td className="px-4 py-3 font-mono text-ber-carbon">
                        {checkouts.map((e) => formatTime(e.timestamp)).join(', ') || '--'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-ber-carbon">
                        {group.totalHours != null ? formatHours(group.totalHours) : '--'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-3 rounded-lg bg-white p-4 text-center text-sm text-ber-gray/60 shadow-sm">
            Nenhum registro anterior
          </div>
        )}
      </div>

      {/* Exportar Relatorio - only for diretoria/coordenacao */}
      {canExport && (
        <div className="mx-auto mt-8 max-w-2xl">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ber-gray">
            <Download size={14} />
            Exportar Relatorio
          </h2>

          <div className="mt-3 rounded-lg bg-white p-6 shadow-sm">
            {/* User multi-select */}
            <div className="mb-5">
              <label className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ber-gray">
                <Users size={14} />
                Colaboradores
              </label>
              <div className="mb-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedUserIds(new Set(exportUsers.map((u) => u.id)))}
                  className="rounded bg-ber-olive/10 px-3 py-1 text-xs font-semibold text-ber-olive hover:bg-ber-olive/20 transition"
                >
                  Selecionar todos
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedUserIds(new Set())}
                  className="rounded bg-ber-gray/10 px-3 py-1 text-xs font-semibold text-ber-gray hover:bg-ber-gray/20 transition"
                >
                  Limpar
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-ber-gray/10 p-3 space-y-1">
                {exportUsers.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-ber-gray/5 text-sm text-ber-carbon">
                    <input
                      type="checkbox"
                      checked={selectedUserIds.has(u.id)}
                      onChange={(e) => {
                        const next = new Set(selectedUserIds);
                        if (e.target.checked) next.add(u.id);
                        else next.delete(u.id);
                        setSelectedUserIds(next);
                      }}
                      className="rounded border-ber-gray/30 text-ber-olive focus:ring-ber-olive"
                    />
                    <span>{u.name}</span>
                    <span className="ml-auto text-xs text-ber-gray">{u.role}</span>
                  </label>
                ))}
                {exportUsers.length === 0 && (
                  <div className="text-center text-xs text-ber-gray/60 py-2">Carregando usuarios...</div>
                )}
              </div>
            </div>

            {/* Date range */}
            <div className="mb-5">
              <label className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ber-gray">
                <Calendar size={14} />
                Periodo
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
                  className="rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon focus:border-ber-olive focus:ring-1 focus:ring-ber-olive"
                />
                <span className="text-sm text-ber-gray">ate</span>
                <input
                  type="date"
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                  className="rounded-lg border border-ber-gray/20 px-3 py-2 text-sm text-ber-carbon focus:border-ber-olive focus:ring-1 focus:ring-ber-olive"
                />
              </div>
            </div>

            {/* Export button */}
            <button
              onClick={handleExport}
              disabled={exporting || selectedUserIds.size === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-ber-olive px-5 py-2.5 text-sm font-bold text-white transition hover:bg-ber-olive/90 disabled:opacity-50"
            >
              <Download size={16} />
              {exporting ? 'Exportando...' : 'Exportar Excel'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
