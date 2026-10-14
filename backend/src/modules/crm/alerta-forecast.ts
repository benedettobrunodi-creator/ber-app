// Alerta semanal de previsão de fechamento (Bruno 14/10/26): "me mande
// semanalmente um e-mail dizendo quais não têm data prevista de fechamento,
// lembrando que tem que ser da coluna Proposta produção em diante".
// Fonte única: getForecastFechamento() (mesma usada no gráfico de Relatórios),
// que já devolve semData = negócios de proposta_producao+ sem dataFechamentoPrevisto.
// 100% determinístico — nenhum número passa por IA.
import { prisma } from '../../config/database';
import { getForecastFechamento } from './service';

const fmtM = (v: number): string => {
  const nf = (n: number, d = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  if (v >= 1_000_000) return `R$ ${nf(v / 1_000_000)} M`;
  if (v >= 1_000) return `R$ ${nf(v / 1_000, 0)} mil`;
  return `R$ ${nf(v, 0)}`;
};
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const ETAPA_LABEL: Record<string, string> = {
  proposta_producao: 'proposta em produção',
  proposta_enviada: 'proposta enviada',
  negociacao: 'negociação',
};

export async function alertarForecastSemData(): Promise<{ enviado: boolean; itens: number }> {
  const socios = await prisma.user.findMany({
    where: { role: 'socio', isActive: true },
    select: { email: true },
  });
  if (socios.length === 0) return { enviado: false, itens: 0 };

  const fc = await getForecastFechamento();
  if (fc.countSemData === 0) return { enviado: false, itens: 0 }; // nada em falta, não manda

  const appUrl = process.env.APP_PUBLIC_URL ?? 'https://ber-app.vercel.app';
  const itens = [...fc.semData].sort((a, b) => b.valor - a.valor);
  const totalSem = itens.reduce((s, i) => s + i.valor, 0);

  const linhas = itens.map((s) =>
    `<li style="margin:4px 0;color:#2D2D2D;font-size:13px;">
      <strong>${esc(s.titulo)}</strong>${s.empresa ? ` · ${esc(s.empresa)}` : ''} — ${fmtM(s.valor)},
      ${esc(ETAPA_LABEL[s.etapa] ?? s.etapa)}${s.responsavel ? ` · ${esc(s.responsavel)}` : ''}
    </li>`).join('');

  const corpo = `
    <p style="font-size:14px;color:#2D2D2D;margin:0 0 10px;">
      <strong>${fc.countSemData}</strong> negócio${fc.countSemData === 1 ? '' : 's'} da coluna
      <strong>Proposta em produção</strong> em diante ${fc.countSemData === 1 ? 'está' : 'estão'} sem
      <strong style="color:#B42318;">data de fechamento prevista</strong> —
      ${fmtM(totalSem)} que ficam de fora da previsão de fechamento por mês.
    </p>
    <p style="font-size:13px;color:#5C5E54;margin:0 0 14px;">
      Sem data prevista, o negócio não entra no gráfico de previsão. Vale definir uma data pra cada um:
    </p>
    <ul style="margin:0 0 14px;padding-left:18px;">${linhas}</ul>
    <p style="margin:0;"><a href="${appUrl}/crm?tab=relatorios" style="color:#5E6B0F;font-weight:600;font-size:13px;">Abrir o CRM → Relatórios →</a></p>`;

  const { htmlAvisoInterno } = await import('../../services/email-equipe');
  const { sendEmailObra } = await import('../../services/email-obras');
  await sendEmailObra({
    to: socios.map((s) => s.email),
    subject: `📅 ${fc.countSemData} negócio${fc.countSemData === 1 ? '' : 's'} sem data de fechamento prevista`,
    html: htmlAvisoInterno('📅 Previsão de fechamento — datas em falta', corpo, 'Aviso semanal do BER App · CRM · somente sócios'),
  });

  return { enviado: true, itens: fc.countSemData };
}
