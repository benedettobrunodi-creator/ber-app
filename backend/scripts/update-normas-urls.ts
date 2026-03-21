import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const normasUrls = [
  { code: 'NBR 5410', url: 'https://www.google.com/search?q=ABNT+NBR+5410+instala%C3%A7%C3%B5es+el%C3%A9tricas' },
  { code: 'NBR 5626', url: 'https://www.google.com/search?q=ABNT+NBR+5626+instala%C3%A7%C3%A3o+predial+%C3%A1gua+fria' },
  { code: 'NBR 7198', url: 'https://www.google.com/search?q=ABNT+NBR+7198+instala%C3%A7%C3%A3o+predial+%C3%A1gua+quente' },
  { code: 'NBR 6118', url: 'https://www.google.com/search?q=ABNT+NBR+6118+projeto+estruturas+concreto' },
  { code: 'NBR 9575', url: 'https://www.google.com/search?q=ABNT+NBR+9575+impermeabiliza%C3%A7%C3%A3o+sele%C3%A7%C3%A3o+projeto' },
  { code: 'NBR 9574', url: 'https://www.google.com/search?q=ABNT+NBR+9574+execu%C3%A7%C3%A3o+impermeabiliza%C3%A7%C3%A3o' },
  { code: 'NBR 7200', url: 'https://www.google.com/search?q=ABNT+NBR+7200+revestimento+paredes+tetos+argamassas' },
  { code: 'NBR 13753', url: 'https://www.google.com/search?q=ABNT+NBR+13753+revestimento+piso+placas+cer%C3%A2micas' },
  { code: 'NBR 14037', url: 'https://www.google.com/search?q=ABNT+NBR+14037+manual+opera%C3%A7%C3%A3o+uso+manuten%C3%A7%C3%A3o' },
  { code: 'NR-18', url: 'https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/seguranca-e-saude-no-trabalho/ctpp-normas/normas-regulamentadoras/nr-18-atualizada-2020.pdf' },
  { code: 'NR-35', url: 'https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/seguranca-e-saude-no-trabalho/ctpp-normas/normas-regulamentadoras/nr-35-atualizada-2012.pdf' },
  { code: 'NR-06', url: 'https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/seguranca-e-saude-no-trabalho/ctpp-normas/normas-regulamentadoras/nr-06-atualizada-2017.pdf' },
];

async function main() {
  for (const norma of normasUrls) {
    await prisma.normaTecnica.update({
      where: { code: norma.code },
      data: { url: norma.url },
    });
    console.log(`${norma.code} — URL atualizada`);
  }

  console.log(`\n${normasUrls.length} normas atualizadas!`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
