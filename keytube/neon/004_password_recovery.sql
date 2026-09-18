-- KeyTube: recuperación de cuenta por código enviado al correo.
-- No borra usuarios ni contenido existente.
BEGIN;

CREATE TABLE IF NOT EXISTS password_recovery_codes (
  flow_hash text PRIMARY KEY,
  user_id text NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  created_at bigint NOT NULL,
  expires_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS password_recovery_user_idx ON password_recovery_codes(user_id);
CREATE INDEX IF NOT EXISTS password_recovery_expiry_idx ON password_recovery_codes(expires_at);

COMMIT;
