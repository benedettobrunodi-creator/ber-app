CREATE TABLE IF NOT EXISTS "org_charts" (
  "id"              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  "key"             TEXT    UNIQUE NOT NULL DEFAULT 'main',
  "data"            JSONB   NOT NULL DEFAULT '[]',
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_by_id"   UUID    REFERENCES "users"("id") ON DELETE SET NULL
);
