-- Diário de Obra v2 — campos adicionais

-- DiarioEfetivo: categoria + quantidade (novo modelo)
ALTER TABLE diario_efetivos ADD COLUMN IF NOT EXISTS categoria VARCHAR(50);
ALTER TABLE diario_efetivos ADD COLUMN IF NOT EXISTS quantidade INTEGER NOT NULL DEFAULT 1;

-- DiarioObra: avanço físico do dia + token público para camada cliente
ALTER TABLE diario_obras ADD COLUMN IF NOT EXISTS avanco_dia DECIMAL(5,2);
ALTER TABLE diario_obras ADD COLUMN IF NOT EXISTS token_publico VARCHAR(36);
CREATE UNIQUE INDEX IF NOT EXISTS diario_obras_token_publico_key ON diario_obras (token_publico);

-- DiarioMaterial: quantidade e unidade
ALTER TABLE diario_materiais ADD COLUMN IF NOT EXISTS quantidade DECIMAL(10,2);
ALTER TABLE diario_materiais ADD COLUMN IF NOT EXISTS unidade VARCHAR(20);

-- Obra: whatsapp do cliente para envio automático no fechamento
ALTER TABLE obras ADD COLUMN IF NOT EXISTS whatsapp_cliente VARCHAR(20);
