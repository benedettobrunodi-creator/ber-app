import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ano = 2026;
const metas = await prisma.crmMetaVendas.findMany({ where: { ano }, orderBy: { mes: 'asc' } });
const ganhas = await prisma.crmOportunidade.findMany({
  where: { etapa: 'ganho' },
  select: { valor: true, dataGanho: true, dataFechamentoPrevisto: true, updatedAt: true },
});

const realizadoPorMes = {};
for (let m = 1; m <= 12; m++) realizadoPorMes[m] = 0;
for (const op of ganhas) {
  const ref = op.dataGanho ?? op.dataFechamentoPrevisto ?? op.updatedAt;
  const d = ref instanceof Date ? ref : new Date(ref);
  if (d.getFullYear() !== ano) continue;
  realizadoPorMes[d.getMonth() + 1] += Number(op.valor ?? 0);
}

let metaAcum = 0, realizadoAcum = 0;
const rows = [];
for (let m = 1; m <= 12; m++) {
  const meta = Number(metas.find((x) => x.mes === m)?.valorMeta ?? 0);
  const realizado = realizadoPorMes[m];
  metaAcum += meta;
  realizadoAcum += realizado;
  rows.push({ mes: m, meta, realizado, metaAcum, realizadoAcum });
}

console.log('mes | meta | realizado | metaAcum | realizadoAcum');
for (const r of rows) console.log(r.mes, r.meta, r.realizado, r.metaAcum.toFixed(0), r.realizadoAcum.toFixed(0));

const hoje = new Date();
const mesAtual = hoje.getMonth() + 1;
const totalMeta = rows.reduce((s, r) => s + r.meta, 0);
const totalRealizado = rows.reduce((s, r) => s + r.realizado, 0);
console.log('\nmesAtual (server date):', mesAtual, hoje.toISOString());
console.log('totalMeta:', totalMeta, 'totalRealizado:', totalRealizado);
const mesesParaDistribuir = 13 - mesAtual;
const metaMensalAdaptativa = Math.max(0, totalMeta - totalRealizado) / mesesParaDistribuir;
console.log('mesesParaDistribuir:', mesesParaDistribuir, 'metaMensalAdaptativa:', metaMensalAdaptativa.toFixed(0));
console.log('meta original do mesAtual em diante (DB):', rows.filter(r => r.mes >= mesAtual).map(r => r.meta));

await prisma.$disconnect();
