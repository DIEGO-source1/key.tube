-- KeyTube v18: reacciones reales para el feed social.
-- No borra usuarios ni publicaciones existentes.
BEGIN;

CREATE TABLE IF NOT EXISTS post_likes (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  post_id text NOT NULL,
  created_at bigint NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS post_likes_owner_post_idx ON post_likes(owner_id, post_id);
CREATE INDEX IF NOT EXISTS post_likes_post_idx ON post_likes(post_id);

COMMIT;
