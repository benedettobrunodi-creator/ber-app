/**
 * Alertas do módulo Qualidade (03/09/26, decisões Bruno msg 11128):
 * - Vistoria com nota < 2,5 (Crítico/Inaceitável) → e-mail IMEDIATO
 * - Segunda-feira 08h (BRT) → resumo semanal com score das obras ativas
 * Destinatários: mesma lista do alerta de fase atrasada (Chris, Gritti, Bruno).
 */
import { prisma } from '../../config/database';
import { FASE_ATRASADA_EMAILS } from '../../config/responsavel-areas';
import { classificarNota, NOTA_ALERTA_CRITICO } from './template';
import type { ResumoCategoria } from './service';

const header = `
  <div style="background:#1E2432;padding:24px 28px;border-radius:12px 12px 0 0;">
    <p style="color:#fff;font-size:16px;font-weight:700;letter-spacing:3px;margin:0;">BÈR ENGENHARIA</p>
    <p style="color:#8A93A3;font-size:10px;letter-spacing:2px;margin:4px 0 0;">CUIDADO EM CADA OBRA</p>
  </div>`;
const footer = (contexto: string) => `
  <p style="color:#868686;font-size:11px;text-align:center;margin-top:16px;">
    BÈR Engenharia · ${contexto}
  </p>`;

const CORES: Record<string, string> = {
  excelente: '#1E7A46',
  boa: '#5E6B0F',
  regular: '#B8860B',
  critico: '#C2410C',
  inaceitavel: '#B42318',
};

const fmtNota = (n: number) => n.toFixed(2).replace('.', ',');
const fmtData = (d: Date) => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

function badgeNota(nota: number): string {
  const c = classificarNota(nota);
  return `<span style="color:${CORES[c.key]};font-weight:700;">${fmtNota(nota)} · ${c.label}</span>`;
}

// ─── Alerta imediato — vistoria crítica ─────────────────────────────────────

export async function alertaVistoriaCritica(
  vistoria: { id: string; notaFinal: unknown; resumo: unknown; data: Date; vistoriador?: { name: string } | null },
  obraNome: string,
) {
  const { sendEmailObra } = await import('../../services/email-obras');
  const nota = Number(vistoria.notaFinal);
  const resumo = (vistoria.resumo as ResumoCategoria[]) ?? [];
  const piores = resumo
    .filter((c) => c.nota !== null)
    .sort((a, b) => (a.nota as number) - (b.nota as number))
    .slice(0, 4);

  const html = `
  <div style="font-family:'Montserrat',Arial,sans-serif;max-width:560px;margin:0 auto;background:#F7F7F5;padding:24px;">
    ${header}
    <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;">
      <h2 style="color:#B42318;font-size:17px;margin:0 0 6px;">⚠ Vistoria de Qualidade crítica — ${obraNome}</h2>
      <p style="color:#2D2D2D;font-size:14px;margin:0 0 4px;">Nota: ${badgeNota(nota)}</p>
      <p style="color:#868686;font-size:12px;margin:0 0 14px;">${fmtData(vistoria.data)}${vistoria.vistoriador ? ` · vistoria de ${vistoriadorNome(vistoria.vistoriador)}` : ''}</p>
      <p style="color:#5A7A7A;font-size:13px;font-weight:600;margin:0 0 6px;">Categorias mais fracas:</p>
      <ul style="margin:0;padding-left:18px;">
        ${piores.map((c) => `
          <li style="color:#2D2D2D;font-size:13px;line-height:1.7;">
            ${c.nome}: <strong>${fmtNota(c.nota as number)}</strong>
            <span style="color:#868686;font-size:11px;"> (${c.sim} sim · ${c.nao} não)</span>
          </li>`).join('')}
      </ul>
    </div>
    ${footer('Alerta automático — vistoria de qualidade abaixo de ' + fmtNota(NOTA_ALERTA_CRITICO))}
  </div>`;

  await sendEmailObra({
    to: FASE_ATRASADA_EMAILS,
    subject: `⚠ Qualidade crítica (${fmtNota(nota)}) — ${obraNome}`,
    html,
  });
}

function vistoriadorNome(v: { name: string }): string {
  return v.name;
}

// ─── Resumo semanal — segunda 08h BRT ───────────────────────────────────────

export async function resumoSemanalQualidade({ dryRun = false } = {}) {
  const obras = await prisma.obra.findMany({
    where: { status: 'em_andamento' },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const hoje0 = new Date();
  hoje0.setHours(0, 0, 0, 0);

  const linhas: {
    obraNome: string;
    ultima: { nota: number; data: Date; classificacao: string } | null;
    anterior: { nota: number } | null;
    pendencias: number;
    fvsAbertas: number;
    fvsVencidas: number;
  }[] = [];

  for (const obra of obras) {
    const vistorias = await prisma.qualidadeVistoria.findMany({
      where: { obraId: obra.id },
      orderBy: { data: 'desc' },
      take: 2,
      select: { notaFinal: true, data: true, classificacao: true },
    });
    const pendencias = await prisma.qualidadeVistoriaItem.count({
      where: { vistoria: { obraId: obra.id }, resposta: 'nao', resolvido: false },
    });
    const fvsAbertas = await prisma.atividadeFvs.count({
      where: { obraId: obra.id, status: 'pendente' },
    });
    const fvsVencidas = await prisma.atividadeFvs.count({
      where: { obraId: obra.id, status: 'pendente', prazo: { lt: hoje0 } },
    });
    linhas.push({
      obraNome: obra.name,
      ultima: vistorias[0]
        ? { nota: Number(vistorias[0].notaFinal), data: vistorias[0].data, classificacao: vistorias[0].classificacao }
        : null,
      anterior: vistorias[1] ? { nota: Number(vistorias[1].notaFinal) } : null,
      pendencias,
      fvsAbertas,
      fvsVencidas,
    });
  }

  const comVistoria = linhas.filter((l) => l.ultima);
  if (comVistoria.length === 0 && !dryRun) {
    console.log('[Qualidade] resumo semanal: nenhuma obra com vistoria — e-mail não enviado');
    return { enviado: false, linhas };
  }

  const blocos = linhas.map((l) => {
    const fvsTxt = l.fvsAbertas === 0
      ? '<span style="color:#868686;font-size:12px;">—</span>'
      : `<span style="color:${l.fvsVencidas > 0 ? '#B42318' : '#B8860B'};font-size:12px;font-weight:600;">${l.fvsAbertas} aberta(s)${l.fvsVencidas > 0 ? ` · ${l.fvsVencidas} vencida(s)` : ''}</span>`;
    if (!l.ultima) {
      return `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #E4E6DA;color:#2D2D2D;font-size:13px;">${l.obraNome}</td>
          <td colspan="3" style="padding:8px 10px;border-bottom:1px solid #E4E6DA;color:#B8860B;font-size:12px;">sem vistoria registrada</td>
          <td style="padding:8px 10px;border-bottom:1px solid #E4E6DA;">${fvsTxt}</td>
        </tr>`;
    }
    const delta = l.anterior !== null ? l.ultima.nota - (l.anterior as { nota: number }).nota : null;
    const deltaTxt = delta === null
      ? '<span style="color:#868686;font-size:11px;">1ª vistoria</span>'
      : delta > 0
        ? `<span style="color:#1E7A46;font-size:12px;">▲ +${fmtNota(delta)}</span>`
        : delta < 0
          ? `<span style="color:#B42318;font-size:12px;">▼ ${fmtNota(delta)}</span>`
          : '<span style="color:#868686;font-size:12px;">estável</span>';
    return `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #E4E6DA;color:#2D2D2D;font-size:13px;">${l.obraNome}
          <span style="color:#868686;font-size:11px;"> · ${fmtData(l.ultima.data)}</span></td>
        <td style="padding:8px 10px;border-bottom:1px solid #E4E6DA;">${badgeNota(l.ultima.nota)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #E4E6DA;">${deltaTxt}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #E4E6DA;color:${l.pendencias > 0 ? '#C2410C' : '#868686'};font-size:12px;">${l.pendencias} pendência(s)</td>
        <td style="padding:8px 10px;border-bottom:1px solid #E4E6DA;">${fvsTxt}</td>
      </tr>`;
  }).join('');

  const html = `
  <div style="font-family:'Montserrat',Arial,sans-serif;max-width:640px;margin:0 auto;background:#F7F7F5;padding:24px;">
    ${header}
    <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;">
      <h2 style="color:#2D2D2D;font-size:17px;margin:0 0 6px;">Resumo semanal · Qualidade das obras</h2>
      <p style="color:#5A7A7A;font-size:13px;margin:0 0 14px;">Última vistoria de cada obra em andamento, variação vs anterior e pendências em aberto.</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <th style="text-align:left;padding:8px 10px;color:#868686;font-size:11px;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #D4D6CA;">Obra</th>
          <th style="text-align:left;padding:8px 10px;color:#868686;font-size:11px;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #D4D6CA;">Nota</th>
          <th style="text-align:left;padding:8px 10px;color:#868686;font-size:11px;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #D4D6CA;">Vs anterior</th>
          <th style="text-align:left;padding:8px 10px;color:#868686;font-size:11px;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #D4D6CA;">Pendências</th>
          <th style="text-align:left;padding:8px 10px;color:#868686;font-size:11px;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #D4D6CA;">FVS</th>
        </tr>
        ${blocos}
      </table>
    </div>
    ${footer('Resumo automático semanal do módulo Qualidade — segundas às 08h')}
  </div>`;

  if (dryRun) return { enviado: false, linhas, html };

  const { sendEmailObra } = await import('../../services/email-obras');
  await sendEmailObra({
    to: FASE_ATRASADA_EMAILS,
    subject: `Qualidade das obras — resumo semanal (${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })})`,
    html,
  });
  return { enviado: true, linhas };
}
