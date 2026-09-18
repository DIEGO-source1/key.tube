-- KeyTube V10: engagement, recomendaciones, historial, colecciones,
-- moderación, perfiles profesionales y estadísticas.
-- No borra cuentas ni contenido existente.
BEGIN;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover text NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS website text NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instagram text NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS youtube text NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verified integer NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';

ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id text;
CREATE INDEX IF NOT EXISTS comments_parent_idx ON comments(parent_id);

CREATE TABLE IF NOT EXISTS post_likes (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  post_id text NOT NULL,
  created_at bigint NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS post_likes_owner_post_idx ON post_likes(owner_id, post_id);
CREATE INDEX IF NOT EXISTS post_likes_post_idx ON post_likes(post_id);

CREATE TABLE IF NOT EXISTS notifications (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  actor_id text,
  type text NOT NULL,
  target_id text,
  message text NOT NULL,
  read_at bigint,
  created_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS notifications_owner_created_idx ON notifications(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_owner_read_idx ON notifications(owner_id, read_at);

CREATE TABLE IF NOT EXISTS view_history (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  post_id text NOT NULL,
  progress integer NOT NULL DEFAULT 0,
  position_seconds integer NOT NULL DEFAULT 0,
  updated_at bigint NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS view_history_owner_post_idx ON view_history(owner_id, post_id);
CREATE INDEX IF NOT EXISTS view_history_owner_updated_idx ON view_history(owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS collections (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  name text NOT NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS collections_owner_name_idx ON collections(owner_id, name);

CREATE TABLE IF NOT EXISTS collection_posts (
  id text PRIMARY KEY,
  collection_id text NOT NULL,
  post_id text NOT NULL,
  created_at bigint NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS collection_posts_collection_post_idx ON collection_posts(collection_id, post_id);
CREATE INDEX IF NOT EXISTS collection_posts_post_idx ON collection_posts(post_id);

CREATE TABLE IF NOT EXISTS reports (
  id text PRIMARY KEY,
  reporter_id text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  reason text NOT NULL,
  details text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  created_at bigint NOT NULL,
  resolved_at bigint
);
CREATE INDEX IF NOT EXISTS reports_status_created_idx ON reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_target_idx ON reports(target_type, target_id);

CREATE TABLE IF NOT EXISTS blocks (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  blocked_user_id text NOT NULL,
  created_at bigint NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS blocks_owner_user_idx ON blocks(owner_id, blocked_user_id);

CREATE TABLE IF NOT EXISTS access_history (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  creator_id text NOT NULL,
  post_id text NOT NULL,
  lock_address text NOT NULL,
  network integer NOT NULL,
  verified_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS access_history_owner_idx ON access_history(owner_id, verified_at DESC);
CREATE INDEX IF NOT EXISTS access_history_creator_idx ON access_history(creator_id, verified_at DESC);

COMMIT;
