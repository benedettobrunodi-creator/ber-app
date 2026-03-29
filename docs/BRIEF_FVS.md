# BRIEF — FVS (Fichas de Verificação de Serviço)
> Aprovado por Bruno Di Benedetto em 29/03/2026

---

## Conceito

FVS digital integrada ao Sequenciamento da obra. Cada etapa tem sua FVS vinculada, dividida em 2 momentos:
- **Início da etapa** → seção "Pré-execução" obrigatória antes de começar
- **Conclusão da etapa** → seção "Execução + Conclusão" obrigatória antes de enviar para aprovação

---

## Fluxo de aprovação

1. **Mestre** preenche pré-execução ao iniciar → preenche conclusão ao concluir → envia para aprovação
2. **Gestor/Engenheiro** valida (1ª aprovação)
3. **Coordenador** valida definitivamente (2ª aprovação) → etapa marcada como "Aprovada" e FVS travada
4. **Diretoria** pode desbloquear FVS aprovada se necessário

---

## Notificações

| Evento | App (push) | Slack canal da obra |
|--------|-----------|---------------------|
| Etapa iniciada — FVS pré-exec pendente | Mestre | ✅ |
| FVS pré-exec não preenchida em 4h | Mestre | ✅ |
| Etapa concluída — aguardando validação | Gestor | ✅ |
| Gestor aprovou — aguardando coord. | Coordenador | ✅ |
| FVS parada há +48h | Coordenador + Diretoria | ✅ |
| FVS aprovada definitivamente | Mestre + Gestor | ✅ |
| FVS rejeitada | Mestre | ✅ |

---

## Visão consolidada — aba "FVS" na obra

- Lista todas as FVS da obra por status: pendente / em preenchimento / aguardando aprovação / aprovada
- Filtros por status e por bloco
- Exportar FVS em PDF (futuro)

---

## Estrutura de blocos do sequenciamento (padrão BÈR)

```
BLOCO 0 — PRÉ-OBRA (administrativo)
Aprovação de proposta | Assinatura de contrato | Kick Off Externo | Recebimento de projetos | Autorização de início | Suprimentos e compras | Marcos de fabricação

BLOCO 1 — PREPARAÇÃO (sequencial)
Reunião com condomínio | Relatório de vistoria | Mobilização + canteiro | Proteções | Marcações (cotas, níveis, paredes, infras, forro) | Demolições | Abertura piso elevado | Civil (sóculo, muretas, impermeabilização, enchimento)

BLOCO 2 — INFRAESTRUTURAS (paralelas — podem sobrepor com Bloco 3)
Elétrica bruta | Cabeamento estruturado bruto | Hidráulica bruta | Sprinkler | SDAI | HVAC

BLOCO 3 — VEDAÇÕES (pode sobrepor com Bloco 2)
Drywall estrutura + 1ª face | Estrutura de forro | Piso elevado | Portas | Divisórias industriais (medição + projeto + produção)

BLOCO 4 — FECHAMENTOS + ACABAMENTOS INTERMEDIÁRIOS (paralelas)
Drywall 2ª face + calafetação | Forro gesso/sanca + acústico + baffles | Jateamento acústico | Pintura 1ª e 2ª demão | Revestimentos | Divisórias instalação | Elétrica acabamento | Cabeamento acabamento | Controle de acesso | Hidráulica acabamento | HVAC startup + testes | Sprinkler testes | SDAI testes

BLOCO 5 — ACABAMENTOS FINAIS (paralelas)
Pintura 3ª demão | Marcenaria montagem | Pedras e bancadas | Louças e metais | Luminárias | Mobiliário | Vidros + espelhos + persianas

BLOCO 6 — ENTREGA + CLOSEOUT (sequencial)
Punch List interno | Punch List com cliente | Entrega provisória + termo | Correção pendências | Relatório final | Manual do usuário | Lições aprendidas | Termo definitivo
```

---

## FVS por etapa (20 fichas aprovadas)

### FVS 0 — MOBILIZAÇÃO DE CANTEIRO

**Acesso e segurança**
- [ ] Autorização de obras emitida pelo condomínio/gestora
- [ ] Capacho BÈR posicionado na entrada da obra
- [ ] Delimitação da área (tapume leve, fita ou plástico)
- [ ] Placa de obra afixada no local
- [ ] Proteção de piso das áreas comuns (corredor de acesso)
- [ ] Extintor disponível na área
- [ ] Kit de primeiros socorros completo e acessível
- [ ] Contato do síndico/gestora registrado para emergências

**Equipe**
- [ ] EPI's disponíveis e em quantidade suficiente
- [ ] Refeitório montado (mesa, cadeiras, lixeira)
- [ ] Água filtrada disponível
- [ ] Geladeira disponível

**Área da Engenharia**
- [ ] Mesa do engenheiro instalada
- [ ] Mesa de reunião disponível
- [ ] TV/monitor para apresentação de projetos
- [ ] Projetos e documentos organizados e armazenados (pasta física + digital)
- [ ] Almoxarifado organizado (materiais identificados e segregados)

**Higiene e limpeza**
- [ ] Lixeiras disponíveis na área de obra e refeitório
- [ ] Produtos de limpeza disponíveis (vassoura, pá, rodo, saco de lixo)
- [ ] Banheiro de uso da equipe identificado e acordado com o condomínio
- [ ] Sabonete e papel toalha disponíveis

---

### FVS 1 — DEMOLIÇÕES / ALVENARIA

**Pré-demolição (pré-execução)**
- [ ] Paredes a demolir marcadas/identificadas conforme projeto
- [ ] Marcenarias a descartar identificadas e listadas
- [ ] Mobiliário a descartar identificado e listado
- [ ] Itens a preservar/retirar com cuidado sinalizados
- [ ] Escopo de demolição validado com o engenheiro antes do início

**Execução**
- [ ] EPI completo na equipe (capacete, luva, óculos, botina)
- [ ] Proteção de pisos/paredes adjacentes executada
- [ ] Instalações existentes (elétrica, hidro, AC) desligadas/isoladas antes da demolição
- [ ] Demolição executada conforme escopo marcado (sem extrapolar)

**Conclusão**
- [ ] Entulho removido e descartado em caçamba autorizada
- [ ] Nenhum dano em estruturas ou instalações adjacentes
- [ ] Área limpa e pronta para a próxima etapa

---

### FVS 2 — VISTORIA INICIAL / ESTRUTURA

**Pré-execução**
- [ ] Planta executiva conferida com o local real
- [ ] Medições conferidas (largura, altura, pé-direito)
- [ ] Instalações existentes mapeadas (elétrica, hidro, AC)
- [ ] Patologias existentes fotografadas e registradas
- [ ] Acesso de obra verificado
- [ ] Relatório de vistoria assinado pelo cliente

---

### FVS 2B — LAYOUT / MARCAÇÕES

**Marcações de piso (pré-execução)**
- [ ] Topógrafo contratado e no local
- [ ] Cotas e níveis marcados nas paredes (referência para toda a obra)
- [ ] Marcações de paredes executadas no piso conforme projeto
- [ ] Marcações de divisórias/drywall executadas no piso
- [ ] Marcações validadas com o projeto executivo
- [ ] Fotos das marcações registradas antes do início da obra

**Compatibilização — projeção de teto no piso**
- [ ] Pontos de iluminação projetados no piso
- [ ] Dutos de AC projetados no piso (percurso completo)
- [ ] Pontos de dados/telecom projetados no piso
- [ ] Interferências identificadas (coluna, viga, shaft) e registradas
- [ ] Compatibilização aprovada pelo engenheiro antes de prosseguir

**Infras de piso (piso elevado)**
- [ ] Infras de elétrica sob piso elevado marcadas e executadas
- [ ] Infras de dados/telecom sob piso elevado marcadas e executadas
- [ ] Percursos conferidos com projeto antes de tampar
- [ ] Fotos das infras registradas antes do fechamento

---

### FVS 3A — ELÉTRICA BRUTA

**Pré-execução**
- [ ] Projeto elétrico aprovado e conferido com o local
- [ ] Circuitos existentes mapeados e identificados
- [ ] Pontos de tomadas, interruptores e dados marcados nas paredes

**Execução**
- [ ] Infraestrutura de teto executada (eletrodutos, bitola e percurso)
- [ ] Infraestrutura de parede executada
- [ ] Infraestrutura de piso executada (sob piso elevado)
- [ ] Caixas de passagem posicionadas
- [ ] Fiação passada e identificada por circuito

**Identificação da infraestrutura**
- [ ] Eletrodutos identificados com etiqueta/spray (circuito + destino)
- [ ] Caixas numeradas conforme projeto
- [ ] Planta as-built atualizada com percursos reais (se houver desvio)

**Conclusão**
- [ ] Fotos das infraestruturas registradas antes do fechamento
- [ ] Sem fiação exposta ou pontos inacabados
- [ ] Conferido com o projeto antes de fechar paredes/forro

---

### FVS 3B — ELÉTRICA ACABAMENTO

**Quadros e circuitos**
- [ ] Quadro elétrico (QDL) instalado e identificado conforme projeto
- [ ] Disjuntores instalados conforme memorial descritivo
- [ ] Circuitos conectados e identificados nos quadros
- [ ] Transformador posicionado e instalado (se aplicável)

**Pontos e luminárias**
- [ ] Tomadas instaladas e funcionando
- [ ] Interruptores instalados e funcionando
- [ ] Luminárias instaladas conforme projeto (posição e modelo)

**Testes e conclusão**
- [ ] Teste de continuidade realizado em todos os circuitos
- [ ] Teste de funcionamento (ligar/desligar todos os pontos)
- [ ] Sem pontos inacabados ou fiação exposta
- [ ] ART de conclusão assinada pelo responsável técnico

---

### FVS 4 — CABEAMENTO ESTRUTURADO / DADOS E TELECOM

**Pré-execução**
- [ ] Projeto de dados/telecom aprovado e conferido com o local
- [ ] Pontos de rede, telefone e AV marcados conforme projeto

**Infraestrutura bruta**
- [ ] Eletrodutos/calhas de dados instalados (teto + parede + piso)
- [ ] Cabeamento passado e identificado por ponto
- [ ] Infraestrutura identificada (etiqueta por circuito e destino)
- [ ] Fotos registradas antes do fechamento

**Acabamento**
- [ ] Cabeamento concluído e testado
- [ ] Conectorização dos mobiliários realizada
- [ ] Patch panel instalado e organizado
- [ ] Rack/nobreak posicionado conforme projeto
- [ ] Acabamentos de face plate instalados

**Testes e conclusão**
- [ ] Teste de continuidade realizado em todos os pontos
- [ ] Certificação do cabeamento (se exigido pelo cliente)
- [ ] Planta as-built atualizada
- [ ] Sem pontos inacabados

---

### FVS 5 — HIDRÁULICA

**Pré-execução**
- [ ] Projeto hidráulico aprovado e conferido com o local
- [ ] Pontos de água fria e esgoto marcados conforme projeto

**Execução**
- [ ] Tubulações de água fria instaladas (diâmetros conforme projeto)
- [ ] Rede de esgoto executada com caimento correto
- [ ] Esgoto a vácuo executado e aprovado pelo condomínio (se aplicável)
- [ ] Hidrômetro instalado (se aplicável)
- [ ] Registros de fechamento instalados e acessíveis

**Testes**
- [ ] Teste de pressão realizado (resultado: ___ bar)
- [ ] Teste de estanqueidade hidrostático realizado
- [ ] Sem vazamentos após 72h do teste
- [ ] Validação pela empresa gestora do edifício (se exigido)

**Acabamento**
- [ ] Louças instaladas e funcionando
- [ ] Metais e acessórios instalados
- [ ] Ralos e sifões com caimento correto
- [ ] Sem pontos inacabados ou tubulação exposta

---

### FVS 6 — SPRINKLER

**Pré-execução**
- [ ] Projeto de sprinkler aprovado pela empresa gestora/corpo de bombeiros
- [ ] Rede existente mapeada antes de qualquer intervenção
- [ ] Solicitação de despressurização da rede formalizada ao condomínio/gestora
- [ ] Confirmação de data e horário de despressurização recebida
- [ ] Despressurização executada e confirmada antes do início dos serviços

**Execução**
- [ ] Adequação da rede executada conforme projeto
- [ ] Cabeçotes posicionados conforme layout (distâncias e alturas corretas)
- [ ] Conexões e ramais executados sem interferência com outros sistemas

**Testes e validação**
- [ ] Repressurização da rede realizada
- [ ] Teste de estanqueidade realizado
- [ ] Teste hidrostático realizado
- [ ] Validação/aprovação pela empresa responsável
- [ ] Laudo de aprovação emitido e arquivado

**Conclusão**
- [ ] Sistema funcional e sem vazamentos
- [ ] Planta as-built atualizada
- [ ] ART assinada pelo responsável técnico

---

### FVS 7 — SDAI (Detecção e Alarme de Incêndio)

**Pré-execução**
- [ ] Projeto de SDAI aprovado pelo corpo de bombeiros
- [ ] Sistema existente mapeado antes de qualquer intervenção
- [ ] Solicitação de desativação parcial do sistema formalizada ao condomínio/gestora
- [ ] Confirmação de data e horário de desativação recebida

**Execução**
- [ ] Adequação da rede de detecção executada conforme projeto
- [ ] Detectores posicionados conforme layout
- [ ] Acionadores manuais instalados nos locais previstos
- [ ] Cabeamento identificado e organizado
- [ ] Central de alarme atualizada/programada

**Testes e validação**
- [ ] Teste funcional do sistema realizado (acionamento de cada detector)
- [ ] Integração com sistema do condomínio testada
- [ ] Validação pela empresa responsável pelo sistema
- [ ] Laudo de aprovação emitido e arquivado
- [ ] Sistema reativado e operacional

**Conclusão**
- [ ] Planta as-built atualizada
- [ ] ART assinada pelo responsável técnico

---

### FVS 8 — HVAC / AR CONDICIONADO

**Pré-execução**
- [ ] Projeto de HVAC aprovado e conferido com o local
- [ ] BTU por ambiente conferido conforme projeto
- [ ] Equipamentos recebidos e especificação conferida (modelo, capacidade)

**Execução — Infraestrutura**
- [ ] Evaporadoras existentes remanejadas conforme projeto (se aplicável)
- [ ] Novas evaporadoras instaladas e niveladas
- [ ] Exaustores instalados
- [ ] Dutos de insuflamento, renovação e exaustão executados conforme projeto
- [ ] Percurso de dutos projetado no piso e compatibilizado antes de executar
- [ ] Rede frigorífica executada (tubulação cobre, isolamento térmico)
- [ ] Condensadoras instaladas em local adequado
- [ ] Drenos instalados com caimento correto

**Automação (se aplicável)**
- [ ] Controladores/termostatos instalados conforme projeto
- [ ] Integração com sistema de automação predial (BMS) configurada
- [ ] Se sistema central via BMS do condomínio: validação e aprovação formal da gestora/síndico obtida
- [ ] Sensores de presença/CO² integrados ao controle de HVAC (se aplicável)
- [ ] App ou painel de controle configurado e testado
- [ ] Usuário treinado para operação do sistema

**Testes e startup**
- [ ] Carga de gás realizada conforme fabricante
- [ ] Teste de operação realizado (frio/quente em todos os ambientes)
- [ ] Temperatura e vazão de ar conferidas por ambiente
- [ ] Ruído dentro do limite aceitável
- [ ] Startup documentado pelo fornecedor

**Conclusão**
- [ ] Planta as-built atualizada
- [ ] Manual do fabricante entregue e arquivado
- [ ] ART assinada pelo responsável técnico

---

### FVS 9 — DRYWALL

**1ª Fase — Estrutura e 1º Plaqueamento (pré-execução / Bloco 3)**
- [ ] Marcações de paredes e septos conferidas no piso antes de iniciar
- [ ] Guias e montantes instalados conforme projeto (espaçamento e prumo)
- [ ] Reforços de madeira instalados (pontos de fixação de móveis, TVs, equipamentos)
- [ ] Passes de infraestrutura abertos antes do plaqueamento
- [ ] 1º plaqueamento executado (placas sem defeitos, parafusagem correta)
- [ ] Fotos registradas antes do fechamento

**2ª Fase — 2º Plaqueamento e Calafetação (Bloco 4)**
- [ ] Todas as infraestruturas internas concluídas e aprovadas antes de fechar
- [ ] 2º plaqueamento executado
- [ ] Calafetação de juntas e encontros realizada
- [ ] Prumo e alinhamento das paredes conferidos
- [ ] Sem danos, furos indevidos ou placas quebradas
- [ ] Arremates com outras vedações executados

---

### FVS 10 — FORRO

**Estruturação (pré-execução / Bloco 3)**
- [ ] Nível do forro definido e marcado nas paredes (nível laser)
- [ ] Modulação do forro compatibilizada com projeto (luminárias, difusores AC, sprinklers, detectores)
- [ ] Estrutura metálica (tirantes, perfis) instalada e nivelada
- [ ] Abertura de alçapões de manutenção previstas nos locais corretos
- [ ] Fotos da estrutura registradas antes do plaqueamento

**Plaqueamento / Acabamento (Bloco 4)**
- [ ] Placas instaladas conforme modulação aprovada
- [ ] Placas sem manchas, defeitos ou trincas
- [ ] Juntas e arremates invisíveis
- [ ] Recortes para luminárias, difusores e sprinklers executados com precisão
- [ ] Alçapões instalados e funcionando
- [ ] Nível final conferido (sem ondulações)

**Forro Acústico / Baffles (se aplicável)**
- [ ] Especificação do material conferida
- [ ] Estruturação e fixação executadas conforme fabricante
- [ ] Alinhamento e espaçamento dos baffles conferidos
- [ ] Jateamento acústico aplicado com espessura correta (se aplicável)

---

### FVS 11 — IMPERMEABILIZAÇÃO

**Pré-execução**
- [ ] Substrato limpo, seco e sem irregularidades
- [ ] Muretas de contenção e sóculo executados antes da impermeabilização
- [ ] Material especificado conforme projeto

**Execução**
- [ ] Primer aplicado conforme ficha técnica do fabricante
- [ ] Número de demãos aplicado conforme especificação
- [ ] Arremates em cantos, ralos e encontros com parede reforçados
- [ ] Espessura de aplicação conferida

**Testes**
- [ ] Teste de estanqueidade realizado (72h corridas — 3 dias de alagamento)
- [ ] Resultado do teste registrado com fotos
- [ ] Sem infiltrações ou pontos de falha identificados

**Conclusão**
- [ ] Proteção mecânica aplicada após cura total
- [ ] ART do responsável técnico assinada e arquivada

---

### FVS 12 — REVESTIMENTOS E PISOS

**Pré-execução**
- [ ] Material conferido conforme especificação (tipo, modelo, cor, lote — mesmo lote)
- [ ] Substrato limpo, nivelado e seco
- [ ] Caimento para ralos conferido (áreas molhadas)
- [ ] Impermeabilização aprovada antes de iniciar (áreas molhadas)

**Execução**
- [ ] Alinhamento e prumo conferidos (régua/nível laser)
- [ ] Juntas e espaçamento conforme projeto
- [ ] Rejunte aplicado conforme especificação (cor e tipo)
- [ ] Rodapés instalados (altura, fixação e alinhamento)
- [ ] Carpete / vinílico instalados sem bolhas, emendas visíveis ou defeitos
- [ ] Proteção de piso aplicada imediatamente após instalação

**Conclusão**
- [ ] Sem peças quebradas, manchas ou defeitos visíveis
- [ ] Caimento para ralos funcionando (teste com água)
- [ ] Limpeza realizada após conclusão

---

### FVS 13 — PINTURA

**Pré-execução**
- [ ] Superfícies limpas, secas e sem irregularidades
- [ ] Selante/primer aplicado conforme substrato (PVA para drywall, fundo preparador para alvenaria/reboco)
- [ ] Massa corrida aplicada e lixada — se especificado em projeto (não aplicável em acabamento industrial)
- [ ] Cor e acabamento aprovados pelo cliente (amostra física na parede)
- [ ] Proteção de piso, rodapés e esquadrias aplicada antes de pintar

**Execução — Paredes**
- [ ] 1ª demão aplicada (cobertura uniforme)
- [ ] 2ª demão aplicada após secagem completa da 1ª
- [ ] 3ª demão aplicada (acabamento final — após todos os serviços sujos concluídos)

**Execução — Forro e Tabeiras**
- [ ] Massa e pintura de forro executadas
- [ ] Tabeiras pintadas conforme especificação

**Conclusão**
- [ ] Sem manchas, respingos, falhas de cobertura ou marcas de rolo
- [ ] Cantos e arremates executados com fita/pincel (sem sangramento)
- [ ] Proteções removidas e área limpa
- [ ] Cor final confere com amostra aprovada

---

### FVS 14 — MARCENARIA

**Medição e fabricação (pré-execução)**
- [ ] Medição in loco realizada após paredes e forro concluídos
- [ ] Projeto de marcenaria aprovado pelo cliente antes da fabricação
- [ ] Amostra de material/acabamento aprovada pelo cliente
- [ ] Prazo de fabricação confirmado com o fornecedor

**Recebimento**
- [ ] Peças conferidas na entrega (quantidade, modelo, acabamento)
- [ ] Sem danos de transporte
- [ ] Peças armazenadas com proteção até a instalação

**Instalação**
- [ ] Medidas conferidas in loco antes de fixar
- [ ] Nivelamento e prumo verificados (nível laser)
- [ ] Fixação adequada ao substrato
- [ ] Dobradiças, corrediças e puxadores instalados e funcionando
- [ ] Alinhamento com tomadas, interruptores e outros elementos conferido
- [ ] Folgas adequadas em portas e gavetas

**Conclusão**
- [ ] Sem riscos, defeitos ou danos visíveis
- [ ] Acabamento conforme amostra aprovada
- [ ] Limpeza realizada após instalação
- [ ] Garantia do fornecedor registrada e arquivada

---

### FVS 15 — PEDRAS E BANCADAS

**Medição e fabricação (pré-execução)**
- [ ] Medição in loco realizada após marcenaria e hidráulica concluídas
- [ ] Projeto/desenho aprovado pelo cliente antes da fabricação
- [ ] Amostra da pedra aprovada pelo cliente (cor, veio, acabamento)
- [ ] Prazo de fabricação confirmado com o fornecedor

**Recebimento**
- [ ] Peças conferidas na entrega (quantidade, dimensões, acabamento)
- [ ] Sem trincas, lascas ou defeitos visíveis
- [ ] Peças armazenadas com proteção até a instalação

**Instalação**
- [ ] Substrato/marcenaria de apoio nivelado antes da instalação
- [ ] Fixação com argamassa ou silicone conforme especificação
- [ ] Nivelamento e alinhamento conferidos
- [ ] Recortes para cubas, torneiras e ralos executados com precisão
- [ ] Rejuntamento e vedação com silicone nas bordas e encontros

**Conclusão**
- [ ] Sem trincas, manchas ou defeitos após instalação
- [ ] Cubas e torneiras instaladas e sem vazamentos
- [ ] Proteção aplicada (selante para pedras porosas, se aplicável)
- [ ] Limpeza realizada após instalação

---

### FVS 16 — VIDROS E ESQUADRIAS

**Pré-execução**
- [ ] Especificação conferida (espessura, tipo — temperado/laminado/insulado)
- [ ] Medição in loco realizada antes da fabricação
- [ ] Projeto/desenho aprovado pelo cliente

**Recebimento**
- [ ] Peças conferidas na entrega (quantidade, dimensões, tipo)
- [ ] Sem riscos, trincas ou defeitos visíveis
- [ ] Certificado de temperagem/laminação disponível (se exigido)

**Instalação**
- [ ] Esquadrias sem empenos ou deformações
- [ ] Nivelamento e prumo verificados (nível laser)
- [ ] Fixação adequada ao substrato
- [ ] Vedação de silicone aplicada em toda a extensão (sem falhas)
- [ ] Ferragens, fechaduras e dobradiças instaladas e funcionando
- [ ] Folgas e batentes corretos

**Conclusão**
- [ ] Sem riscos, manchas ou imperfeições nos vidros
- [ ] Abertura e fechamento funcionando suavemente
- [ ] Estanqueidade testada (sem entrada de água/vento)
- [ ] Película de proteção removida e vidros limpos
- [ ] ABNT NBR 7199 atendida

---

### FVS 17 — DIVISÓRIAS INDUSTRIAIS

**Medição e fabricação (pré-execução)**
- [ ] Medição in loco realizada após piso e forro concluídos
- [ ] Projeto executivo emitido e aprovado antes da fabricação
- [ ] Especificação conferida (tipo, espessura, acabamento, vidro se aplicável)
- [ ] Prazo de fabricação confirmado com o fornecedor

**Recebimento**
- [ ] Peças conferidas na entrega (quantidade, dimensões, acabamento)
- [ ] Sem danos de transporte
- [ ] Peças armazenadas com proteção até a instalação

**Instalação**
- [ ] Marcações de piso conferidas antes de instalar
- [ ] Prumo e alinhamento verificados (nível laser)
- [ ] Fixação no piso, teto e paredes conforme especificação do fabricante
- [ ] Passes de elétrica e dados integrados às divisórias (se aplicável)
- [ ] Portas, ferragens e fechaduras instaladas e funcionando
- [ ] Vedação acústica aplicada (se especificado)

**Conclusão**
- [ ] Sem danos, riscos ou defeitos visíveis
- [ ] Abertura e fechamento de portas funcionando suavemente
- [ ] Alinhamento com forro e piso conferido
- [ ] Garantia do fornecedor registrada e arquivada

---

### FVS 18 — LIMPEZA TÉCNICA

**Remoção de resíduos**
- [ ] Entulho e embalagens removidos da obra
- [ ] Caçamba esvaziada e retirada
- [ ] Materiais sobressalentes organizados e identificados

**Limpeza geral**
- [ ] Pisos limpos (sem resíduos de argamassa, tinta, cola, fita)
- [ ] Paredes limpas (sem respingos, manchas ou marcas)
- [ ] Forro limpo (sem poeira, manchas ou resíduos)
- [ ] Vidros e espelhos limpos
- [ ] Esquadrias e trilhos limpos
- [ ] Rodapés limpos e sem resíduos

**Instalações**
- [ ] Luminárias e difusores de AC limpos
- [ ] Filtros de AC limpos e substituídos (se necessário)
- [ ] Banheiros higienizados
- [ ] Ralos limpos e funcionando

**Conclusão**
- [ ] Obra em condições de vistoria com o cliente
- [ ] Nenhum item de obra esquecido no local
- [ ] Áreas comuns do condomínio limpas (corredor, elevador)

---

### FVS 19 — VISTORIA FINAL / PRÉ-ENTREGA

**Instalações**
- [ ] Todos os pontos elétricos funcionando (tomadas, interruptores, luminárias)
- [ ] Quadro elétrico identificado e organizado
- [ ] Todos os pontos hidráulicos sem vazamento
- [ ] AC funcionando em todos os ambientes
- [ ] Sprinkler e SDAI operacionais
- [ ] Controle de acesso funcionando

**Acabamentos**
- [ ] Paredes sem danos, manchas ou imperfeições pós-obra
- [ ] Forro sem danos ou desnivelamentos
- [ ] Pisos sem arranhões, manchas ou peças soltas
- [ ] Marcenaria sem danos e funcionando
- [ ] Vidros e esquadrias sem riscos e funcionando
- [ ] Divisórias sem danos e funcionando
- [ ] Persianas instaladas e funcionando

**Documentação**
- [ ] ARTs de todos os sistemas arquivadas
- [ ] Manuais dos equipamentos organizados
- [ ] Garantias dos fornecedores registradas
- [ ] Planta as-built atualizada
- [ ] Punch List interno concluído (pendências zeradas)
- [ ] Obra aprovada pela equipe BÈR para receber o cliente

---

### FVS 20 — DESMOBILIZAÇÃO DE CANTEIRO

**Retirada de equipamentos e materiais**
- [ ] Ferramentas e equipamentos retirados da obra
- [ ] Materiais sobressalentes retirados ou descartados
- [ ] Geladeira, mesa, TV e mobiliário do canteiro retirados
- [ ] Almoxarifado esvaziado e limpo

**Áreas comuns**
- [ ] Delimitação/tapume leve retirado
- [ ] Proteções de piso das áreas comuns retiradas
- [ ] Corredor de acesso limpo e sem danos
- [ ] Elevador inspecionado (sem danos em paredes, portas ou piso)
- [ ] Áreas comuns entregues nas mesmas condições da vistoria inicial

**Encerramento com o condomínio**
- [ ] Chaves e acessos provisórios devolvidos
- [ ] Autorização de obras encerrada formalmente com a gestora
- [ ] Vistoria de desmobilização realizada com o síndico/gestora
- [ ] Termo de desmobilização assinado (se exigido pelo condomínio)
