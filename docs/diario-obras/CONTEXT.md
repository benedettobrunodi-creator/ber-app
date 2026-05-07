# Diário de Obras — Contexto e Histórico de Decisões

> **Status atual:** Fase 1 — backend e frontend implementados (escopo expandido para incluir as 6 seções funcionais), testes manuais pendentes

---

## 1. Decisões Tomadas

### Estrutura geral
- **Módulo top-level** em `/(app)/diario/` (não tab dentro de obras)
- **Um diário por obra por dia** — constraint único `@@unique([obraId, data])`
- **Fechamento manual** via botão "Fechar diário" (sem fechamento automático)
- **Status:** `rascunho` → `fechado`

### Ambientes
- Cidadão de primeira classe: `Ambiente` tem cadastro próprio por obra
- **MVP sem planta/pin** — só nome, ordem, ativo
- Ambientes são reutilizados entre diários (ex.: "Sala", "Banheiro Suite")
- Constraint: `@@unique([obraId, nome])`

### Seções do diário
O diário tem cabeçalho + 6 seções:
1. **Efetivo** — quem trabalhou (membro BÈR ou externo), função, origem (ponto automático ou manual)
2. **Atividades** — o que foi executado, com vínculo opcional ao Sequenciamento
3. **Fotos** — por ambiente, com legenda e ordem
4. **Ocorrências** — tipo, descrição, flag `visivelCliente`
5. **Visitas** — tipo, nome, flag `visivelCliente`
6. **Materiais** — com vínculo opcional a Recebimentos
7. **Equipamentos** — equipamentos em uso no dia

### Permissões
| Ação | Quem pode |
|---|---|
| Criar, editar, fechar diário | Todos os usuários autenticados |
| Reabrir diário | Roles nível ≥ 2 via `requireRole('gestor')` |
| Excluir diário | Roles nível ≥ 2 via `requireRole('gestor')` |
| Excluir foto | Roles nível ≥ 2 via `requireRole('gestor')` |
| Soft-delete de ambiente | Roles nível ≥ 2 via `requireRole('gestor')` |

> **Nota:** "gestor, pmo, diretoria" é simplificação. Na prática, `requireRole('gestor')` libera todos os roles com nível ≥ 2 no `ROLE_HIERARCHY`: `gestor`(2), `engenharia`(2), `financeiro`(2), `pmo`(2), `coordenacao`(3), `diretoria`(4). Padrão consistente com o restante do app.

Permissão `"diario": true` para **todos os roles** no `DEFAULT_PERMS`.

### Aba Fotos atual (obras)
- **Não será tocada na Fase 1**
- Migração e remoção planejadas para **Fase 4**

---

## 2. Relatório de Investigação (pré-implementação)

### Stack confirmada

| Camada | Lib | Versão |
|---|---|---|
| Framework | Next.js | 16.2.0 |
| React | React | 19.2.4 |
| CSS | Tailwind CSS | v4 |
| UI components | Nenhuma (custom, sem shadcn) | — |
| State | Zustand | 5.0.12 |
| Data fetching | React Query | 5.91.2 |
| Forms | react-hook-form + zod | 7.x / 4.x |
| HTTP client | axios | 1.13.6 |
| ORM | Prisma | 6.4.0 |
| DB | PostgreSQL | — |
| Upload | multer + @aws-sdk/client-s3 | — |
| Storage | Cloudflare R2 | — |
| PDF | pdfjs-dist (front) + pdf-to-png-converter (back) | — |
| Canvas | Konva + react-konva | — |
| Charts | Recharts | 3.x |
| Real-time | Socket.io | 4.x |

### Estrutura de pastas relevante

```
ber-app/
├── backend/
│   ├── prisma/schema.prisma
│   └── src/
│       ├── modules/           ← cada módulo tem routes.ts, controller.ts
│       │   ├── fotos/
│       │   ├── fvs/
│       │   ├── sequenciamento/
│       │   └── ...
│       ├── middleware/        ← authenticate, requireRole
│       └── services/
│           └── storage.ts     ← abstração R2/local
└── web/
    └── src/
        ├── app/(app)/
        │   ├── layout.tsx     ← guarda de rotas por permissão
        │   ├── obras/[id]/page.tsx  ← 3.600 linhas (todas as tabs)
        │   └── ...
        ├── components/
        ├── lib/api.ts         ← axios client
        └── stores/authStore.ts  ← Zustand: user, permissions
```

### Padrão de módulo backend

Cada módulo em `backend/src/modules/<nome>/`:
- `routes.ts` — define as rotas Express, aplica `authenticate` + `requireRole` conforme necessário
- `controller.ts` — handlers das rotas
- O módulo é registrado no `app.ts` ou `index.ts` principal

Exemplo de rota com permissão:
```typescript
router.post('/:id/fechar', authenticate, controller.fechar);
router.post('/:id/reabrir', authenticate, requireRole('gestor'), controller.reabrir);
```

### Padrão de permissões (frontend)

`DEFAULT_PERMS` em `web/src/stores/authStore.ts`:
```typescript
const DEFAULT_PERMS: Record<UserRole, Record<string, boolean>> = {
  diretoria:   { dashboard: true, obras: true, ... },
  coordenacao: { ... },
  pmo:         { ... },
  // etc.
};
```

`ROUTE_PERMS` em `web/src/app/(app)/layout.tsx`:
```typescript
const ROUTE_PERMS = [
  { prefix: '/obras', perm: 'obras' },
  // novo: { prefix: '/diario', perm: 'diario' }
];
```

### Padrão de upload de fotos

- Backend recebe `multipart/form-data` via `multer`
- Faz upload para Cloudflare R2 via `@aws-sdk/client-s3`
- Retorna URL pública (`S3_PUBLIC_URL/<key>`)
- Limite: 20 MB por arquivo
- Sem lib de upload client-side — axios com `FormData` direto

### Models relevantes já existentes

**`ObraAmbiente`** — existe no schema atual, mas está acoplado a plantas (tem `plantaId`, `posX`, `posY`, `cor`). Não será reaproveitado: criaremos `Ambiente` novo, mais simples e desacoplado.

**`ObraFoto`** — modelo existente da aba Fotos. Não será alterado na Fase 1.

**`TimeEntry`** — modelo de ponto (check_in/check_out por obra). Será lido na Fase 3 para popular efetivo automaticamente.

**`ObraEtapa`** — sequenciamento. Será lido na Fase 3 para popular atividades automaticamente.

**`RecebimentoMaterial`** — será lido na Fase 3 para popular materiais automaticamente.

---

## 3. Dúvidas Levantadas e Respostas

| # | Dúvida | Resposta |
|---|---|---|
| 1 | Escopo funcional: só fotos ou RDO completo? | **RDO completo** com efetivo, atividades, fotos, ocorrências, visitas, materiais, equipamentos |
| 2 | Aba Fotos some ou coexiste? | **Coexiste por enquanto** — remoção planejada para Fase 4 |
| 3 | Fotos agrupadas por data, etapa ou livre? | **Por data** (uma entrada/dia) + por ambiente dentro do dia |
| 4 | Quem pode registrar? | **Todos os autenticados** criam/editam; roles gestor/pmo/diretoria reabrem/excluem |
| 5 | Dados existentes em ObraFoto? | **Convivência** — migração para Fase 4, sem toque agora |

---

## 4. Plano de Fases

### Fase 1 — Fundação (Schema + Backend + Página mínima)
**Escopo:**
- Adicionar models ao schema Prisma: `Ambiente`, `DiarioObra`, `DiarioEfetivo`, `DiarioAtividade`, `DiarioFoto`, `DiarioOcorrencia`, `DiarioVisita`, `DiarioMaterial`, `DiarioEquipamento`
- Relações inversas em `Obra` e `User`
- Migration: `add_diario_obras_module`
- Endpoints backend:
  - Ambientes CRUD (GET/POST `/obras/:obraId/ambientes`, PATCH/DELETE `/ambientes/:id`)
  - Diários: listar, hoje (auto-cria rascunho), detalhe, atualizar cabeçalho, fechar, reabrir, excluir
- Permissão `"diario"` no `DEFAULT_PERMS` de todos os roles
- `/(app)/diario/page.tsx` — lista de obras com status do diário do dia
- `/(app)/diario/[obraId]/page.tsx` — placeholder com botão "Diário de hoje"
- Item "Diário" no sidebar

**Fora do escopo desta fase:** upload de fotos, integrações automáticas, migração de ObraFoto, PDF.

---

### Fase 2 — Upload de Fotos e Ambientes
**Escopo:**
- Interface de cadastro de Ambientes por obra
- Upload de fotos no diário (endpoint `POST /diarios/:id/fotos`)
- Galeria de fotos por ambiente dentro do diário
- Exclusão de foto (só roles autorizados)
- Ordenação de fotos por drag-and-drop

---

### Fase 3 — Seções do Diário + Integrações
**Escopo:**
- Formulários para todas as seções: efetivo, atividades, ocorrências, visitas, materiais, equipamentos
- Auto-populate efetivo a partir de `TimeEntry` (check_in do dia na obra)
- Auto-populate atividades a partir de `ObraEtapa` (etapas em andamento)
- Auto-populate materiais a partir de `RecebimentoMaterial` (entregas do dia)
- Flag `visivelCliente` nas ocorrências e visitas
- Filtro de visualização interna vs. para cliente

---

### Fase 4 — Migração + Remoção da aba Fotos antiga
**Escopo:**
- Script de migração de `ObraFoto` → `DiarioFoto` (agrupando por data)
- Remoção da aba "fotos" de `/obras/[id]/page.tsx`
- Atualização do cockpit da obra (link para diário em vez de galeria embutida)
- Geração de PDF do diário (relatório para cliente)

---

### Fase 5 — Polimento e Recursos Avançados
**Escopo:**
- Visualização timeline de ambientes (visão principal)
- Exportação em lote (múltiplos diários → PDF/Excel)
- Notificações (diário do dia não fechado até X horas)
- Histórico de edições (audit log)
- Busca full-text em ocorrências e atividades

---

## 5. Status Atual

**Fase 1 — backend e frontend implementados, testes manuais pendentes**

### Checklist da Fase 1

- [x] Investigação preliminar: `ObraAmbiente` existente, padrão de migration, padrão de rotas
- [x] Atualizar `schema.prisma` com novos models
- [x] Adicionar relações inversas em `Obra` e `User`
- [x] Adicionar `"diario": true` ao `DEFAULT_PERMS` em `authStore.ts` — todos os 9 roles
- [x] Rodar migration `add_diario_obras_module` (aplicada no Railway, 9 tabelas criadas)
- [x] Criar `backend/src/modules/diario/routes.ts`, `controller.ts` e `types.ts`
- [x] Registrar rotas no `app.ts` (`/v1/obras/:id/diario` e `/v1/diario`)
- [x] Criar `web/src/app/(app)/diario/page.tsx` — lista de obras com status do último diário
- [x] Criar `web/src/app/(app)/diario/[obraId]/page.tsx` — detalhe com as 6 seções funcionais (efetivos, atividades, ocorrências, visitas, materiais, equipamentos), fechar/reabrir
- [x] Adicionar item "Diário de Obra" no sidebar + ROUTE_PERMS (`layout.tsx`)
- [x] Adicionar `postinstall: prisma generate` no `backend/package.json`
- [ ] Teste manual: criar diário, adicionar seções, fechar, reabrir

> **Nota de escopo:** A Fase 1 foi entregue com escopo expandido — as 6 seções do diário (antes previstas para a Fase 3) já estão funcionais no frontend. As Fases 2 e 3 originais podem ser revisadas.

---

## 6. O que ainda falta para o módulo ficar completo

| # | Item | Fase original |
|---|---|---|
| a | **Ambientes** — CRUD próprio por obra (nome, ordem, ativo). Necessário para categorizar as fotos. | Fase 2 |
| b | **Upload de fotos** — endpoint `POST /diario/:id/fotos`, galeria por ambiente dentro do diário, exclusão, reordenação via drag-and-drop. | Fase 2 |
| c | **Visão "timeline por ambiente"** — o coração do módulo: ver a evolução de cada ambiente (sala, banheiro, etc.) ao longo do tempo, com fotos side-by-side por data. | Fase 5 |
| d | **Integrações automáticas** — auto-populate efetivo via `TimeEntry` (check-in do dia na obra), atividades via `ObraEtapa` (etapas em andamento), materiais via `RecebimentoMaterial` (entregas do dia). | Fase 3 |
| e | **Edição de cabeçalho inline** — o backend tem `PATCH /diario/:id` para clima, condição e observações, mas o frontend ainda não expõe formulário de edição. O cabeçalho é read-only após criação. | — |
