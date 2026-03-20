import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CATEGORIES = [
  {
    category: 'organizacao',
    items: [
      { title: 'Materiais organizados e identificados por área', description: 'Verificar se materiais estão separados, identificados e armazenados corretamente por área de trabalho', order: 1 },
      { title: 'Circulação livre de obstáculos', description: 'Confirmar que corredores e acessos estão desobstruídos e permitem passagem segura', order: 2 },
      { title: 'Área de descarte separada (entulho, madeira, metal)', description: 'Verificar se há separação adequada de resíduos por tipo de material', order: 3 },
      { title: 'Ferramentas guardadas após uso', description: 'Confirmar que ferramentas são recolhidas e armazenadas em local adequado ao final de cada turno', order: 4 },
    ],
  },
  {
    category: 'protecao',
    items: [
      { title: 'Proteções de bordas e aberturas instaladas', description: 'Verificar guarda-corpos, rodapés e tampas de aberturas em lajes e vãos', order: 5 },
      { title: 'Bandejas de proteção em bom estado', description: 'Inspecionar bandejas salva-vidas quanto à integridade e fixação', order: 6 },
      { title: 'Telas de proteção íntegras', description: 'Verificar telas de fachada e proteção contra queda de materiais', order: 7 },
      { title: 'Proteção das instalações existentes', description: 'Confirmar que instalações elétricas, hidráulicas e acabamentos existentes estão protegidos', order: 8 },
    ],
  },
  {
    category: 'isolamento',
    items: [
      { title: 'Tapumes em bom estado e sem danos', description: 'Inspecionar tapumes quanto à integridade estrutural e visual', order: 9 },
      { title: 'Acesso controlado — apenas pessoal autorizado', description: 'Verificar controle de acesso ao canteiro e identificação de visitantes', order: 10 },
      { title: 'Sinalização de obra visível e legível', description: 'Confirmar placas de sinalização regulamentares em bom estado', order: 11 },
      { title: 'Isolamento de áreas de risco', description: 'Verificar isolamento e sinalização de áreas com trabalho em altura, escavações ou risco elétrico', order: 12 },
    ],
  },
  {
    category: 'comunicacao',
    items: [
      { title: 'Placa de obra atualizada e visível', description: 'Verificar placa com dados da obra, responsável técnico e alvará', order: 13 },
      { title: 'Quadro de avisos atualizado', description: 'Confirmar que informações de segurança e cronograma estão atualizados', order: 14 },
      { title: 'Contatos de emergência afixados', description: 'Verificar lista de contatos de emergência visível em local de fácil acesso', order: 15 },
      { title: 'Planta de layout do canteiro disponível', description: 'Confirmar disponibilidade da planta com áreas de vivência, armazenamento e circulação', order: 16 },
    ],
  },
  {
    category: 'higiene',
    items: [
      { title: 'Banheiros limpos e abastecidos', description: 'Verificar limpeza, papel higiênico, sabonete e condições gerais dos sanitários', order: 17 },
      { title: 'Área de alimentação limpa', description: 'Inspecionar refeitório quanto à limpeza, conservação e condições de uso', order: 18 },
      { title: 'Ponto de água potável disponível', description: 'Confirmar disponibilidade de bebedouro ou galão de água potável em condições adequadas', order: 19 },
      { title: 'Lixeiras identificadas e esvaziadas', description: 'Verificar se lixeiras estão identificadas por tipo de resíduo e não estão transbordando', order: 20 },
    ],
  },
  {
    category: 'equipamentos',
    items: [
      { title: 'Extintores dentro do prazo e acessíveis', description: 'Verificar validade, lacre, manômetro e desobstrução do acesso aos extintores', order: 21 },
      { title: 'Equipamentos com manutenção em dia', description: 'Confirmar registros de manutenção preventiva de equipamentos e máquinas', order: 22 },
      { title: 'Andaimes e escadas em bom estado', description: 'Inspecionar integridade estrutural, travas, guarda-corpos e base de apoio', order: 23 },
      { title: 'Instalação elétrica provisória segura e identificada', description: 'Verificar quadros elétricos, aterramento, disjuntores e identificação dos circuitos', order: 24 },
    ],
  },
];

async function main() {
  console.log('Seeding canteiro template...');

  const existing = await prisma.canteiroTemplate.findFirst({
    where: { name: 'Checklist de Canteiro BER' },
  });

  if (existing) {
    console.log('  Template already exists, skipping.');
    return;
  }

  const allItems = CATEGORIES.flatMap((cat) =>
    cat.items.map((item) => ({
      category: cat.category,
      title: item.title,
      description: item.description,
      order: item.order,
      required: true,
    })),
  );

  await prisma.canteiroTemplate.create({
    data: {
      name: 'Checklist de Canteiro BER',
      version: 1,
      items: { create: allItems },
    },
  });

  console.log(`  Created template with ${allItems.length} items across ${CATEGORIES.length} categories.`);
  console.log('Done!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
