-- Unificação ber-medicao → ber-app/medicao
-- Drop /medicao antigo (7 rascunhos vazios) + cria fluxo completo
-- de etapas → fornecedores → medições quinzenais → NFs → portal cliente.
-- 2026-06-22

-- ─── DROP /medicao antigo ─────────────────────────────────────────────────
-- Confirmado pelo Bruno: 7 medições rascunho, 0 itens, 0 lançamentos.
DROP TABLE IF EXISTS "medicao_lancamentos" CASCADE;
DROP TABLE IF EXISTS "medicao_itens" CASCADE;
DROP TABLE IF EXISTS "medicoes" CASCADE;

-- ─── Estende obras ────────────────────────────────────────────────────────
ALTER TABLE "obras"
  ADD COLUMN IF NOT EXISTS "prazo_pagamento_dias" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "retencao_percentual"  DECIMAL(5, 2) NOT NULL DEFAULT 0;

-- ─── Enums ────────────────────────────────────────────────────────────────
CREATE TYPE "EtapaFornecedorTipo" AS ENUM ('terceiro_ber_paga', 'terceiro_fatura_direto', 'miscelaneos_ber');
CREATE TYPE "MedicaoStatus" AS ENUM ('rascunho', 'enviada', 'aprovada', 'contestada', 'nf_emitida', 'paga');
CREATE TYPE "MedicaoFornecedorStatus" AS ENUM ('pendente', 'liberada', 'nf_recebida', 'paga', 'contestada_pelo_fornecedor');
CREATE TYPE "NfEmissorTipo" AS ENUM ('ber', 'fornecedor');
CREATE TYPE "NfStatus" AS ENUM ('emitida', 'paga', 'cancelada');

-- ─── Etapa ────────────────────────────────────────────────────────────────
CREATE TABLE "etapas" (
  "id"                      UUID PRIMARY KEY,
  "obra_id"                 UUID NOT NULL REFERENCES "obras"("id") ON DELETE CASCADE,
  "ordem"                   INTEGER NOT NULL,
  "nome"                    TEXT NOT NULL,
  "descricao"               TEXT,
  "contrato_valor"          DECIMAL(14, 2) NOT NULL,
  "fornecedores_completos"  BOOLEAN NOT NULL DEFAULT FALSE,
  "excel_linha"             INTEGER
);
CREATE INDEX "etapas_obra_id_idx" ON "etapas"("obra_id");

-- ─── Fornecedor ───────────────────────────────────────────────────────────
CREATE TABLE "fornecedores" (
  "id"            UUID PRIMARY KEY,
  "obra_id"       UUID NOT NULL REFERENCES "obras"("id") ON DELETE CASCADE,
  "razao_social"  TEXT NOT NULL,
  "cnpj"          TEXT NOT NULL,
  "contato"       TEXT
);
CREATE INDEX "fornecedores_obra_id_idx" ON "fornecedores"("obra_id");

-- ─── EtapaFornecedor ──────────────────────────────────────────────────────
CREATE TABLE "etapa_fornecedores" (
  "id"               UUID PRIMARY KEY,
  "etapa_id"         UUID NOT NULL REFERENCES "etapas"("id") ON DELETE CASCADE,
  "fornecedor_id"    UUID REFERENCES "fornecedores"("id") ON DELETE SET NULL,
  "escopo"           TEXT,
  "tipo"             "EtapaFornecedorTipo" NOT NULL,
  "valor_contratado" DECIMAL(14, 2) NOT NULL
);
CREATE INDEX "etapa_fornecedores_etapa_id_idx" ON "etapa_fornecedores"("etapa_id");
CREATE INDEX "etapa_fornecedores_fornecedor_id_idx" ON "etapa_fornecedores"("fornecedor_id");

-- ─── Medicao (novo) ───────────────────────────────────────────────────────
CREATE TABLE "medicoes" (
  "id"                       UUID PRIMARY KEY,
  "obra_id"                  UUID NOT NULL REFERENCES "obras"("id") ON DELETE CASCADE,
  "numero"                   INTEGER NOT NULL,
  "periodo_inicio"           DATE NOT NULL,
  "periodo_fim"              DATE NOT NULL,
  "status"                   "MedicaoStatus" NOT NULL DEFAULT 'rascunho',
  "token_publico"            UUID UNIQUE,
  "data_pagamento_prevista"  DATE,
  "data_pagamento_realizado" DATE,
  "created_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "medicoes_obra_numero_uniq" ON "medicoes"("obra_id", "numero");
CREATE INDEX "medicoes_obra_id_idx" ON "medicoes"("obra_id");

-- ─── MedicaoItem (novo) ───────────────────────────────────────────────────
CREATE TABLE "medicao_itens" (
  "id"                   UUID PRIMARY KEY,
  "medicao_id"           UUID NOT NULL REFERENCES "medicoes"("id") ON DELETE CASCADE,
  "etapa_fornecedor_id"  UUID NOT NULL REFERENCES "etapa_fornecedores"("id") ON DELETE RESTRICT,
  "valor_quinzena"       DECIMAL(14, 2) NOT NULL,
  "percentual_acumulado" DECIMAL(5, 2)  NOT NULL
);
CREATE INDEX "medicao_itens_medicao_id_idx" ON "medicao_itens"("medicao_id");
CREATE INDEX "medicao_itens_etapa_fornecedor_id_idx" ON "medicao_itens"("etapa_fornecedor_id");

-- ─── MedicaoEvidencia ─────────────────────────────────────────────────────
CREATE TABLE "medicao_evidencias" (
  "id"               UUID PRIMARY KEY,
  "medicao_id"       UUID NOT NULL REFERENCES "medicoes"("id") ON DELETE CASCADE,
  "etapa_id"         UUID NOT NULL REFERENCES "etapas"("id") ON DELETE CASCADE,
  "storage_key"      TEXT NOT NULL,
  "visivel_cliente"  BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "medicao_evidencias_medicao_id_idx" ON "medicao_evidencias"("medicao_id");

-- ─── MedicaoTransicao ─────────────────────────────────────────────────────
CREATE TABLE "medicao_transicoes" (
  "id"          UUID PRIMARY KEY,
  "medicao_id"  UUID NOT NULL REFERENCES "medicoes"("id") ON DELETE CASCADE,
  "user_id"     UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "de_status"   "MedicaoStatus",
  "para_status" "MedicaoStatus" NOT NULL,
  "comentario"  TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "medicao_transicoes_medicao_id_idx" ON "medicao_transicoes"("medicao_id");

-- ─── MedicaoFornecedor ────────────────────────────────────────────────────
CREATE TABLE "medicoes_fornecedor" (
  "id"             UUID PRIMARY KEY,
  "medicao_id"     UUID NOT NULL REFERENCES "medicoes"("id") ON DELETE CASCADE,
  "fornecedor_id"  UUID NOT NULL REFERENCES "fornecedores"("id") ON DELETE RESTRICT,
  "valor_quinzena" DECIMAL(14, 2) NOT NULL,
  "status"         "MedicaoFornecedorStatus" NOT NULL DEFAULT 'pendente',
  "liberada_em"    TIMESTAMP(3),
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "medicoes_fornecedor_medicao_id_idx" ON "medicoes_fornecedor"("medicao_id");
CREATE INDEX "medicoes_fornecedor_fornecedor_id_idx" ON "medicoes_fornecedor"("fornecedor_id");

-- ─── NotaFiscal ───────────────────────────────────────────────────────────
CREATE TABLE "notas_fiscais" (
  "id"                       UUID PRIMARY KEY,
  "medicao_id"               UUID REFERENCES "medicoes"("id") ON DELETE SET NULL,
  "medicao_fornecedor_id"    UUID REFERENCES "medicoes_fornecedor"("id") ON DELETE SET NULL,
  "emissor_tipo"             "NfEmissorTipo" NOT NULL,
  "emissor_id"               UUID,
  "numero"                   TEXT NOT NULL,
  "data_emissao"             DATE NOT NULL,
  "data_pagamento_prevista"  DATE NOT NULL,
  "valor"                    DECIMAL(14, 2) NOT NULL,
  "arquivo_key"              TEXT,
  "status"                   "NfStatus" NOT NULL DEFAULT 'emitida',
  "created_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "notas_fiscais_medicao_id_idx" ON "notas_fiscais"("medicao_id");
CREATE INDEX "notas_fiscais_medicao_fornecedor_id_idx" ON "notas_fiscais"("medicao_fornecedor_id");

-- ─── ChangeOrder ──────────────────────────────────────────────────────────
CREATE TABLE "change_orders" (
  "id"         UUID PRIMARY KEY,
  "obra_id"    UUID NOT NULL REFERENCES "obras"("id") ON DELETE CASCADE,
  "numero"     INTEGER NOT NULL,
  "titulo"     VARCHAR(200) NOT NULL DEFAULT 'Change Order',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "change_orders_obra_numero_uniq" ON "change_orders"("obra_id", "numero");
CREATE INDEX "change_orders_obra_id_idx" ON "change_orders"("obra_id");

-- ─── ChangeOrderItem ──────────────────────────────────────────────────────
CREATE TABLE "change_order_itens" (
  "id"              UUID PRIMARY KEY,
  "change_order_id" UUID NOT NULL REFERENCES "change_orders"("id") ON DELETE CASCADE,
  "tipo"            VARCHAR(10) NOT NULL,
  "descricao"       VARCHAR(500) NOT NULL DEFAULT '',
  "valor"           DECIMAL(14, 2) NOT NULL DEFAULT 0
);
CREATE INDEX "change_order_itens_change_order_id_idx" ON "change_order_itens"("change_order_id");

-- ─── ClienteAcesso ────────────────────────────────────────────────────────
CREATE TABLE "clientes_acesso" (
  "id"         UUID PRIMARY KEY,
  "obra_id"    UUID NOT NULL REFERENCES "obras"("id") ON DELETE CASCADE,
  "email"      TEXT NOT NULL,
  "nome"       TEXT NOT NULL,
  "token"      TEXT NOT NULL UNIQUE,
  "expira_em"  TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "clientes_acesso_obra_id_idx" ON "clientes_acesso"("obra_id");
CREATE INDEX "clientes_acesso_token_idx" ON "clientes_acesso"("token");
