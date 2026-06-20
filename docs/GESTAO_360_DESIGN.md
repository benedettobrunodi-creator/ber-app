# Gestão 360 — Design Document

**Status:** Proposta · aguardando revisão Bruno
**Origem:** Análise da planilha `Gestão 360 REV02 Set 2024.xlsx` (54 abas) cruzada com o estado atual do `ber-app`.
**Objetivo:** Substituir a planilha como sistema de gestão integrada de obra dentro do BÈR App.

---

## 1. Princípio arquitetural

> **Single source of truth.** Cada dado mora numa única tabela. O módulo Gestão 360 é uma cabine de comando (cockpit) por obra — agrega visualmente, edita inline via APIs nativas, mas nunca duplica.

Consequências práticas:
- Trocou o status de um Aditivo no card do 360 → ele chama `PATCH /v1/obras/:obraId/aditivos/:id` (mesma API do módulo Aditivos).
- Mudou a área (m²) da obra no card do 360 → chama `PATCH /v1/obras/:obraId` (mesma API do cadastro).
- Se amanhã precisar de "lista de todos os aditivos de todas as obras pra Warren", basta consultar a tabela — não precisa raspar o 360.

---

## 2. Mapa Excel → App

### 2.1 Camada Gestão (17 abas)

| Aba Excel | Mora hoje no app? | Ação |
|---|---|---|
| **00-Dash** (cabeçalho da obra) | Parcial — `Obra` tem nome, cliente, endereço, datas, valor contrato, situação | 🟡 Adicionar campos: `arquiteturaEscritorio`, `gerenciadora`, `areaM2` |
| **01-Stak** (Stakeholders) | ❌ Não existe | 🔴 Criar módulo `ObraStakeholder` |
| **02-Kick Off** | Parcial — `Obra.fase = kickoff_interno` existe; conteúdo da reunião não | 🔴 Criar `ObraKickoff` (1:1 com Obra) |
| **03-Resp** (Matriz RACI) | ❌ Não existe | 🔴 Criar `ObraRaci` |
| **04-Orgn** (Organograma da obra) | Parcial — existe `OrgChart` global da BÈR | 🟡 Criar `ObraOrgChart` (estrutura específica da equipe daquela obra) |
| **05-Cron** (Cronograma físico) | Parcial — `Cronograma` (arquivo + parsed data) | 🟢 Reutilizar; visualização Gantt no 360 |
| **06-Hist** (Histograma de MO) | ❌ Não existe (alocação existe pra equipe BÈR; não pra histograma físico de obra) | 🔴 Criar `ObraHistograma` |
| **07-Ata Int** (Atas internas) | ❌ Não existe | 🔴 Criar `ObraAta` (com tipo `interna` \| `externa`) |
| **08-Ata Ext** (Atas externas) | ❌ Não existe | (mesmo módulo `ObraAta`) |
| **09-Adit** (Aditivos / Change Orders) | Parcial — existe `ComprasSplit.coTipo` (CO atrelada a item de compra) | 🔴 Criar `ObraAditivo` formal com workflow de aprovação |
| **10-Cont** (Controle de Contratações) | Parcial — `ComprasMeta.fornecedor` armazena fornecedor escolhido | 🟡 Adicionar `ObraContratacao` formal (contrato, vigência, status, anexo) |
| **11-CrnC** (Cronograma de Contratações) | ❌ Não existe | 🔴 Criar `ObraContratacaoPlano` (data ideal/limite de contratação por pacote) |
| **12-OCs** (Ordens de Compra) | ❌ Não existe como entidade | 🔴 Criar `ObraOrdemCompra` |
| **13-Cdoc** (Docs e Aprovações) | Parcial — `ObraPlanta` cobre projetos arquitetônicos | 🔴 Criar `ObraDocumento` geral (com status de aprovação) |
| **14-Meds** (Medições) | ✅ Existe — `Medicao`, `MedicaoItem`, `MedicaoLancamento` | 🟢 Reutilizar; expor no 360 |
| **15-Pend** (Pendências) | Parcial — `PunchList` e `PunchListItem` existem | 🟡 Avaliar se reaproveita `PunchList` ou cria `ObraPendencia` dedicado |
| **16-Gpen** (Gráfico de pendências) | ❌ Não existe | 🟢 Não é módulo — é visualização derivada de Pendências |
| **17-MAPA** (Consolidado financeiro) | ✅ Existe — `/compras` (consolidado), `/obras/[id]/compras` (por obra) | 🟢 Reutilizar; expor cards no 360 |

### 2.2 Camada Operacional (36 abas — mapas de compra por disciplina)

✅ **100% coberto** por `ComprasMeta` no módulo de Compras. Cada aba do Excel é um filtro/visão por disciplina (categoria) das metas existentes.

Possível upgrade: campo `disciplina` em `ComprasMeta` pra agrupar e expor visões por disciplina (hoje agrupa só por etapa/categoria livre).

---

## 3. Schemas propostos (novos módulos)

> Todos os novos modelos têm `obraId` (FK pra `Obra`, cascade delete) + `createdAt`/`updatedAt`.

### 3.1 `Obra` — campos novos
```prisma
model Obra {
  // ... campos existentes
  arquiteturaEscritorio String? @map("arquitetura_escritorio") @db.VarChar(255)
  gerenciadora          String? @map("gerenciadora") @db.VarChar(255)
  areaM2                Float?  @map("area_m2")
}
```

### 3.2 `ObraStakeholder`
```prisma
model ObraStakeholder {
  id        String  @id @default(uuid()) @db.Uuid
  obraId    String  @map("obra_id") @db.Uuid
  empresa   String  @db.VarChar(255)
  nome      String  @db.VarChar(255)
  cargo     String? @db.VarChar(150)
  email     String? @db.VarChar(255)
  telefone  String? @db.VarChar(50)
  funcao    String? @db.VarChar(150) // ex: "Decision maker", "Arquiteto líder", "Approver de aditivos"
  ordem     Int     @default(0)

  obra Obra @relation(fields: [obraId], references: [id], onDelete: Cascade)
  @@index([obraId])
}
```

### 3.3 `ObraKickoff`
```prisma
model ObraKickoff {
  id              String   @id @default(uuid()) @db.Uuid
  obraId          String   @unique @map("obra_id") @db.Uuid
  dataRealizada   DateTime? @map("data_realizada")
  participantes   String?  // texto livre ou JSON com IDs de users/stakeholders
  pautaCoberta    String?
  decisoes        String?
  premissas       String?
  riscosIniciais  String?
  ataUrl          String?  @map("ata_url")

  obra Obra @relation(fields: [obraId], references: [id], onDelete: Cascade)
}
```

### 3.4 `ObraRaci` (matriz responsabilidades)
```prisma
model ObraRaci {
  id          String   @id @default(uuid()) @db.Uuid
  obraId      String   @map("obra_id") @db.Uuid
  atividade   String   @db.VarChar(255)
  ordem       Int      @default(0)
  // map: { userId/stakeholderId -> "R" | "A" | "C" | "I" }
  papeis      Json     @default("{}")

  obra Obra @relation(fields: [obraId], references: [id], onDelete: Cascade)
  @@index([obraId])
}
```

### 3.5 `ObraAta`
```prisma
model ObraAta {
  id            String   @id @default(uuid()) @db.Uuid
  obraId        String   @map("obra_id") @db.Uuid
  tipo          String   @db.VarChar(10) // "interna" | "externa"
  numero        String   @db.VarChar(20)
  data          DateTime @db.Date
  local         String?  @db.VarChar(255)
  participantes Json     // [{ tipo:"user"|"stakeholder", id, nome }]
  pauta         String
  decisoes      String?
  anexoUrl      String?  @map("anexo_url")

  obra      Obra            @relation(fields: [obraId], references: [id], onDelete: Cascade)
  pendencias ObraPendencia[] @relation("PendenciaOrigemAta")

  @@index([obraId])
  @@index([tipo])
}
```

### 3.6 `ObraAditivo`
```prisma
model ObraAditivo {
  id          String   @id @default(uuid()) @db.Uuid
  obraId      String   @map("obra_id") @db.Uuid
  numero      String   @db.VarChar(20)
  descricao   String
  valor       Decimal  @db.Decimal(14, 2)
  tipo        String   @db.VarChar(20) // "credito" | "debito"
  motivo      String?
  status      String   @default("em_analise") @db.VarChar(20)
                       // em_analise | aprovado | rejeitado | em_execucao | concluido
  dataAbertura  DateTime @default(now()) @map("data_abertura")
  dataDecisao   DateTime? @map("data_decisao")
  decididoPorId String?  @map("decidido_por") @db.Uuid
  anexoUrl      String?  @map("anexo_url")

  obra Obra @relation(fields: [obraId], references: [id], onDelete: Cascade)
  @@index([obraId])
  @@index([status])
}
```

### 3.7 `ObraContratacao` (formaliza contratos por fornecedor)
```prisma
model ObraContratacao {
  id           String   @id @default(uuid()) @db.Uuid
  obraId       String   @map("obra_id") @db.Uuid
  fornecedor   String   @db.VarChar(255)
  disciplina   String?  @db.VarChar(100)
  valor        Decimal  @db.Decimal(14, 2)
  dataAssinatura DateTime? @map("data_assinatura") @db.Date
  vigenciaInicio DateTime? @map("vigencia_inicio") @db.Date
  vigenciaFim    DateTime? @map("vigencia_fim") @db.Date
  status       String   @default("em_negociacao") @db.VarChar(20)
                       // em_negociacao | aprovado | assinado | em_execucao | concluido | rescindido
  contratoUrl  String?  @map("contrato_url")
  observacoes  String?

  obra Obra @relation(fields: [obraId], references: [id], onDelete: Cascade)
  ocs  ObraOrdemCompra[]
  @@index([obraId])
}
```

### 3.8 `ObraContratacaoPlano` (Cronograma de Contratações)
```prisma
model ObraContratacaoPlano {
  id              String   @id @default(uuid()) @db.Uuid
  obraId          String   @map("obra_id") @db.Uuid
  pacote          String   @db.VarChar(100) // disciplina ou etapa
  dataIdeal       DateTime? @map("data_ideal") @db.Date
  dataLimite      DateTime? @map("data_limite") @db.Date
  contratacaoId   String?  @unique @map("contratacao_id") @db.Uuid // preenchido quando vira contrato
  status          String   @default("a_contratar") @db.VarChar(20)
                           // a_contratar | em_cotacao | contratado | atrasado

  obra        Obra              @relation(fields: [obraId], references: [id], onDelete: Cascade)
  contratacao ObraContratacao?  @relation(fields: [contratacaoId], references: [id])
  @@index([obraId])
}
```

### 3.9 `ObraOrdemCompra`
```prisma
model ObraOrdemCompra {
  id             String   @id @default(uuid()) @db.Uuid
  obraId         String   @map("obra_id") @db.Uuid
  contratacaoId  String?  @map("contratacao_id") @db.Uuid
  numero         String   @db.VarChar(30)
  fornecedor     String   @db.VarChar(255)
  descricao      String
  valor          Decimal  @db.Decimal(14, 2)
  dataEmissao    DateTime @default(now()) @map("data_emissao")
  dataPrevistaEntrega DateTime? @map("data_prevista_entrega") @db.Date
  dataEntregaReal     DateTime? @map("data_entrega_real") @db.Date
  status         String   @default("aberta") @db.VarChar(20)
                          // aberta | aprovada | em_entrega | entregue | cancelada
  anexoUrl       String?  @map("anexo_url")

  obra         Obra             @relation(fields: [obraId], references: [id], onDelete: Cascade)
  contratacao  ObraContratacao? @relation(fields: [contratacaoId], references: [id])
  @@index([obraId])
}
```

### 3.10 `ObraDocumento`
```prisma
model ObraDocumento {
  id           String   @id @default(uuid()) @db.Uuid
  obraId       String   @map("obra_id") @db.Uuid
  tipo         String   @db.VarChar(50) // "projeto" | "memorial" | "as_built" | "contrato" | "certificado" | ...
  nome         String   @db.VarChar(255)
  revisao      String?  @db.VarChar(20)
  emitidoPor   String?  @map("emitido_por") @db.VarChar(255)
  dataEmissao  DateTime? @map("data_emissao") @db.Date
  status       String   @default("em_analise") @db.VarChar(20)
                        // em_analise | aprovado | reprovado | pendente
  aprovadoEm   DateTime? @map("aprovado_em")
  aprovadoPorId String?  @map("aprovado_por") @db.Uuid
  arquivoUrl   String   @map("arquivo_url")
  observacoes  String?

  obra Obra @relation(fields: [obraId], references: [id], onDelete: Cascade)
  @@index([obraId])
}
```

### 3.11 `ObraPendencia`
```prisma
model ObraPendencia {
  id            String   @id @default(uuid()) @db.Uuid
  obraId        String   @map("obra_id") @db.Uuid
  titulo        String   @db.VarChar(255)
  descricao     String?
  responsavelId String?  @map("responsavel_id") @db.Uuid
  prazo         DateTime? @db.Date
  status        String   @default("aberta") @db.VarChar(20)
                         // aberta | em_andamento | concluida | cancelada
  prioridade    String   @default("media") @db.VarChar(10) // baixa | media | alta | critica
  // Origem (de onde veio): ata, diário, vistoria, livre
  origemTipo    String?  @map("origem_tipo") @db.VarChar(20)
  origemId      String?  @map("origem_id") @db.Uuid
  ataOrigemId   String?  @map("ata_origem_id") @db.Uuid
  resolvidaEm   DateTime? @map("resolvida_em")

  obra      Obra     @relation(fields: [obraId], references: [id], onDelete: Cascade)
  ataOrigem ObraAta? @relation("PendenciaOrigemAta", fields: [ataOrigemId], references: [id])
  @@index([obraId])
  @@index([status])
}
```

### 3.12 `ObraHistograma`
```prisma
model ObraHistograma {
  id        String   @id @default(uuid()) @db.Uuid
  obraId    String   @map("obra_id") @db.Uuid
  funcao    String   @db.VarChar(100) // "Pedreiro", "Eletricista", etc
  ano       Int
  mes       Int      // 1..12
  hhPlan    Float    @default(0) @map("hh_plan")
  hhReal    Float    @default(0) @map("hh_real")

  obra Obra @relation(fields: [obraId], references: [id], onDelete: Cascade)
  @@unique([obraId, funcao, ano, mes])
  @@index([obraId])
}
```

### 3.13 `ObraOrgChart` (organograma específico da obra)
```prisma
model ObraOrgChart {
  id        String   @id @default(uuid()) @db.Uuid
  obraId    String   @unique @map("obra_id") @db.Uuid
  estrutura Json     // árvore de nós: { id, nome, cargo, pai, children:[] }

  obra Obra @relation(fields: [obraId], references: [id], onDelete: Cascade)
}
```

---

## 4. APIs sugeridas

Padrão REST consistente com o app atual:

```
GET    /v1/obras/:obraId/stakeholders
POST   /v1/obras/:obraId/stakeholders
PUT    /v1/obras/:obraId/stakeholders/:id
DELETE /v1/obras/:obraId/stakeholders/:id
```

Mesmo padrão pra: `kickoff` (com PUT em /kickoff sem ID por ser 1:1), `raci`, `atas`, `aditivos`, `contratacoes`, `contratacao-plano`, `ordens-compra`, `documentos`, `pendencias`, `histograma`, `org-chart`.

Permissions (sugeridas):
- `gestao360` — visualizar o cockpit consolidado
- `aditivos` — editar aditivos
- `contratacoes` — editar contratos/OCs
- `documentos` — editar e aprovar docs
- `pendencias` — gerenciar pendências
- Demais (atas/stakeholders/RACI/kickoff) podem entrar no perm `gestao360`

---

## 5. UI Gestão 360 (cockpit por obra)

Rota: `/obras/[id]/gestao-360`

Layout: tabbed dashboard com 6 abas:

| Aba | Conteúdo |
|---|---|
| **Visão Geral** | Cabeçalho (cards de KPI: % obra, prazo, valor contrato, saving consolidado, aditivos R$, pendências abertas). Mini-Gantt. Próximos marcos. |
| **Equipe & Stakeholders** | Stakeholders + Organograma da obra + Matriz RACI |
| **Compras & Contratos** | Cronograma de contratações + Contratos ativos + OCs + Resumo do MAPA |
| **Reuniões & Decisões** | Atas internas/externas + Kickoff + Pendências geradas |
| **Aditivos & Mudanças** | Lista de aditivos com filtros, total R$ aprovado/em análise/rejeitado |
| **Medições & Documentos** | Medições mensais + Histograma + Documentos com status |

Cada card tem:
- View read-only (default)
- Botão "Editar" abre modal/drawer com form que chama API nativa do módulo
- Botão "Ir pro módulo completo" leva pra `/obras/[id]/<modulo>`

---

## 6. Ordem de implementação proposta

Priorizada por impacto (financeiro/operacional) e dependências:

### Fase 1 — Fundação (1-2 semanas)
1. **Aditivos** — alto impacto financeiro; bloqueia gestão de mudanças
2. **Contratações + OCs** — formaliza o que hoje é só "nome do fornecedor" em ComprasMeta
3. **Campos novos na Obra** (arquitetura, gerenciadora, área) — preparação pra Visão Geral

### Fase 2 — Operação (1-2 semanas)
4. **Atas** (internas + externas) — diário operacional formal
5. **Pendências** — fechamento de loop de atas/diário; substitui PunchList se for o caso
6. **Documentos** — controle de aprovação

### Fase 3 — Contexto (1 semana)
7. **Stakeholders** — dado relativamente estático
8. **Kickoff** — 1 registro por obra
9. **RACI** — matriz simples
10. **Organograma da obra** — adapta o OrgChart existente
11. **Cronograma de Contratações** — alimenta visão preditiva

### Fase 4 — Cockpit (1 semana)
12. **Tela Gestão 360** — agregador visual dos módulos acima
13. **Histograma de MO** — última peça pra ter "tudo do Excel" no app

---

## 7. Pontos abertos pra decisão

- [ ] **PunchList vs Pendências:** reaproveitar o módulo existente de PunchList (rebranding) ou criar `ObraPendencia` separado? Recomendação: rebranding/extender PunchList.
- [ ] **Cronograma físico:** hoje é upload de arquivo + parsed data. Pra Gantt no 360, precisaríamos parsear estruturado (MS Project / Excel padronizado) ou criar UI de cadastro manual de atividades?
- [ ] **Permissions por obra:** os módulos hoje são acesso global (você vê todas as obras se tem a perm). Faz sentido restringir aditivos/contratos por obra (só coordenador da obra edita)?
- [ ] **Anexos:** todos os modelos têm `*Url` pra anexo único. Vale generalizar via tabela `Attachment` polimórfica (1 entidade → N anexos)?
- [ ] **Stakeholders e User:** stakeholders externos não são users do sistema. Cabe expor convite p/ virarem users? Ou ficam só como contato?

---

## 8. Métrica de sucesso

A planilha "Gestão 360" pode ser arquivada quando:

1. Toda obra ativa tem cadastro completo no app (KPI: 0 obras com campos vazios em Visão Geral).
2. Coordenadores deixam de exportar Excel ao final do mês pra fechar status com cliente — o cockpit já mostra tudo.
3. Bruno consegue, sem perguntar, em <30s: "qual o status dos aditivos da obra X" / "quantas pendências abertas tem a obra Y" / "quanto a obra Z saving %".

---

*Próximo passo:* Bruno revisa, marca o que mudar, e damos go pra Fase 1.
