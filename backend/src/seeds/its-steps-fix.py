#!/usr/bin/env python3
"""
Fix steps nas ITs que ficaram com array vazio.
Usa subprocess com stdin para evitar problemas de escape de aspas.
"""
import subprocess, sys, json

DB = "postgresql://ber:ber2026@localhost:5432/ber_app"

def psql_stdin(sql):
    r = subprocess.run(["psql", DB], input=sql, capture_output=True, text=True)
    if r.returncode != 0 and "ERROR" in r.stderr:
        print(f"ERR: {r.stderr[:400]}", file=sys.stderr)
    return r.stdout

def update_steps(code, steps):
    steps_json = json.dumps(steps, ensure_ascii=False)
    # Use dollar-quoting to avoid ALL escaping issues
    sql = f"""
UPDATE instrucoes_tecnicas
SET steps = $steps${steps_json}$steps$::jsonb
WHERE code = '{code}';
"""
    r = psql_stdin(sql)
    count = steps_json.count('"order"')
    if "UPDATE 1" in r:
        print(f"  ✓ {code} — {count} steps")
    else:
        print(f"  ✗ {code} — {r.strip()}")

# ─── Steps das ITs com array vazio ───────────────────────────────────────────

STEPS = {
"IT-04": [
    {"order":1,"title":"Preparação do substrato","description":"Limpar a superfície. Remover pó, graxa e resíduos. Umedecer sem encharcar."},
    {"order":2,"title":"Selagem de fissuras","description":"Fissuras até 3mm: preencher com argamassa de regularização. Aguardar cura completa (mín. 24h)."},
    {"order":3,"title":"Reforço de cantos e ralos","description":"Aplicar tela de poliéster em todos os cantos (parede/piso) e ao redor dos ralos com a 1ª demão. Sobrepor 15cm de cada lado."},
    {"order":4,"title":"1ª demão","description":"Aplicar o impermeabilizante com trincha ou rolo em movimentos horizontais. Espessura uniforme. Aguardar cura: 4–6h (verificar bula)."},
    {"order":5,"title":"2ª demão","description":"Aplicar perpendicular à 1ª (movimentos verticais). Espessura total mínima: 2mm para cimentício. Aguardar cura: 4–6h."},
    {"order":6,"title":"3ª demão (áreas críticas)","description":"Em box de chuveiro e ralo: aplicar 3ª camada. Total maior ou igual a 3mm."},
    {"order":7,"title":"Proteção dos ralos","description":"Tampar os ralos durante a cura para não obstruir com material."},
    {"order":8,"title":"Cura mínima","description":"Aguardar cura mínima conforme fabricante (geralmente 72h antes do teste)."},
    {"order":9,"title":"Teste de estanqueidade","description":"Tampar o ralo. Encher com água até 3cm acima do ponto mais alto impermeabilizado. Aguardar 72 horas corridas sem reposição. Verificar se há perda de nível ou manchas na laje abaixo."},
    {"order":10,"title":"Registro fotográfico","description":"Fotografar o teste (nível da água + hora início), o resultado e o gabarito de medição."},
],
"IT-05": [
    {"order":1,"title":"Leitura do projeto","description":"Identificar todos os circuitos, pontos e seções de condutor conforme NBR 5410. Nunca executar de memória."},
    {"order":2,"title":"Marcação dos trajetos","description":"Marcar com giz/traçador os trajetos dos eletrodutos em paredes e teto, conforme projeto."},
    {"order":3,"title":"Abertura de rasgos","description":"Usar roçadeira elétrica. Profundidade mínima: diâmetro do eletroduto + 10mm de recobrimento. Em drywall: passar entre perfis sem abrir rasgo."},
    {"order":4,"title":"Instalação de eletrodutos","description":"Usar eletrodutos corrugados flexíveis (em drywall) ou rígidos PVC (em alvenaria). Diâmetro mínimo: 3/4\" para iluminação, 1\" para tomadas. Fixar com grampo a cada 80cm."},
    {"order":5,"title":"Instalação de caixas de passagem","description":"Instalar caixas 4x2\" ou 4x4\" nos pontos indicados. Nivelar com a superfície da parede. Em drywall: usar caixas próprias para drywall."},
    {"order":6,"title":"Passagem dos condutores","description":"Passar condutores conforme seção de projeto. Deixar sobra de 30cm em cada ponto. Identificar com etiqueta ou fita colorida."},
    {"order":7,"title":"Aterramento","description":"Instalar fios terra (verde/amarelo) em todos os circuitos conforme projeto. Conectar ao barramento de terra do QDC."},
    {"order":8,"title":"Instalação do QDC","description":"Fixar o quadro nivelado. Instalar disjuntores conforme projeto. Identificar cada disjuntor com etiqueta."},
    {"order":9,"title":"Instalação de tomadas e interruptores","description":"Conectar: fase (pino direito), neutro (pino esquerdo), terra (pino central). Usar tomadas padrão NBR 14136. Nunca interromper o neutro em interruptores."},
    {"order":10,"title":"Teste e energização","description":"Testar cada circuito com multímetro antes de energizar (continuidade, ausência de curto). Ligar um circuito de cada vez. Medir tensão nos pontos."},
],
"IT-06": [
    {"order":1,"title":"Marcação dos pontos","description":"Marcar na parede e teto as posições das evaporadoras, condensadoras e trajeto dos dutos de refrigerante e dreno, conforme projeto."},
    {"order":2,"title":"Fixação dos suportes da condensadora","description":"Instalar suportes galvanizados nivelados. Para instalação em fachada: verificar normas do condomínio e usar buchas adequadas à alvenaria."},
    {"order":3,"title":"Abertura de passagem para tubulação","description":"Abrir furo de diâmetro adequado (60–80mm) para passagem dos tubos de cobre e dreno. Inclinar levemente para o exterior (dreno)."},
    {"order":4,"title":"Instalação da tubulação de cobre","description":"Usar cobre desidratado. Diâmetros conforme especificação do fabricante. Dobrar com dobrador específico (nunca dobrar na mão). Isolar com espuma elastomérica (Armaflex ou similar) espessura mínima 9mm."},
    {"order":5,"title":"Tubulação de dreno","description":"Instalar em PVC 3/4\" com caimento mínimo de 1% em direção ao ponto de descarte. Nunca subir o dreno."},
    {"order":6,"title":"Passagem elétrica dedicada","description":"Instalar eletroduto dedicado para circuito do AC (conforme IT-05). Nunca compartilhar circuito com outros equipamentos."},
    {"order":7,"title":"Fixação da evaporadora","description":"Instalar suporte nivelado. Fixar a unidade evaporadora. Verificar nível com nível de bolha."},
    {"order":8,"title":"Conexão das tubulações","description":"Conectar tubulação de cobre às válvulas da unidade. Apertar com chave de torque conforme especificação do fabricante. Vedar com fita isolante."},
    {"order":9,"title":"Vácuo","description":"Conectar bomba de vácuo ao sistema. Fazer vácuo por mínimo 30 minutos (até atingir -76cmHg). Aguardar 10 minutos para verificar se o vácuo se mantém. Se cair: há vazamento."},
    {"order":10,"title":"Carga de gás e energização","description":"Liberar o gás refrigerante das válvulas da condensadora. Aguardar 6h antes do primeiro acionamento (proteção do compressor)."},
    {"order":11,"title":"Teste de funcionamento","description":"Ligar o equipamento. Verificar: delta T de 8–12 graus C, dreno escoando, sem ruídos anormais. Fotografar a instalação completa."},
],
"IT-13": [
    {"order":1,"title":"Planejamento da paginação","description":"Antes de começar: definir a paginação no papel. Centralizar o ambiente para que as peças de borda sejam iguais. Nunca começar sem paginação definida."},
    {"order":2,"title":"Marcação no piso","description":"Estender linhas guia conforme a paginação. Usar fio de nylon ou linha a laser."},
    {"order":3,"title":"Escolha da argamassa","description":"AC-II para porcelanatos até 60x60cm. AC-III para porcelanatos maiores (gres) e para assentamento em paredes. Nunca usar AC-I para porcelanato."},
    {"order":4,"title":"Preparação e aplicação da argamassa","description":"Misturar conforme fabricante. Aplicar com desempenadeira dentada: 6mm para peças até 30x30; 8mm para até 60x60; 10mm para maiores. Aplicar também na face da peça (dupla colagem — obrigatória para porcelanato)."},
    {"order":5,"title":"Assentamento","description":"Posicionar a peça sobre a argamassa. Bater levemente com martelo de borracha para garantir aderência. Usar niveladores de placa para peças maiores ou iguais a 30x30."},
    {"order":6,"title":"Verificação de planeza e juntas","description":"Verificar com régua 2m: tolerância 3mm. Manter espaçamento uniforme com espaçadores. Junta de dilatação a cada 6m e em encontros com paredes."},
    {"order":7,"title":"Limpeza antes do rejunte","description":"Remover restos de argamassa das juntas. Aguardar cura mínima: 24h."},
    {"order":8,"title":"Rejuntamento","description":"Usar rejunte epóxi para áreas molhadas com uso intenso (box, ralo). Rejunte cimentício para demais áreas. Aplicar com desempenadeira de borracha. Limpar com esponja em movimentos diagonais."},
    {"order":9,"title":"Teste de aderência","description":"Percutir 100% das peças com haste de metal: som oco indica falta de aderência. Retirar e reassentar as peças com som oco."},
],
"IT-16": [
    {"order":1,"title":"Conferência das medidas","description":"Antes de descarregar: conferir todas as medidas dos módulos vs. o ambiente real (cota por cota do projeto). Diferença maior que 5mm: reportar ao fabricante antes de instalar."},
    {"order":2,"title":"Marcação e nivelamento da base","description":"Marcar no piso e parede o posicionamento de cada módulo com base no projeto. Nivelar com pés reguláveis ou calços. Verificar com nível de bolha."},
    {"order":3,"title":"Fixação dos módulos à parede","description":"Fixar os módulos à parede com parafuso e bucha conforme o substrato: drywall (bucha para drywall, no montante quando possível), alvenaria (bucha S6 ou S8). Mínimo 2 pontos de fixação por módulo de 60cm ou maior."},
    {"order":4,"title":"União dos módulos","description":"Unir com parafusos de união (confirmat) a cada 30cm. Verificar alinhamento de frentes."},
    {"order":5,"title":"Instalação das portas e gavetas","description":"Instalar dobradiças conforme especificação. Regular abertura, altura e profundidade dos amortecedores. Instalar corrediças com bucha + parafuso. Regular curso e nivelamento das gavetas."},
    {"order":6,"title":"Instalação de tampos e puxadores","description":"Fixar tampo de MDF/granito com silicone estrutural neutro. Para granito acima de 5kg por metro quadrado: fixar com L de aço na parede adicionalmente. Posicionar puxadores conforme projeto com gabarito."},
    {"order":7,"title":"Regulagens finais e limpeza","description":"Ajustar todas as portas (vertical, horizontal, profundidade) e gavetas. Testar amortecedores. Remover adesivos, fitas de proteção e resíduos."},
],
"IT-17": [
    {"order":1,"title":"Cotação do vão real","description":"Medir o vão em 3 alturas (topo, meio, base) e 3 larguras. Usar a menor medida. Descontar folgas para perfil. Paredes de drywall têm variações de até 10mm."},
    {"order":2,"title":"Instalação dos perfis","description":"Fixar os perfis (U ou L) no piso, teto e paredes com parafuso + bucha. Nível e prumo com nível laser. Aplicar EPDM dentro do perfil para amortecimento."},
    {"order":3,"title":"Instalação do vidro temperado","description":"Vidro temperado obrigatório em divisórias (NBR 7199). Transportar sempre na vertical. Inserir no perfil de baixo primeiro, depois no de cima. Usar ventosas para vidros acima de 15kg."},
    {"order":4,"title":"Calços e vedação com silicone","description":"Instalar calços plásticos no fundo dos perfis para centralizar o vidro. Aplicar silicone neutro (não ácido) no encontro vidro/perfil internamente."},
    {"order":5,"title":"Esquadrias — fixação e regulagem","description":"Verificar prumo nos dois sentidos. Fixar definitivamente com parafusos nas abas de fixação. Ajustar folgas e regulagem dos fechos e dobradiças. Folga padrão entre folha e marco: 3mm em todos os lados."},
    {"order":6,"title":"Proteção e limpeza final","description":"Manter filme de proteção até entrega. Remover na limpeza final. Limpar com álcool isopropílico ou produto específico para vidro. Nunca usar esponja de aço."},
],
}

print("=== Fix steps nas ITs ===\n")
for code, steps in STEPS.items():
    update_steps(code, steps)

# Verificação final
print("\n=== Verificação ===")
r = subprocess.run(["psql", DB, "-c",
    "SELECT code, jsonb_array_length(steps) as steps FROM instrucoes_tecnicas ORDER BY code;"],
    capture_output=True, text=True)
print(r.stdout)
