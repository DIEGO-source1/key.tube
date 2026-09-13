BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text NOT NULL,
  name text NOT NULL,
  password_hash text,
  google_sub text,
  created_at bigint NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS users_google_idx ON users(google_sub);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL,
  expires_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS auth_limits (
  key text PRIMARY KEY,
  count integer NOT NULL,
  expires_at bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_states (
  user_id text,
  state_hash text PRIMARY KEY,
  verifier text NOT NULL,
  nonce text NOT NULL,
  expires_at bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  owner_id text PRIMARY KEY,
  name text NOT NULL,
  bio text NOT NULL DEFAULT '',
  avatar text NOT NULL DEFAULT 'valeria',
  wallet text NOT NULL DEFAULT '',
  updated_at bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS creator_plans (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  slot text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  benefits text NOT NULL DEFAULT '[]',
  coverage text NOT NULL DEFAULT '[]',
  price text NOT NULL,
  duration_days integer NOT NULL DEFAULT 30,
  network integer NOT NULL,
  lock text NOT NULL,
  wallet text NOT NULL,
  updated_at bigint NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS plans_owner_slot_idx ON creator_plans(owner_id, slot);
CREATE UNIQUE INDEX IF NOT EXISTS plans_lock_network_idx ON creator_plans(lock, network);

CREATE TABLE IF NOT EXISTS posts (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  wallet text NOT NULL,
  creator text NOT NULL,
  title text NOT NULL,
  intro text NOT NULL,
  body text NOT NULL,
  lock text NOT NULL,
  network integer NOT NULL,
  created_at bigint NOT NULL,
  type text NOT NULL DEFAULT 'text',
  category text NOT NULL DEFAULT 'Educación',
  thumbnail_id text,
  preview_id text,
  asset_id text,
  updated_at bigint NOT NULL DEFAULT 0,
  visibility text NOT NULL DEFAULT 'members',
  plan_id text,
  premium_lock text,
  views integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS posts_owner_idx ON posts(owner_id);
CREATE INDEX IF NOT EXISTS posts_created_idx ON posts(created_at);
CREATE INDEX IF NOT EXISTS posts_views_idx ON posts(views);

CREATE TABLE IF NOT EXISTS challenges (
  id text PRIMARY KEY,
  requester text NOT NULL,
  user_id text NOT NULL,
  wallet text NOT NULL,
  network integer NOT NULL,
  purpose text NOT NULL,
  target text NOT NULL,
  message text NOT NULL,
  created_at bigint NOT NULL,
  expires_at bigint NOT NULL,
  consumed_at bigint
);
CREATE INDEX IF NOT EXISTS challenge_requester_created_idx ON challenges(requester, created_at);

CREATE TABLE IF NOT EXISTS assets (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  storage_key text NOT NULL,
  role text NOT NULL,
  name text NOT NULL,
  mime text NOT NULL,
  size integer NOT NULL,
  created_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS assets_owner_idx ON assets(owner_id);

-- Adelantos, portadas y avatares pequeños pueden almacenarse en Neon BYTEA.
-- Los archivos completos grandes (hasta 500 MB) usan Vercel Blob privado.
CREATE TABLE IF NOT EXISTS media_objects (
  storage_key text PRIMARY KEY,
  data bytea NOT NULL,
  content_type text NOT NULL DEFAULT 'application/octet-stream',
  size integer NOT NULL,
  updated_at bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS media_grants (
  token_hash text PRIMARY KEY,
  post_id text NOT NULL,
  wallet text NOT NULL,
  expires_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS media_grants_expiry_idx ON media_grants(expires_at);

CREATE TABLE IF NOT EXISTS saved_posts (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  post_id text NOT NULL,
  created_at bigint NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS saved_posts_owner_post_idx ON saved_posts(owner_id, post_id);

CREATE TABLE IF NOT EXISTS follows (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  creator_id text NOT NULL,
  created_at bigint NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS follows_owner_creator_idx ON follows(owner_id, creator_id);

CREATE TABLE IF NOT EXISTS comments (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  post_id text NOT NULL,
  name text NOT NULL,
  body text NOT NULL,
  created_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS comments_post_created_idx ON comments(post_id, created_at);

COMMIT;
