-- KeyTube v5: nuevas funciones para una base Neon ya existente.
-- Este script NO borra cuentas ni contenido.
BEGIN;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS wallet text NOT NULL DEFAULT '';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS views integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS posts_views_idx ON posts(views);

COMMIT;
