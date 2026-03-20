import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.instrucaoTecnica.create({
    data: {
      code: 'IT-03',
      title: 'Assentamento de Revestimento Cerâmico e Porcelanato',
      discipline: 'revestimento',
      status: 'publicada',
      objective: 'Estabelecer o procedimento padrão da BER Engenharia para assentamento de pisos e revestimentos cerâmicos e porcelanatos, com argamassa AC-III e dupla colagem, sistema de nivelamento e rejunte adequado por ambiente, conforme NBR 13753 e NBR 13754.',
      materials: [
        'Argamassa colante AC-III (obrigatória para porcelanato e ambientes úmidos)',
        'Rejunte convencional (áreas secas — salas, corredores, quartos)',
        'Rejunte epóxi (áreas úmidas, cozinhas, banheiros, e onde exigido em projeto)',
        'Sistema de nivelamento: clips + cunhas (obrigatório para peças acima de 30x30cm)',
        'Espaçadores de junta (2mm para retificado, 3-5mm para não retificado)',
        'Cantoneira de alumínio ou PVC (encontro piso-parede e degraus)',
        'Perfil de junta de dilatação (alumínio ou latão)',
        'Primer de base (em substratos muito absorventes ou lisos)',
        'Aditivo impermeabilizante para rejunte (em áreas molháveis)'
      ],
      tools: [
        'Nível a laser (referência de nível e esquadro)',
        'Régua de alumínio 2m (verificação de planeza)',
        'Desempenadeira dentada 8x8x8mm (obrigatória para dupla colagem)',
        'Desempenadeira lisa (aplicação no verso da peça)',
        'Martelo de borracha branco (nunca usar martelo metálico)',
        'Sistema de nivelamento: pistola aplicadora de clips e cunhas',
        'Estilete com lâmina nova (corte de placas menores)',
        'Serra mármore ou cortadora elétrica com disco diamantado (cortes precisos)',
        'Esmerilhadeira com disco de desbaste (acabamento de cortes)',
        'Trena e esquadro metálico',
        'Espátula de borracha (aplicação do rejunte)',
        'Esponja e balde (limpeza do rejunte)',
        'Prumo de face'
      ],
      steps: [
        { order: 1, title: 'Verificação e preparação da base', description: 'Verificar se o contrapiso tem no mínimo 14 dias de cura (28 dias se concreto). Testar a resistência batendo com objeto — som cavo indica problema. Verificar planicidade com régua de 2m — desvio máximo de 3mm. Base muito lisa deve ser escarificada. Remover toda gordura, poeira, desmoldantes e materiais soltos. Verificar umidade — base muito úmida prejudica a aderência da AC-III. Em substratos muito absorventes, aplicar primer de base e aguardar secagem conforme fabricante.' },
        { order: 2, title: 'Paginação — ETAPA CRÍTICA', description: 'Antes de qualquer assentamento, fazer a paginação no papel ou com laser. Regras obrigatórias da BER: nunca iniciar de uma parede — começar pelo centro do ambiente ou pelo ponto mais visível. Peças de corte (sobras) devem ficar nos cantos e sob móveis, nunca em locais nobres. Sobra mínima de corte: 1/3 da peça — se não atingir, reposicionar a paginação. Em ambientes com soleira, alinhar a junta com a soleira. Verificar esquadro do ambiente — ambientes fora de esquadro exigem ajuste na paginação. Marcar no piso as linhas de referência com giz ou laser.' },
        { order: 3, title: 'Preparo da argamassa AC-III', description: 'Adicionar o pó à água (nunca o contrário) na proporção indicada pelo fabricante. Misturar mecanicamente por 3 minutos até pasta homogênea sem grumos. Aguardar descanso de 15 minutos e misturar novamente. Tempo de utilização: máximo 2h30min — descartar argamassa que passou do prazo. Nunca adicionar água extra para "amolecer" argamassa que começou a endurecer.' },
        { order: 4, title: 'Assentamento da peça mestra', description: 'A peça mestra é a referência de todo o piso — deve ser assentada com máxima precisão. Aplicar AC-III no substrato com desempenadeira dentada 8x8x8mm formando cordões paralelos. Aplicar AC-III também no verso da peça (dupla colagem obrigatória para peças acima de 900cm²) com desempenadeira lisa. Posicionar a peça ligeiramente fora da posição final, pressionar e arrastar perpendicularmente aos cordões até a posição. Bater com martelo de borracha branco. Verificar nível, prumo e posição com nível a laser. Esta peça não pode ter nenhum erro.' },
        { order: 5, title: 'Instalação dos clips de nivelamento', description: 'Para peças acima de 30x30cm, usar sistema de nivelamento obrigatoriamente. Inserir os clips nas juntas entre peças antes que a argamassa seque (máximo 15 min após assentar). Clip deve ser encaixado sob a borda da peça já assentada. Após assentar a peça adjacente, inserir a cunha no clip com a pistola aplicadora. Apertar até sentir resistência — não forçar demais. O sistema será removido após 24h girando os clips com alicate.' },
        { order: 6, title: 'Assentamento sequencial com controle de nível', description: 'Avançar a partir da peça mestra seguindo as linhas de referência. Verificar alinhamento a cada 3-4 peças com régua e nível. Manter espaçadores de junta (2mm retificado / 3-5mm não retificado) em todas as juntas. Não caminhar sobre as peças recém assentadas por no mínimo 24h. Em dias quentes ou secos, umedecer levemente o substrato antes da argamassa.' },
        { order: 7, title: 'Recortes — execução e acabamento', description: 'Medir cada recorte individualmente — nunca assumir que todos são iguais. Marcar com lápis na peça. Cortes retos: serra mármore com disco diamantado. Cortes curvos (entorno de ralos, tubulações): esmerilhadeira. Após o corte, lixar a borda com pedra de afiar ou esmerilhadeira para remover farpas. Verificar encaixe antes de aplicar argamassa. Instalar cantoneira metálica em degraus e encontros piso-parede quando especificado.' },
        { order: 8, title: 'Juntas de dilatação', description: 'Obrigatórias: em ambientes internos com área maior que 32m² ou dimensão maior que 8m. Nos encontros com paredes, colunas e batentes (junta perimetral de 8-10mm). Em mudanças de direção do piso. Em encontros entre pisos de materiais diferentes. As juntas de dilatação NÃO devem ser rejuntadas — preencher com selante elastomérico (silicone neutro ou poliuretano) após cura do revestimento. Instalar perfil de dilatação em alumínio ou latão nas juntas de piso a piso.' },
        { order: 9, title: 'Remoção dos clips e cura', description: 'Após 24h do assentamento, remover os clips de nivelamento girando com alicate — nunca antes de 24h. Aguardar cura mínima de 7 dias antes de liberar tráfego de pessoas. Tráfego de veículos ou cargas: mínimo 12 dias. Proteger o piso durante a obra com papelão ou manta de proteção — porcelanato riscado não tem solução.' },
        { order: 10, title: 'Rejuntamento', description: 'Aguardar mínimo 24h após assentamento para rejuntar (48h ideal). Remover todos os espaçadores antes de rejuntar. Limpar as juntas de poeira e restos de argamassa. SELEÇÃO DO REJUNTE: convencional em áreas secas; epóxi em banheiros, cozinhas, áreas de serviço e onde exigido em projeto. Aplicar o rejunte com espátula de borracha em movimentos diagonais às juntas, pressionando para preencher completamente. Remover o excesso com espátula. Aguardar início de secagem (verificar com toque — firme mas não duro) e limpar com esponja úmida em movimentos circulares. Não usar esponja encharcada — dissolve o rejunte.' },
        { order: 11, title: 'Limpeza final e proteção', description: 'Após cura completa do rejunte (mínimo 24h), limpar o piso com pano úmido. Manchas de argamassa seca: usar removedor específico ou solução de ácido muriático diluído 1:10 (nunca em porcelanato polido). Porcelanato polido: aplicar protetor de superfície (cristalizador) após limpeza. Proteger o piso até a entrega da obra.' }
      ],
      attentionPoints: [
        'PAGINAÇÃO: nunca pular esta etapa — peças de corte em local visível ou sobra menor que 1/3 da peça são inaceitáveis na BER',
        'DUPLA COLAGEM: obrigatória para peças acima de 900cm² (30x30cm) — piso sem dupla colagem solta com o tempo',
        'NIVELADORES: obrigatórios para peças acima de 30x30cm — sem niveladores, juntas ficam desniveladas (lábio)',
        'REJUNTE EPÓXI em áreas úmidas: rejunte convencional em banheiro mancha e apodrece',
        'JUNTAS DE DILATAÇÃO: nunca rejuntar — sem junta de dilatação o piso levanta (empolamento)',
        'RECORTES: medir cada um individualmente — recorte mal feito não tem conserto sem trocar a peça',
        'CURA: nunca liberar tráfego antes de 7 dias — piso solto por cura insuficiente é um dos problemas mais comuns',
        'PROTEÇÃO DURANTE OBRA: porcelanato sem proteção risca irremediavelmente'
      ],
      approvalCriteria: [
        'Paginação aprovada antes do início do assentamento',
        'Nivelamento verificado com régua de 2m — desvio máximo 3mm',
        'Alinhamento das juntas verificado — desvio máximo 2mm em 2m',
        'Teste de percussão (bater com objeto) — nenhum som cavo',
        'Rejunte correto por ambiente (convencional/epóxi)',
        'Juntas de dilatação executadas e preenchidas com selante',
        'Ausência de peças trincadas, lascadas ou com mancha de rejunte',
        'Recortes com acabamento limpo e encaixe perfeito'
      ]
    }
  });

  console.log('IT-03 criada com sucesso!');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
