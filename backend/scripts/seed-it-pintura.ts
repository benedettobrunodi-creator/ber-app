import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.instrucaoTecnica.create({
    data: {
      code: 'IT-11',
      title: 'Execução de Pintura em Interiores',
      discipline: 'acabamento',
      status: 'publicada',
      objective: 'Estabelecer o procedimento padrão da BER Engenharia para execução de pintura em paredes e tetos internos, com tinta látex PVA (áreas secas) e acrílica (áreas de maior exigência), garantindo uniformidade, ausência de emendas visíveis e acabamento de qualidade em 3 demãos.',
      materials: [
        'Selador acrílico ou PVA (primeira camada em substrato novo — obrigatório)',
        'Massa corrida PVA (paredes e tetos em áreas secas)',
        'Massa acrílica (ambientes com umidade ou maior exigência de acabamento)',
        'Tinta látex PVA (ambientes secos — quartos, salas, corredores, escritórios)',
        'Tinta acrílica (banheiros, cozinhas, áreas de serviço e onde maior durabilidade)',
        'Tinta epóxi (pisos de concreto, áreas industriais — quando especificado)',
        'Fita crepe (proteção de rodapés, esquadrias, tomadas)',
        'Plástico de proteção (proteção do piso e mobiliário)',
        'Lixa para parede grãos 80, 120 e 220',
        'Lixão de parede com cabo telescópico',
        'Selante acrílico (juntas entre parede e forro/rodapé)'
      ],
      tools: [
        'Rolo de lã 23cm (paredes — pelo 12mm para liso, 15mm para textura)',
        'Rolo de lã 9cm (acabamentos e regiões de difícil acesso)',
        'Pincel 2" e 3" (cantos, bordas e retoques)',
        'Bandeja de pintura',
        'Cabo de extensão para rolo (teto e partes altas)',
        'Espátula de aço flexível (aplicação e lixamento de massa)',
        'Desempenadeira de PVC ou aço (massa corrida)',
        'Lixadeira elétrica orbital (lixamento de grandes áreas)',
        'Aspirador de pó (limpeza após lixamento)',
        'Luz rasante (lanterna ou refletor lateral — revela imperfeições)',
        'Régua de alumínio (verificação de planicidade da massa)'
      ],
      steps: [
        { order: 1, title: 'Verificação e preparação do substrato', description: 'O substrato deve estar completamente seco, limpo e sem problemas. Verificar: umidade (máximo 12% — medir com medidor de umidade), trincas e fissuras (tratar antes), eflorescências (remover com escova de aço e produto antifungo), tinta antiga descascando (raspar completamente — pintar sobre tinta solta garante descascamento). Paredes novas de drywall: aguardar cura completa das juntas (mínimo 48h). Paredes de alvenaria rebocada: aguardar cura mínima de 28 dias antes de pintar.' },
        { order: 2, title: 'Proteção do ambiente', description: 'Proteger TUDO antes de iniciar: piso com plástico ou papelão duplo fixado com fita crepe, rodapés com fita crepe, esquadrias (portas e janelas) com fita crepe e plástico, tomadas e interruptores com fita crepe, luminárias desmontadas ou protegidas. Remover ou proteger todo mobiliário. Não economizar na proteção — respingo de tinta em porcelanato ou madeira é difícil de remover sem dano.' },
        { order: 3, title: 'Aplicação do selador', description: 'Em substrato novo (reboco, drywall, massa corrida): aplicar selador acrílico ou PVA diluído (20% de água) com rolo em toda a superfície. O selador fecha os poros, uniformiza a absorção e garante a aderência da massa. Sem selador, a massa absorve de forma irregular gerando marcas e lixamento difícil. Aguardar secagem completa: mínimo 4 horas (verificar toque). Em substrato já pintado em bom estado: lixar levemente com lixa 120 e limpar antes de aplicar.' },
        { order: 4, title: 'Primeira demão de massa corrida', description: 'Aplicar massa corrida PVA com desempenadeira em movimentos longos e uniformes. Espessura por demão: máximo 1mm — massa espessa racha. Começar pelo teto, depois paredes. Nos cantos e bordas: usar espátula menor para maior controle. Aguardar secagem completa (mínimo 12 horas, 24h ideal). Lixar com lixa 80 após secagem, removendo imperfeições grossas. Aspirar toda a poeira antes da próxima demão.' },
        { order: 5, title: 'Segunda demão de massa e lixamento fino', description: 'Aplicar segunda demão de massa preenchendo imperfeições da primeira. Esta demão deve ser mais fina e cuidadosa. Aguardar secagem (24h). Lixar com lixa 120 em movimentos circulares — esta é a etapa que define a qualidade do acabamento final. Usar luz rasante (lanterna posicionada lateralmente) para revelar imperfeições invisíveis com luz frontal. Qualquer ondulação ou marca visível na luz rasante deve ser corrigida nesta etapa — após a tinta não tem correção sem refazer.' },
        { order: 6, title: 'Lixamento final e limpeza', description: 'Lixamento final com lixa 220 em toda a superfície — paredes e teto. O objetivo é uma superfície lisa ao toque sem aspereza. Após lixar: aspirar toda a poeira com aspirador, depois passar pano úmido levemente torcido em toda a superfície. Aguardar secagem completa do pano úmido (mínimo 1 hora) antes de pintar. Poeira de massa sobre a tinta causa textura irregular e emendas visíveis — é a causa mais comum de retoques na BER.' },
        { order: 7, title: 'Primeira demão de tinta — selamento', description: 'Selecionar a tinta correta por ambiente: látex PVA para áreas secas (quartos, salas, escritórios), acrílica para banheiros, cozinhas e áreas úmidas. Diluir conforme fabricante (geralmente 20% de água na primeira demão). Começar sempre pelo teto, depois paredes. No teto: rolo com cabo telescópico em movimentos paralelos. Nas paredes: começar pelos cantos com pincel (cortar), depois rolo em W (zigue-zague) cobrindo toda a área sem levantar o rolo. Aguardar secagem: mínimo 2 horas entre demãos.' },
        { order: 8, title: 'Segunda demão', description: 'Lixar levemente com lixa 220 (apenas passar — não lixar fundo). Limpar a poeira. Aplicar segunda demão sem diluição ou diluição mínima (10%). Manter o mesmo sentido do rolo em todas as demãos do mesmo ambiente — sentidos diferentes criam emendas visíveis com luz rasante. Verificar cobertura uniforme — áreas mais claras indicam pouca tinta e serão visíveis após secagem.' },
        { order: 9, title: 'Terceira demão — acabamento final', description: 'Aplicar a terceira demão sem diluição. Esta é a demão de acabamento — máxima atenção. Manter o mesmo sentido do rolo. Carregar bem o rolo mas sem excesso (evita escorrimento). Nas bordas e cantos: acabamento limpo com pincel. Verificar cobertura uniform em toda a superfície — áreas com cobertura diferente criam variação de brilho. Após secagem completa (24h): verificar com luz rasante antes de retirar as proteções.' },
        { order: 10, title: 'Retoques — procedimento correto', description: 'RETOQUES MAL FEITOS são o principal problema de pintura na BER. Procedimento correto: 1) Lixar a área do retoque e 20cm ao redor com lixa 220. 2) Aplicar demão de selador na área lixada. 3) Aplicar massa se necessário, lixar. 4) Aplicar as 3 demãos de tinta NA ÁREA INTEIRA DA PAREDE (de canto a canto) — nunca retocar apenas o ponto danificado. Retoque pontual sempre aparece — a tinta seca diferente do entorno. Se a parede inteira não puder ser repintada, ir até um canto ou divisória natural.' },
        { order: 11, title: 'Limpeza e entrega', description: 'Remover fita crepe com cuidado: puxar em ângulo de 45°, devagar. Remover enquanto a tinta ainda está levemente úmida (se já secou completamente, o risco de descascar junto é maior). Inspecionar toda a pintura com luz rasante antes de liberar. Verificar: uniformidade de cor e brilho, ausência de emendas visíveis, cantos limpos, ausência de respingos no piso e esquadrias. Só liberar após aprovação do responsável pela obra.' }
      ],
      attentionPoints: [
        'RETOQUES: nunca retocar pontualmente — pintar a parede inteira de canto a canto; retoque pontual sempre aparece',
        'LUZ RASANTE: usar lanterna lateral antes de pintar e antes da entrega — imperfeições invisíveis com luz frontal',
        'POEIRA DE MASSA: aspirar e passar pano úmido antes de cada demão de tinta — poeira causa textura irregular',
        'SENTIDO DO ROLO: sempre o mesmo em todas as demãos do mesmo ambiente — sentidos diferentes criam emendas',
        'TINTA DESCASCANDO: causa raiz é falta de selador ou substrato úmido — resolver a causa antes de repintar',
        'EMENDAS VISÍVEIS: causadas por interrupção do rolo no meio da parede — sempre ir de canto a canto sem parar',
        'MASSA ESPESSA: máximo 1mm por demão — massa grossa racha após secar',
        'FITA CREPE: remover com tinta semi-úmida — fita em tinta seca descasca a pintura'
      ],
      approvalCriteria: [
        'Uniformidade de cor e brilho verificada com luz rasante em toda a extensão',
        'Ausência de emendas, marcas de rolo ou diferenças de brilho',
        'Cantos e bordas com acabamento limpo e reto',
        'Ausência de respingos em piso, rodapés e esquadrias',
        'Cobertura completa — sem áreas claras ou transparência',
        'Ausência de bolhas, descascamentos ou imperfeições',
        'Retoques (quando necessários) executados em parede inteira'
      ]
    }
  });

  console.log('IT-11 criada com sucesso!');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
