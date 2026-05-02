-- CreateTable api_keys
CREATE TABLE "api_keys" (
  "id"             UUID          NOT NULL DEFAULT gen_random_uuid(),
  "name"           VARCHAR(100)  NOT NULL,
  "key_hash"       VARCHAR(64)   NOT NULL,
  "key_prefix"     VARCHAR(8)    NOT NULL,
  "created_by_id"  UUID          NOT NULL,
  "last_used_at"   TIMESTAMP(3),
  "active"         BOOLEAN       NOT NULL DEFAULT true,
  "created_at"     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

ALTER TABLE "api_keys"
  ADD CONSTRAINT "api_keys_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
