CREATE TABLE compras_splits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compras_meta_id UUID NOT NULL REFERENCES compras_metas(id) ON DELETE CASCADE,
  fornecedor      TEXT,
  faturamento     TEXT,
  valor           DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX compras_splits_meta_idx ON compras_splits(compras_meta_id);
