# BÈR App — Brief: Módulo de Pontos de Contato com o Cliente

> Solicitado por: Bruno Di Benedetto
> Elaborado por: Clara Martins
> Data: 27/03/2026

---

## Contexto

O Bruno quer que o app reflita o processo do **Blue Paper / Brown Paper** da BÈR Engenharia — um fluxo operacional de 51 documentos que vai do Kick-Off até o encerramento da obra.

O foco desta fase é: **mapear todos os pontos de contato com o cliente e mitigar erros de processo** através de checklists, controles e antecipação de pendências.

O arquivo do Blue Paper está em: `/Users/assistentebruno/.openclaw/media/inbound/BLUEPAPER_BER_2026---90480561-c73d-486a-acc0-db651ec2757f.pdf`

---

## O que aproveitar do que já existe

- ✅ Módulo `checklists` — base perfeita, só criar templates do Blue Paper
- ✅ Módulo `obras` — adicionar campo `fase`
- ✅ Módulo `meetings` — estender para touchpoints com cliente
- ✅ Módulo `announcements` — base para Comunicado Semanal
- ✅ Módulo `notifications` — já existe, apontar para pendências

---

## 5 alterações necessárias

### 1. Fases da Obra (no módulo `obras`)

Adicionar campo `fase` com progressão obrigatória:

```
kickoff_interno → kickoff_externo → suprimentos → pre_obra → execucao → pendencias → encerramento
```

**Regras:**
- Não pode avançar de fase se houver checklists obrigatórios incompletos
- Cada transição de fase registra data/hora e usuário
- Nova tabela `obra_fase_history` para rastrear o histórico

**Schema adicional:**
```sql
ALTER TABLE obras ADD COLUMN fase VARCHAR(50) DEFAULT 'kickoff_interno';
ALTER TABLE obras ADD COLUMN fase_updated_at TIMESTAMP;
ALTER TABLE obras ADD COLUMN fase_updated_by UUID REFERENCES users(id);

CREATE TABLE obra_fase_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    obra_id UUID REFERENCES obras(id) ON DELETE CASCADE,
    fase_anterior VARCHAR(50),
    fase_nova VARCHAR(50) NOT NULL,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMP DEFAULT NOW(),
    notes TEXT
);
```

---

### 2. Templates do Blue Paper (no módulo `checklists`)

Criar seed com os 51 documentos do Blue Paper como templates de checklist, agrupados por fase:

| Fase | Docs | Exemplos |
|------|------|---------|
| kickoff_interno | 1–9 | Proposta Técnica, Ficha DNN, Termo de Aceite, ART |
| kickoff_externo + suprimentos | 10–20 | Cronograma, Ata KO Externo, Pacotes de Compras 1–4 |
| pre_obra | 21–27 | Plano de Ataque, Vistoria, Cronograma de Metas |
| execucao | 28–40 | Check Safety, FVS, Ata Semanal Interna/Externa, Comunicado |
| pendencias | 41–43 | Checklist Antecipação, Termo Provisório, Controle Pendências |
| encerramento | 44–51 | As-Builts, Laudos, Pasta de Obra, Termo Definitivo |

Cada template tem:
- `required: true/false` — se bloqueia avanço de fase
- `responsible_role` — qual função é responsável (gestor, comprador, analista_projetos, mst, tst)
- `fase` — a qual fase pertence

**Ação:** Criar arquivo `backend/src/seeds/bluepaper-checklists.ts` com todos os 51 itens.

---

### 3. Touchpoints com Cliente (estender módulo `meetings`)

Adicionar tabela `client_touchpoints` vinculada à obra:

```sql
CREATE TABLE client_touchpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    obra_id UUID REFERENCES obras(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,  
    -- kickoff_externo | reuniao_semanal | comunicado_semanal | extra_aditivo | aceite_provisorio | aceite_definitivo | visita_informal
    title VARCHAR(255) NOT NULL,
    occurred_at TIMESTAMP NOT NULL,
    conducted_by UUID REFERENCES users(id),    -- quem conduziu da BÈR
    client_contacts TEXT[],                    -- nomes/emails dos participantes do cliente
    architect_contacts TEXT[],                 -- arquiteto / gerenciadora
    summary TEXT,                              -- resumo do que foi discutido
    next_action TEXT,                          -- próxima ação definida
    next_action_due DATE,                      -- prazo da próxima ação
    next_action_owner UUID REFERENCES users(id),
    attachments TEXT[],                        -- links de atas, documentos
    status VARCHAR(20) DEFAULT 'realizado',    -- realizado | pendente_ata | ata_enviada
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_touchpoints_obra ON client_touchpoints(obra_id, occurred_at DESC);
CREATE INDEX idx_touchpoints_next_action ON client_touchpoints(next_action_due) WHERE next_action_due IS NOT NULL;
```

**Endpoints necessários:**
- `GET /obras/:id/touchpoints` — lista por obra
- `POST /obras/:id/touchpoints` — registrar novo
- `PUT /touchpoints/:id` — atualizar (incluindo status ata)
- `GET /touchpoints/pending-actions` — próximas ações vencendo (para o radar)

---

### 4. Comunicado Semanal (estender módulo `announcements`)

Adicionar tipo `comunicado_semanal` com estrutura template:

```sql
ALTER TABLE announcements ADD COLUMN tipo VARCHAR(30) DEFAULT 'interno';
-- tipos: interno | comunicado_semanal | extra_aditivo

ALTER TABLE announcements ADD COLUMN obra_id UUID REFERENCES obras(id);
ALTER TABLE announcements ADD COLUMN semana_referencia DATE; -- domingo da semana
ALTER TABLE announcements ADD COLUMN template_data JSONB DEFAULT '{}';
-- Estrutura do template_data:
-- {
--   "andamento_semana": "...",
--   "pendencias_resolvidas": [...],
--   "pendencias_abertas": [...],
--   "previsto_proxima_semana": "...",
--   "pontos_atencao": [...],
--   "percentual_execucao": 0,
--   "fotos_destaque": [...]
-- }
ALTER TABLE announcements ADD COLUMN enviado_cliente BOOLEAN DEFAULT false;
ALTER TABLE announcements ADD COLUMN enviado_em TIMESTAMP;
```

**Endpoint novo:**
- `POST /obras/:id/comunicado-semanal/gerar` — gera rascunho auto-populado com tarefas concluídas + touchpoints da semana
- `POST /comunicados/:id/enviar` — marca como enviado (frontend gera PDF/envia por email)

---

### 5. Dashboard Radar (novo endpoint + tela web)

**Endpoint:**
```
GET /dashboard/radar
```

Retorna para cada obra ativa:
- Fase atual
- % checklist completo por fase
- Touchpoints: último realizado + próximo previsto
- Itens vencidos (checklist required + next_actions)
- Próximos 7 dias: o que vence

**Tela web (`/dashboard`):**
Cards por obra com semáforo:
- 🟢 Verde: tudo em dia
- 🟡 Amarelo: algo vence em 3 dias
- 🔴 Vermelho: item vencido ou ata pendente

---

## Prioridade de execução sugerida

| # | Entrega | Estimativa |
|---|---------|-----------|
| 1 | Fases da obra + seed Blue Paper | 3 dias |
| 2 | Touchpoints com cliente (backend + mobile) | 4 dias |
| 3 | Comunicado Semanal (rascunho + envio) | 3 dias |
| 4 | Dashboard Radar (web) | 3 dias |
| **Total MVP** | | **~2 semanas** |

---

## Notas finais

- Não precisa integrar com ClickUp — app independente
- Usuários: apenas internos (~25 pessoas, 4–6 gestores de obras no campo)
- Mobile é prioridade para gestores (campo): input rápido, sem formulários longos
- Web é prioridade para diretoria (Bruno): visão consolidada, radar de obras
- Dúvidas: perguntar para Clara (main) ou Bruno diretamente
