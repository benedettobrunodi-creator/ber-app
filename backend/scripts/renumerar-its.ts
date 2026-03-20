import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const novaSequencia = [
    { codigoAtual: 'IT-01', codigoNovo: 'IT-02' },
    { codigoAtual: 'IT-02', codigoNovo: 'IT-03' },
    { codigoAtual: 'IT-03', codigoNovo: 'IT-04' },
    { codigoAtual: 'IT-04', codigoNovo: 'IT-05' },
    { codigoAtual: 'IT-05', codigoNovo: 'IT-06' },
    { codigoAtual: 'IT-06', codigoNovo: 'IT-07' },
    { codigoAtual: 'IT-07', codigoNovo: 'IT-08' },
    { codigoAtual: 'IT-08', codigoNovo: 'IT-09' },
    { codigoAtual: 'IT-09', codigoNovo: 'IT-10' },
    { codigoAtual: 'IT-10', codigoNovo: 'IT-11' },
    { codigoAtual: 'IT-11', codigoNovo: 'IT-12' },
  ];

  // Primeiro renomear para códigos temporários para evitar conflito de unique
  for (const item of novaSequencia) {
    await prisma.instrucaoTecnica.update({
      where: { code: item.codigoAtual },
      data: { code: item.codigoAtual + '_tmp' }
    });
  }

  // Depois aplicar os códigos finais
  for (const item of novaSequencia) {
    await prisma.instrucaoTecnica.update({
      where: { code: item.codigoAtual + '_tmp' },
      data: { code: item.codigoNovo }
    });
  }

  console.log('Renumeração concluída!');
  const its = await prisma.instrucaoTecnica.findMany({ orderBy: { code: 'asc' }, select: { code: true, title: true } });
  its.forEach(it => console.log(`${it.code} — ${it.title}`));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
