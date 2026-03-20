import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NORMAS = [
  {
    code: 'NBR 5410',
    title: 'Instalações elétricas de baixa tensão',
    discipline: 'eletrica',
    summary: 'Fixa as condições a que devem satisfazer as instalações elétricas de baixa tensão, a fim de garantir a segurança de pessoas e animais, o funcionamento adequado da instalação e a conservação dos bens.',
    source: 'abnt',
    url: 'https://www.abnt.org.br/normalizacao/lista-de-publicacoes/abnt/?searchterm=5410',
  },
  {
    code: 'NBR 5626',
    title: 'Instalação predial de água fria',
    discipline: 'hidraulica',
    summary: 'Estabelece os requisitos para projeto, execução e manutenção da instalação predial de água fria, incluindo critérios de dimensionamento, materiais e componentes.',
    source: 'abnt',
    url: 'https://www.abnt.org.br/normalizacao/lista-de-publicacoes/abnt/?searchterm=5626',
  },
  {
    code: 'NBR 7198',
    title: 'Instalação predial de água quente',
    discipline: 'hidraulica',
    summary: 'Fixa as exigências técnicas mínimas quanto à higiene, segurança, economia e conforto para as instalações prediais de água quente.',
    source: 'abnt',
    url: 'https://www.abnt.org.br/normalizacao/lista-de-publicacoes/abnt/?searchterm=7198',
  },
  {
    code: 'NBR 6118',
    title: 'Projeto de estruturas de concreto — Procedimento',
    discipline: 'estrutura',
    summary: 'Estabelece os requisitos básicos exigíveis para projeto de estruturas de concreto simples, armado e protendido, incluindo verificação de segurança, durabilidade e estados limites.',
    source: 'abnt',
    url: 'https://www.abnt.org.br/normalizacao/lista-de-publicacoes/abnt/?searchterm=6118',
  },
  {
    code: 'NBR 9575',
    title: 'Impermeabilização — Seleção e projeto',
    discipline: 'impermeabilizacao',
    summary: 'Estabelece as exigências e recomendações relativas à seleção e projeto de impermeabilização, para que sejam atendidas as condições mínimas de proteção da construção.',
    source: 'abnt',
    url: 'https://www.abnt.org.br/normalizacao/lista-de-publicacoes/abnt/?searchterm=9575',
  },
  {
    code: 'NBR 9574',
    title: 'Execução de impermeabilização',
    discipline: 'impermeabilizacao',
    summary: 'Fixa as condições exigíveis para a execução de impermeabilização de superfícies internas e externas de edificações, incluindo preparação de substrato, aplicação e proteção.',
    source: 'abnt',
    url: 'https://www.abnt.org.br/normalizacao/lista-de-publicacoes/abnt/?searchterm=9574',
  },
  {
    code: 'NBR 7200',
    title: 'Execução de revestimento de paredes e tetos de argamassas inorgânicas — Procedimento',
    discipline: 'revestimento',
    summary: 'Fixa as condições exigíveis para execução de revestimentos de paredes e tetos em argamassas inorgânicas, incluindo preparação da base, aplicação e acabamento.',
    source: 'abnt',
    url: 'https://www.abnt.org.br/normalizacao/lista-de-publicacoes/abnt/?searchterm=7200',
  },
  {
    code: 'NBR 13753',
    title: 'Revestimento de piso interno ou externo com placas cerâmicas e com utilização de argamassa colante — Procedimento',
    discipline: 'revestimento',
    summary: 'Estabelece procedimentos para execução de revestimento de piso com placas cerâmicas utilizando argamassa colante, incluindo preparação do substrato, assentamento e rejuntamento.',
    source: 'abnt',
    url: 'https://www.abnt.org.br/normalizacao/lista-de-publicacoes/abnt/?searchterm=13753',
  },
  {
    code: 'NBR 14037',
    title: 'Diretrizes para elaboração de manuais de uso, operação e manutenção das edificações',
    discipline: 'acabamento',
    summary: 'Estabelece os requisitos mínimos para elaboração e apresentação dos conteúdos a serem incluídos no manual de uso, operação e manutenção das edificações.',
    source: 'abnt',
    url: 'https://www.abnt.org.br/normalizacao/lista-de-publicacoes/abnt/?searchterm=14037',
  },
  {
    code: 'NR-18',
    title: 'Segurança e Saúde no Trabalho na Indústria da Construção',
    discipline: 'seguranca',
    summary: 'Estabelece diretrizes de ordem administrativa, de planejamento e de organização, que objetivam a implementação de medidas de controle e sistemas preventivos de segurança nos processos, nas condições e no meio ambiente de trabalho na indústria da construção.',
    source: 'interno',
    url: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/ctpp/normas-regulamentadoras/nr-18',
  },
  {
    code: 'NR-35',
    title: 'Trabalho em Altura',
    discipline: 'seguranca',
    summary: 'Estabelece os requisitos mínimos e as medidas de proteção para o trabalho em altura, envolvendo o planejamento, a organização e a execução, de forma a garantir a segurança e a saúde dos trabalhadores.',
    source: 'interno',
    url: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/ctpp/normas-regulamentadoras/nr-35',
  },
  {
    code: 'NR-06',
    title: 'Equipamentos de Proteção Individual — EPI',
    discipline: 'seguranca',
    summary: 'Estabelece os requisitos para seleção, uso, guarda, higienização, conservação, manutenção e descarte de equipamentos de proteção individual (EPI).',
    source: 'interno',
    url: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/ctpp/normas-regulamentadoras/nr-06',
  },
];

async function main() {
  console.log('Seeding normas técnicas...');

  for (const norma of NORMAS) {
    const existing = await prisma.normaTecnica.findUnique({
      where: { code: norma.code },
    });

    if (existing) {
      console.log(`  "${norma.code}" already exists, skipping.`);
      continue;
    }

    await prisma.normaTecnica.create({ data: norma });
    console.log(`  Created "${norma.code}" — ${norma.title}`);
  }

  console.log(`Done! ${NORMAS.length} normas processed.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
