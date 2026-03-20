import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.instrucaoTecnica.create({
    data: {
      code: 'IT-06',
      title: 'Instalação de Piso Vinílico em Placas (LVT/SPC)',
      discipline: 'revestimento',
      status: 'publicada',
      objective: 'Estabelecer o procedimento padrão da BER Engenharia para instalação de piso vinílico em placas LVT (Luxury Vinyl Tile) ou SPC (Stone Plastic Composite) em ambientes corporativos e residenciais, sobre piso elevado ou contrapiso, garantindo planicidade, aderência e acabamento de qualidade.',
      materials: [
        'Placas LVT (espessura mínima 5mm com camada de uso 0,5mm para comercial) ou SPC (espessura 4-6mm)',
        'Adesivo TAC permanente à base de água (para LVT sobre piso elevado — permite remoção)',
        'Cola acrílica de colagem total (para LVT sobre contrapiso em áreas de alto tráfego)',
        'Primer acrílico (bases muito absorventes ou porosas)',
        'Massa niveladora autonivelante (regularização fina — desvios até 10mm)',
        'Perfil de transição em alumínio (encontro com outros revestimentos)',
        'Rodapé vinílico flexível ou MDF (acabamento perimetral)',
        'Fita adesiva dupla face (fixação temporária durante paginação)'
      ],
      tools: [
        'Nível a laser (eixos de paginação e verificação de planeza)',
        'Régua de alumínio 2m (verificação de planicidade — crítico)',
        'Medidor de umidade (obrigatório — máximo 3%)',
        'Estilete com lâmina nova e régua metálica (cortes)',
        'Serra tico-tico com disco fino (recortes complexos)',
        'Rolo de pressão de 30-50kg (colagem total — crítico)',
        'Desempenadeira dentada V3 (aplicação de cola acrílica)',
        'Rolo de espuma (aplicação de TAC)',
        'Espátula plástica (remoção de bolhas após assentamento)',
        'Trena, esquadro e giz de linha',
        'Aspirador industrial (limpeza da base)'
      ],
      steps: [
        { order: 1, title: 'Aclimatação obrigatória', description: 'Desembalar as placas e deixar no ambiente por mínimo 48 horas antes da instalação. Temperatura do ambiente: entre 18°C e 30°C. Umidade relativa: entre 40% e 65%. O vinílico é muito sensível à temperatura — placas frias contraem após instalação abrindo juntas; placas quentes expandem causando empolamento. Nunca instalar com ar condicionado desligado em obra — a temperatura final de uso deve ser a mesma da instalação.' },
        { order: 2, title: 'Verificação de umidade — ETAPA CRÍTICA', description: 'Medir a umidade da base com medidor eletrônico em pelo menos 5 pontos por ambiente (cantos e centro). Umidade máxima: 3%. Se acima de 3%: aguardar mais tempo de cura, melhorar ventilação, ou aplicar impermeabilizante de base antes. NUNCA instalar vinílico sobre base úmida — é a causa número 1 de descolamento e formação de bolhas na BER. Registrar os valores medidos com foto para documentação.' },
        { order: 3, title: 'Verificação e preparação da base', description: 'Planicidade máxima: 2mm em régua de 2m — vinílico não tolera irregularidades (ao contrário do carpete). Irregularidades acima de 2mm: corrigir com massa niveladora autonivelante. Aguardar cura completa da massa (conforme fabricante) e lixar saliências. Base deve estar limpa, seca, sem poeira, gordura, cera, tinta solta ou desmoldante. PISO ELEVADO: verificar nivelamento entre placas — desnível acima de 1mm cria ponto de pressão que quebra o LVT.' },
        { order: 4, title: 'Paginação e definição do ponto de partida', description: 'Com nível a laser, definir os dois eixos principais perpendiculares. Fazer simulação a seco sem cola para verificar sobras nas bordas — sobra mínima: 10cm (para LVT não há possibilidade de juntar peças). Ajustar o ponto de partida para sobras proporcionais nos dois lados. LVT sobre piso elevado: alinhar as juntas do vinílico com as juntas do piso elevado sempre que possível — junta do vinílico sobre a borda de uma placa de piso elevado cria ponto fraco. Definir o padrão: corrida (juntas defasadas 1/3), quadrado (juntas alinhadas) ou diagonal (45°).' },
        { order: 5, title: 'Aplicação do adesivo — TAC ou colagem total', description: 'TAC PERMANENTE (piso elevado): aplicar com rolo de espuma, aguardar tack (15-30 min), assentar. Permite remoção para manutenção. COLA ACRÍLICA TOTAL (contrapiso, alto tráfego): aplicar com desempenadeira dentada V3 em área de 4-6m² por vez. Não aplicar cola em área maior do que consegue assentar em 20 min. Tempo em aberto: verificar na embalagem (média 20-40 min). Cola parcialmente seca (skinning) não cola — descartar e reaplicar. Rendimento: 300-400g/m².' },
        { order: 6, title: 'Assentamento das placas', description: 'Iniciar pelo centro do ambiente. Posicionar a placa ligeiramente fora da posição final e deslizar para a posição — não bater de cima para baixo. Pressionar firmemente com a mão em toda a superfície. Verificar alinhamento com os eixos a cada placa. Manter espaço de 1-2mm nas bordas para paredes (coberto pelo rodapé) — vinílico expande com temperatura e sem folga empola. Para colagem total: passar rolo de pressão de 30-50kg imediatamente após assentar cada seção — o rolo garante contato total e elimina bolhas. Sem o rolo, o vinílico descola.' },
        { order: 7, title: 'Cortes de borda e recortes', description: 'Medir cada corte individualmente. Marcar com lápis no verso. Cortes retos: estilete com lâmina nova e régua metálica — pontuar a superfície levemente e dobrar a placa para partir (nunca cortar de uma vez com estilete). Cortes curvos: serra tico-tico com disco fino específico para vinílico. Recortes para ralos e tubulações: gabarito em papelão primeiro. Lixar as bordas cortadas com lixa fina para remover rebarbas. Verificar encaixe antes de colar definitivamente.' },
        { order: 8, title: 'Acabamentos e rodapés', description: 'Instalar perfil de transição em alumínio no encontro com outros revestimentos — nunca deixar borda livre. Instalar rodapé após a conclusão do piso — nunca antes. Rodapé vinílico flexível: colar com adesivo de contato sem toluol. Rodapé de MDF: pregar ou colar com silicone neutro. Deixar folga de 1mm entre o rodapé e o piso — contato direto com o piso causa marcas.' },
        { order: 9, title: 'Limpeza e cura', description: 'Remover imediatamente resíduos de cola com pano úmido — cola seca é muito difícil de remover sem danificar o vinílico. Após 24h, limpar com pano úmido e detergente neutro. Não usar solventes, álcool ou produtos abrasivos. Liberar para tráfego leve: 24h após instalação com TAC; 48h para colagem total. Mobiliário pesado: 72h. Proteger o piso com papelão durante o restante da obra.' }
      ],
      attentionPoints: [
        'UMIDADE: medir SEMPRE antes de instalar — umidade acima de 3% é a causa número 1 de descolamento e bolhas',
        'PLANICIDADE: desvio máximo 2mm em 2m — vinílico não perdoa irregularidades, ao contrário do carpete',
        'ROLO DE PRESSÃO: obrigatório na colagem total — sem rolo o vinílico descola em poucos meses',
        'TEMPERATURA: instalar com o ambiente na temperatura final de uso — diferença térmica causa empolamento ou juntas abertas',
        'FOLGA NAS BORDAS: 1-2mm contra as paredes — sem folga o vinílico empola com o calor',
        'PISO ELEVADO: nivelar desnível máximo 1mm entre placas — desnível maior quebra o LVT sob tráfego',
        'COLA ACRÍLICA: não aplicar área maior que o tempo em aberto — cola com skinning não cola',
        'VINÍLICO DESCOLANDO (problema BER): verificar umidade da base, uso do rolo de pressão e tipo de cola'
      ],
      approvalCriteria: [
        'Umidade da base medida e documentada: máximo 3%',
        'Planicidade verificada com régua 2m: desvio máximo 2mm',
        'Nenhuma bolha ou área oca (verificar pressionando com o pé)',
        'Juntas alinhadas — desvio máximo 1mm',
        'Sobras de borda mínimas: 10cm',
        'Perfis de transição e rodapés instalados',
        'Folga perimetral de 1-2mm respeitada',
        'Nenhuma placa levantando nas bordas após 24h'
      ]
    }
  });

  console.log('IT-06 criada com sucesso!');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
