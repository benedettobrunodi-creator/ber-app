import { Request, Response } from 'express';
import { prisma } from '../../config/database';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  no_prazo: { label: 'NO PRAZO', color: '#059669' },
  em_risco: { label: 'ATENÇÃO', color: '#D97706' },
  atrasado: { label: 'ATRASADO', color: '#DC2626' },
};

function fmt(d: Date | string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtShort(d: Date | string): string {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }).replace('/', '.');
}

function diasRestantes(d: Date | null): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
}

function buildCurvaSvg(
  pontos: { semana: Date; planejadoPct: number | null; realizadoPct: number | null }[],
  startDate: Date | null,
  endDate: Date | null,
): string {
  const W = 560, H = 140;
  const PAD = { top: 8, right: 16, bottom: 28, left: 36 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  const allMs = pontos.map(p => new Date(p.semana).getTime());
  if (startDate) allMs.push(startDate.getTime());
  if (endDate) allMs.push(endDate.getTime());
  if (!allMs.length) return `<svg width="${W}" height="${H}"><text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="#9ca3af" font-size="9">Sem dados</text></svg>`;

  const minT = Math.min(...allMs);
  const maxT = Math.max(...allMs);
  const rangeT = maxT - minT || 1;

  const toX = (ms: number) => PAD.left + ((ms - minT) / rangeT) * cW;
  const toY = (pct: number) => PAD.top + cH - (pct / 100) * cH;

  const sorted = [...pontos].sort((a, b) => new Date(a.semana).getTime() - new Date(b.semana).getTime());
  const pla = sorted.filter(p => p.planejadoPct != null).map(p => ({ x: toX(new Date(p.semana).getTime()), y: toY(p.planejadoPct!) }));
  const rea = sorted.filter(p => p.realizadoPct != null).map(p => ({ x: toX(new Date(p.semana).getTime()), y: toY(p.realizadoPct!) }));
  const ten = startDate && endDate ? [{ x: toX(startDate.getTime()), y: toY(0) }, { x: toX(endDate.getTime()), y: toY(100) }] : [];

  const path = (pts: { x: number; y: number }[]) => pts.length < 2 ? '' : `M ${pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')}`;

  // X labels: weeks relative to startDate, spaced at least 50px apart
  const xLabels: { x: number; label: string }[] = [];
  sorted.forEach(p => {
    const ms = new Date(p.semana).getTime();
    const wk = startDate ? Math.round((ms - startDate.getTime()) / (7 * 86_400_000)) + 1 : xLabels.length + 1;
    const x = toX(ms);
    if (!xLabels.length || x - xLabels[xLabels.length - 1].x > 50) xLabels.push({ x, label: `Sem. ${wk}` });
  });
  if (endDate) {
    const x = toX(endDate.getTime());
    const wk = startDate ? Math.round((endDate.getTime() - startDate.getTime()) / (7 * 86_400_000)) + 1 : '?';
    if (!xLabels.length || x - xLabels[xLabels.length - 1].x > 50) xLabels.push({ x, label: `Sem. ${wk}` });
  }

  const yLines = [0, 25, 50, 75, 100];

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" style="font-family:Arial,sans-serif;display:block;">
  ${yLines.map(pct => `<line x1="${PAD.left}" y1="${toY(pct).toFixed(1)}" x2="${W - PAD.right}" y2="${toY(pct).toFixed(1)}" stroke="#e5e7eb" stroke-width="0.5"/>`).join('')}
  ${yLines.map(pct => `<text x="${PAD.left - 3}" y="${(toY(pct) + 3).toFixed(1)}" text-anchor="end" fill="#9ca3af" font-size="7">${pct}%</text>`).join('')}
  ${xLabels.map(l => `<text x="${l.x.toFixed(1)}" y="${H - 4}" text-anchor="middle" fill="#9ca3af" font-size="7">${l.label}</text>`).join('')}
  ${ten.length >= 2 ? `<path d="${path(ten)}" fill="none" stroke="#d1d5db" stroke-width="1.5" stroke-dasharray="4 4"/>` : ''}
  ${pla.length >= 2 ? `<path d="${path(pla)}" fill="none" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="5 2"/>` : ''}
  ${rea.length >= 2 ? `<path d="${path(rea)}" fill="none" stroke="#22c55e" stroke-width="2"/>` : ''}
  ${rea.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.5" fill="#22c55e"/>`).join('')}
  <g transform="translate(${PAD.left},${H - 6})">
    <line x1="0" y1="-1" x2="12" y2="-1" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="4 2"/><text x="15" y="2" fill="#6b7280" font-size="7">Planejado acumulado</text>
    <line x1="100" y1="-1" x2="112" y2="-1" stroke="#22c55e" stroke-width="1.5"/><text x="115" y="2" fill="#6b7280" font-size="7">Realizado acumulado</text>
    <line x1="210" y1="-1" x2="222" y2="-1" stroke="#d1d5db" stroke-width="1.5" stroke-dasharray="3 3"/><text x="225" y="2" fill="#6b7280" font-size="7">Tendência linear</text>
  </g>
</svg>`;
}

function buildHtml(
  rel: any,
  obra: any,
  curvaS: any[],
  prevRel: any | null,
): string {
  const st = STATUS_MAP[rel.status] ?? STATUS_MAP.no_prazo;
  const dias = diasRestantes(obra.expectedEndDate);
  const avanco = parseFloat(rel.avancoPct ?? 0);
  const delta = rel.avancoDelta != null ? parseFloat(rel.avancoDelta) : null;

  const efetivos: { disciplina: string; quantidade: number }[] = rel.efetivoPorDisciplina ?? [];
  const atividades: { wbs: string; nome: string; tipo: string }[] = rel.atividadesSemana ?? [];
  const andamento = atividades.filter(a => a.tipo === 'andamento');
  const proximos = atividades.filter(a => a.tipo === 'proximo');
  const marcosConc = (rel.marcos ?? []).filter((m: any) => m.tipo === 'concluido');
  const marcosProx = (rel.marcos ?? []).filter((m: any) => m.tipo === 'proximo');

  // Group fotos by angulo
  const angulosMap = new Map<string, { nome: string; fotos: any[] }>();
  const semAngulo: any[] = [];
  (rel.fotos ?? []).forEach((ft: any) => {
    if (ft.anguloId && ft.angulo) {
      const e: { nome: string; fotos: any[] } = angulosMap.get(ft.anguloId) ?? { nome: ft.angulo.nome, fotos: [] };
      e.fotos.push(ft);
      angulosMap.set(ft.anguloId, e);
    } else {
      semAngulo.push(ft);
    }
  });

  const rtNum = String(rel.numero).padStart(3, '0');
  const d1 = fmt(rel.periodoInicio);
  const d2 = fmt(rel.periodoFim);

  const sectionTitle = (t: string) => `<p style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:#9ca3af;border-bottom:1px solid #f3f4f6;padding-bottom:3px;margin-bottom:8px;">${t}</p>`;

  const kpi = (label: string, value: string, big = false) => `
    <div style="border:1px solid #f3f4f6;border-radius:6px;padding:8px;text-align:center;">
      <p style="font-size:${big ? '20px' : '16px'};font-weight:900;color:#111827;">${value}</p>
      <p style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;margin-top:2px;">${label}</p>
    </div>`;

  const bullet = (text: string, color: string) => `
    <div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:3px;">
      <span style="width:7px;height:7px;border-radius:50%;background:${color};flex-shrink:0;margin-top:3px;display:inline-block;"></span>
      <span style="font-size:10px;color:#374151;">${text}</span>
    </div>`;

  const fotosSection = Array.from(angulosMap.entries()).map(([, { nome, fotos }]) => {
    const prevFoto = prevRel?.fotos?.find((f: any) => f.anguloId && fotos[0]?.anguloId === f.anguloId) ?? null;
    const allSlots = fotos.length + (prevFoto ? 1 : 0);
    const cols = allSlots === 1 ? '1fr' : '1fr 1fr';
    const imgH = allSlots === 1 ? '220px' : '170px';
    return `
      <div style="margin-bottom:14px;break-inside:avoid;">
        <p style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#9ca3af;margin-bottom:6px;">${nome}</p>
        <div style="display:grid;grid-template-columns:${cols};gap:6px;">
          ${fotos.map((ft: any) => `
            <div>
              <img src="${ft.url}" style="width:100%;height:${imgH};object-fit:cover;border-radius:4px;display:block;" />
              ${ft.legenda ? `<p style="font-size:7px;color:#9ca3af;margin-top:2px;">${ft.legenda}</p>` : ''}
            </div>`).join('')}
          ${prevFoto ? `
            <div style="opacity:0.6;">
              <img src="${prevFoto.url}" style="width:100%;height:${imgH};object-fit:cover;border-radius:4px;display:block;" />
              <p style="font-size:7px;color:#9ca3af;margin-top:2px;">RT-${String(rel.numero - 1).padStart(3, '0')} (anterior)</p>
            </div>` : ''}
        </div>
      </div>`;
  }).join('');

  const fotosGerais = semAngulo.length > 0 ? `
    <div style="break-inside:avoid;">
      <p style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#9ca3af;margin-bottom:6px;">Fotos gerais</p>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">
        ${semAngulo.map((ft: any) => `
          <div>
            <img src="${ft.url}" style="width:100%;height:110px;object-fit:cover;border-radius:4px;display:block;" />
            ${ft.legenda ? `<p style="font-size:7px;color:#9ca3af;margin-top:2px;">${ft.legenda}</p>` : ''}
          </div>`).join('')}
      </div>
    </div>` : '';

  const hasFotos = angulosMap.size > 0 || semAngulo.length > 0;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111827; background: white; }
  @media print { @page { size: A4; margin: 20mm; } }
</style>
</head>
<body>

<!-- CABEÇALHO -->
<div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:10px;border-bottom:2px solid #111827;margin-bottom:16px;">
  <div>
    <p style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:#9ca3af;margin-bottom:2px;">Relatório Gerencial de Obra</p>
    <h1 style="font-size:20px;font-weight:900;color:#111827;line-height:1.1;">${obra.name}</h1>
    ${obra.client ? `<p style="font-size:11px;color:#6b7280;margin-top:2px;">${obra.client}</p>` : ''}
  </div>
  <div style="text-align:right;">
    <p style="font-size:22px;font-weight:900;color:#111827;">RT-${rtNum}</p>
    <p style="font-size:9px;color:#6b7280;margin-top:2px;">${d1} — ${d2}</p>
  </div>
</div>

<!-- STATUS + PRAZO -->
<div style="display:flex;gap:10px;margin-bottom:16px;">
  <div style="width:130px;flex-shrink:0;border-radius:6px;border:1px solid ${st.color};display:flex;align-items:center;justify-content:center;padding:10px;">
    <span style="font-size:11px;font-weight:900;letter-spacing:0.08em;color:${st.color};">${st.label}</span>
  </div>
  <div style="flex:1;border-radius:6px;border:1px solid #e5e7eb;padding:10px;">
    <p style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#9ca3af;margin-bottom:2px;">Previsão de conclusão</p>
    <p style="font-size:14px;font-weight:900;color:#111827;">${obra.expectedEndDate ? fmt(obra.expectedEndDate) : '—'}</p>
    ${dias != null ? `<p style="font-size:9px;margin-top:2px;color:${dias < 0 ? '#DC2626' : dias <= 14 ? '#D97706' : '#6b7280'};">${dias < 0 ? `${Math.abs(dias)} dias em atraso` : `${dias} dias restantes`}</p>` : ''}
  </div>
</div>

<!-- AVANÇO FÍSICO -->
<div style="margin-bottom:14px;break-inside:avoid;">
  ${sectionTitle('Avanço Físico')}
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;margin-bottom:10px;">
    ${kpi('Acumulado', `${avanco}%`, true)}
    ${kpi('Na semana', delta != null ? `+${delta}%` : '—')}
    ${kpi('Dias trab. / úteis', rel.diasTrabalhados != null && rel.diasUteis != null ? `${rel.diasTrabalhados}/${rel.diasUteis}` : '—')}
    ${kpi('Efetivo médio/dia', rel.efetivoMedio != null ? String(parseFloat(rel.efetivoMedio)) : '—')}
  </div>
  <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
    <span style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#9ca3af;">Avanço físico acumulado</span>
    <span style="font-size:9px;font-weight:900;color:#111827;">${avanco}%</span>
  </div>
  <div style="height:8px;width:100%;background:#f3f4f6;border-radius:4px;overflow:hidden;">
    <div style="height:100%;width:${Math.min(100, avanco)}%;background:#111827;border-radius:4px;"></div>
  </div>
</div>

<!-- CURVA S -->
${curvaS.length >= 1 ? `
<div style="margin-bottom:14px;break-inside:avoid;">
  ${sectionTitle('Curva S — Planejado vs. Realizado (acumulado)')}
  ${buildCurvaSvg(curvaS, obra.startDate ? new Date(obra.startDate) : null, obra.expectedEndDate ? new Date(obra.expectedEndDate) : null)}
</div>` : ''}

<!-- EFETIVO POR DISCIPLINA -->
${efetivos.length > 0 ? `
<div style="margin-bottom:14px;break-inside:avoid;">
  ${sectionTitle('Efetivo por disciplina')}
  <table style="width:100%;border-collapse:collapse;">
    <thead><tr>
      <th style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;border-bottom:1px solid #e5e7eb;padding:3px 0;text-align:left;">Disciplina</th>
      <th style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;border-bottom:1px solid #e5e7eb;padding:3px 0;text-align:right;width:80px;">Pessoas</th>
    </tr></thead>
    <tbody>
      ${efetivos.map(e => `<tr><td style="padding:5px 0;border-bottom:1px solid #f3f4f6;color:#374151;">${e.disciplina}</td><td style="padding:5px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:500;">${e.quantidade}</td></tr>`).join('')}
      <tr>
        <td style="padding:5px 0;border-top:1px solid #d1d5db;font-size:8px;font-weight:700;text-transform:uppercase;color:#6b7280;">Total</td>
        <td style="padding:5px 0;border-top:1px solid #d1d5db;text-align:right;font-weight:900;">${efetivos.reduce((s, e) => s + e.quantidade, 0)}</td>
      </tr>
    </tbody>
  </table>
</div>` : ''}

<!-- ATIVIDADES DA SEMANA -->
${atividades.length > 0 ? `
<div style="margin-bottom:14px;break-inside:avoid;">
  ${sectionTitle('Atividades da semana')}
  ${andamento.length > 0 ? `
    <p style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#9ca3af;margin-bottom:4px;">Em andamento</p>
    ${andamento.map(a => bullet(`${a.wbs ? `[${a.wbs}] ` : ''}${a.nome}`, '#3b82f6')).join('')}` : ''}
  ${proximos.length > 0 ? `
    <p style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#9ca3af;margin-top:8px;margin-bottom:4px;">Próximos</p>
    ${proximos.map(a => bullet(`${a.wbs ? `[${a.wbs}] ` : ''}${a.nome}`, '#f59e0b')).join('')}` : ''}
</div>` : ''}

<!-- MARCOS -->
${(marcosConc.length > 0 || marcosProx.length > 0) ? `
<div style="margin-bottom:14px;break-inside:avoid;">
  ${sectionTitle('Marcos')}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
    ${marcosConc.length > 0 ? `
      <div>
        <p style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#9ca3af;margin-bottom:6px;">Concluídos no período</p>
        ${marcosConc.map((m: any) => `
          <div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:5px;">
            <span style="width:7px;height:7px;border-radius:50%;background:#10b981;flex-shrink:0;margin-top:2px;display:inline-block;"></span>
            <div><p style="font-size:10px;font-weight:500;color:#111827;">${m.nome}</p><p style="font-size:8px;color:#9ca3af;">${fmt(m.data)}</p></div>
          </div>`).join('')}
      </div>` : '<div></div>'}
    ${marcosProx.length > 0 ? `
      <div>
        <p style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#9ca3af;margin-bottom:6px;">Próximos marcos críticos</p>
        ${marcosProx.map((m: any) => `
          <div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:5px;">
            <span style="width:7px;height:7px;border-radius:50%;background:#f59e0b;flex-shrink:0;margin-top:2px;display:inline-block;"></span>
            <div><p style="font-size:10px;font-weight:500;color:#111827;">${m.nome}</p><p style="font-size:8px;color:#9ca3af;">${fmt(m.data)}</p></div>
          </div>`).join('')}
      </div>` : '<div></div>'}
  </div>
</div>` : ''}

<!-- DESTAQUES -->
${rel.destaques ? `
<div style="margin-bottom:14px;break-inside:avoid;">
  ${sectionTitle('Destaques da semana')}
  <p style="font-size:10px;color:#374151;white-space:pre-wrap;line-height:1.5;">${rel.destaques}</p>
</div>` : ''}

<!-- REGISTRO FOTOGRÁFICO -->
${hasFotos ? `
<div style="margin-bottom:14px;">
  ${sectionTitle('Registro fotográfico')}
  ${fotosSection}
  ${fotosGerais}
</div>` : ''}

<!-- ITENS EM ABERTO -->
${(rel.pendencias ?? []).length > 0 ? `
<div style="margin-bottom:14px;break-inside:avoid;">
  ${sectionTitle('Itens em aberto')}
  <table style="width:100%;border-collapse:collapse;">
    <thead><tr>
      <th style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;border-bottom:1px solid #e5e7eb;padding:3px 0;text-align:left;">Item</th>
      <th style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;border-bottom:1px solid #e5e7eb;padding:3px 0;text-align:left;width:100px;">Responsável</th>
      <th style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;border-bottom:1px solid #e5e7eb;padding:3px 0;text-align:left;width:80px;">Status</th>
      <th style="font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;border-bottom:1px solid #e5e7eb;padding:3px 0;text-align:left;width:80px;">Data limite</th>
    </tr></thead>
    <tbody>
      ${(rel.pendencias ?? []).map((p: any) => {
        const badgeColor = p.status === 'critico' ? { bg: '#fee2e2', text: '#b91c1c' } : p.status === 'atencao' ? { bg: '#fef3c7', text: '#92400e' } : { bg: '#d1fae5', text: '#065f46' };
        const badgeLabel = p.status === 'critico' ? 'CRÍTICO' : p.status === 'atencao' ? 'ATENÇÃO' : 'SOB CONTROLE';
        return `<tr>
          <td style="padding:5px 0;border-bottom:1px solid #f3f4f6;color:#374151;">${p.descricao}</td>
          <td style="padding:5px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;">${p.responsavel ?? '—'}</td>
          <td style="padding:5px 0;border-bottom:1px solid #f3f4f6;">
            <span style="font-size:7px;font-weight:700;padding:2px 5px;border-radius:3px;background:${badgeColor.bg};color:${badgeColor.text};">${badgeLabel}</span>
          </td>
          <td style="padding:5px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;">${p.prazo ? fmt(p.prazo) : '—'}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
</div>` : ''}

<!-- PRÓXIMOS 7 DIAS -->
${rel.proximosSete ? `
<div style="margin-bottom:14px;break-inside:avoid;">
  ${sectionTitle('Próximos 7 dias')}
  <p style="font-size:10px;color:#374151;white-space:pre-wrap;line-height:1.5;">${rel.proximosSete}</p>
</div>` : ''}

<!-- RODAPÉ -->
<div style="border-top:1px solid #e5e7eb;padding-top:10px;display:flex;justify-content:space-between;align-items:flex-end;margin-top:20px;">
  <div>
    ${rel.responsavelNome ? `
      <div style="width:130px;border-bottom:1px solid #9ca3af;margin-bottom:3px;"></div>
      <p style="font-size:9px;color:#4b5563;">${rel.responsavelNome}</p>
      <p style="font-size:7px;color:#9ca3af;">Responsável técnico</p>` : ''}
  </div>
  <p style="font-size:7px;color:#d1d5db;">BÈR Engenharia · ${fmt(new Date())}</p>
</div>

</body>
</html>`;
}

export async function generatePdf(req: Request, res: Response) {
  try {
    const { id: obraId, relatorioId } = req.params;

    const [relatorio, obra, curvaSPontos, allRelatorios] = await Promise.all([
      prisma.relatorioSemanal.findFirst({
        where: { id: relatorioId, obraId },
        include: {
          pendencias: { orderBy: { ordem: 'asc' } },
          marcos: { orderBy: { data: 'asc' } },
          fotos: {
            orderBy: { ordem: 'asc' },
            include: { angulo: { select: { id: true, nome: true } } },
          },
        },
      }),
      prisma.obra.findUnique({
        where: { id: obraId },
        select: { name: true, client: true, expectedEndDate: true, startDate: true },
      }),
      prisma.relatorioCurvaS.findMany({ where: { obraId }, orderBy: { semana: 'asc' } }),
      prisma.relatorioSemanal.findMany({
        where: { obraId },
        orderBy: { numero: 'asc' },
        select: {
          numero: true,
          fotos: { include: { angulo: { select: { id: true, nome: true } } } },
        },
      }),
    ]);

    if (!relatorio || !obra) {
      return res.status(404).json({ error: { message: 'Relatório ou obra não encontrado' } });
    }

    const prevRel = allRelatorios.find(r => r.numero === relatorio.numero - 1) ?? null;
    const html = buildHtml(relatorio, obra, curvaSPontos, prevRel);

    const puppeteer = (await import('puppeteer-core')).default;
    const executablePath = process.env.CHROMIUM_PATH ?? '/usr/bin/chromium-browser';
    const browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-extensions'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load', timeout: 30_000 });
      // Wait for images to finish loading
      await page.evaluate(() => Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Array.from((globalThis as any).document.querySelectorAll('img')).map((img: any) =>
          img.complete ? Promise.resolve() : new Promise((r) => { img.onload = r; img.onerror = r; })
        )
      ));

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
      });

      const rtNum = String(relatorio.numero).padStart(3, '0');
      const d1 = fmtShort(relatorio.periodoInicio);
      const d2 = fmtShort(relatorio.periodoFim);
      const obraNome = obra.name.replace(/[/\\:*?"<>|]/g, '-');
      const filename = `BER_${obraNome}_RT-${rtNum}_${d1}-${d2}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
      res.send(Buffer.from(pdfBuffer));
    } finally {
      await browser.close();
    }
  } catch (e: any) {
    console.error('[pdf] ERROR:', e.message);
    return res.status(500).json({ error: { message: e.message } });
  }
}
