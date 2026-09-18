import { db } from "./keytube-server";
import { getAppUser } from "./auth";

let schemaPromise: Promise<void> | null = null;

export async function ensureV10Schema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const statements = [
        "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover text NOT NULL DEFAULT ''",
        "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS website text NOT NULL DEFAULT ''",
        "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instagram text NOT NULL DEFAULT ''",
        "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS youtube text NOT NULL DEFAULT ''",
        "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verified integer NOT NULL DEFAULT 0",
        "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user'",
        "ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id text",
        "CREATE INDEX IF NOT EXISTS comments_parent_idx ON comments(parent_id)",
        `CREATE TABLE IF NOT EXISTS post_likes (
          id text PRIMARY KEY, owner_id text NOT NULL, post_id text NOT NULL, created_at bigint NOT NULL
        )`,
        "CREATE UNIQUE INDEX IF NOT EXISTS post_likes_owner_post_idx ON post_likes(owner_id,post_id)",
        "CREATE INDEX IF NOT EXISTS post_likes_post_idx ON post_likes(post_id)",
        `CREATE TABLE IF NOT EXISTS notifications (
          id text PRIMARY KEY, owner_id text NOT NULL, actor_id text, type text NOT NULL,
          target_id text, message text NOT NULL, read_at bigint, created_at bigint NOT NULL
        )`,
        "CREATE INDEX IF NOT EXISTS notifications_owner_created_idx ON notifications(owner_id,created_at DESC)",
        "CREATE INDEX IF NOT EXISTS notifications_owner_read_idx ON notifications(owner_id,read_at)",
        `CREATE TABLE IF NOT EXISTS view_history (
          id text PRIMARY KEY, owner_id text NOT NULL, post_id text NOT NULL,
          progress integer NOT NULL DEFAULT 0, position_seconds integer NOT NULL DEFAULT 0, updated_at bigint NOT NULL
        )`,
        "CREATE UNIQUE INDEX IF NOT EXISTS view_history_owner_post_idx ON view_history(owner_id,post_id)",
        "CREATE INDEX IF NOT EXISTS view_history_owner_updated_idx ON view_history(owner_id,updated_at DESC)",
        `CREATE TABLE IF NOT EXISTS collections (
          id text PRIMARY KEY, owner_id text NOT NULL, name text NOT NULL, created_at bigint NOT NULL, updated_at bigint NOT NULL
        )`,
        "CREATE UNIQUE INDEX IF NOT EXISTS collections_owner_name_idx ON collections(owner_id,name)",
        `CREATE TABLE IF NOT EXISTS collection_posts (
          id text PRIMARY KEY, collection_id text NOT NULL, post_id text NOT NULL, created_at bigint NOT NULL
        )`,
        "CREATE UNIQUE INDEX IF NOT EXISTS collection_posts_collection_post_idx ON collection_posts(collection_id,post_id)",
        "CREATE INDEX IF NOT EXISTS collection_posts_post_idx ON collection_posts(post_id)",
        `CREATE TABLE IF NOT EXISTS reports (
          id text PRIMARY KEY, reporter_id text NOT NULL, target_type text NOT NULL, target_id text NOT NULL,
          reason text NOT NULL, details text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'open',
          created_at bigint NOT NULL, resolved_at bigint
        )`,
        "CREATE INDEX IF NOT EXISTS reports_status_created_idx ON reports(status,created_at DESC)",
        "CREATE INDEX IF NOT EXISTS reports_target_idx ON reports(target_type,target_id)",
        `CREATE TABLE IF NOT EXISTS blocks (
          id text PRIMARY KEY, owner_id text NOT NULL, blocked_user_id text NOT NULL, created_at bigint NOT NULL
        )`,
        "CREATE UNIQUE INDEX IF NOT EXISTS blocks_owner_user_idx ON blocks(owner_id,blocked_user_id)",
        `CREATE TABLE IF NOT EXISTS access_history (
          id text PRIMARY KEY, owner_id text NOT NULL, creator_id text NOT NULL, post_id text NOT NULL,
          lock_address text NOT NULL, network integer NOT NULL, verified_at bigint NOT NULL
        )`,
        "CREATE INDEX IF NOT EXISTS access_history_owner_idx ON access_history(owner_id,verified_at DESC)",
        "CREATE INDEX IF NOT EXISTS access_history_creator_idx ON access_history(creator_id,verified_at DESC)",
      ];
      for (const sql of statements) await db().prepare(sql).run();
    })();
  }
  try {
    await schemaPromise;
  } catch (error) {
    schemaPromise = null;
    throw error;
  }
}

export async function displayName(userId: string) {
  const profile = await db().prepare("SELECT name FROM profiles WHERE owner_id=?").bind(userId).first<{name:string}>();
  if (profile?.name) return profile.name;
  const user = await db().prepare("SELECT name FROM users WHERE id=?").bind(userId).first<{name:string}>();
  return user?.name || "Miembro";
}

export async function notify(input: {
  ownerId: string;
  actorId?: string | null;
  type: string;
  targetId?: string | null;
  message: string;
}) {
  if (!input.ownerId || input.ownerId === input.actorId) return;
  await ensureV10Schema();
  await db()
    .prepare("INSERT INTO notifications (id,owner_id,actor_id,type,target_id,message,read_at,created_at) VALUES (?,?,?,?,?,?,NULL,?)")
    .bind(crypto.randomUUID(), input.ownerId, input.actorId || null, input.type, input.targetId || null, input.message, Date.now())
    .run();
}

export async function requireAdmin() {
  const user = await getAppUser();
  if (!user) throw new Error("AUTH_REQUIRED");
  await ensureV10Schema();
  const emails = (process.env.ADMIN_EMAILS || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
  const profile = await db().prepare("SELECT role FROM profiles WHERE owner_id=?").bind(user.userId).first<{role:string}>();
  const allowed = profile?.role === "admin" || emails.includes(user.email.toLowerCase());
  if (!allowed) throw new Error("ADMIN_REQUIRED");
  return user;
}
