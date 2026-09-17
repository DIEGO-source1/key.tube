import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const posts = sqliteTable(
  "posts",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    wallet: text("wallet").notNull(),
    creator: text("creator").notNull(),
    title: text("title").notNull(),
    intro: text("intro").notNull(),
    body: text("body").notNull(),
    lock: text("lock").notNull(),
    network: integer("network").notNull(),
    createdAt: integer("created_at").notNull(),
    type: text("type").notNull().default("text"),
    category: text("category").notNull().default("Educación"),
    thumbnailId: text("thumbnail_id"),
    previewId: text("preview_id"),
    assetId: text("asset_id"),
    updatedAt: integer("updated_at").notNull().default(0),
    visibility: text("visibility").notNull().default("members"),
    planId: text("plan_id"),
    premiumLock: text("premium_lock"),
    status: text("status").notNull().default("published"),
  },
  (t) => [
    index("posts_owner_idx").on(t.ownerId),
    index("posts_created_idx").on(t.createdAt),
  ],
);
export const challenges = sqliteTable(
  "challenges",
  {
    id: text("id").primaryKey(),
    requester: text("requester").notNull(),
    userId: text("user_id").notNull(),
    wallet: text("wallet").notNull(),
    network: integer("network").notNull(),
    purpose: text("purpose").notNull(),
    target: text("target").notNull(),
    message: text("message").notNull(),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    consumedAt: integer("consumed_at"),
  },
  (t) => [
    index("challenge_requester_created_idx").on(t.requester, t.createdAt),
  ],
);
export const assets = sqliteTable(
  "assets",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    storageKey: text("storage_key").notNull(),
    role: text("role").notNull(),
    name: text("name").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("assets_owner_idx").on(t.ownerId)],
);
export const uploadSessions = sqliteTable('upload_sessions', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  storageKey: text('storage_key').notNull(),
  uploadId: text('upload_id').notNull(),
  name: text('name').notNull(),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
  state: text('state').notNull().default('uploading'),
  expiresAt: integer('expires_at').notNull(),
}, t => [index('uploads_owner_expiry_idx').on(t.ownerId,t.expiresAt)]);
export const uploadParts = sqliteTable('upload_parts', {
  sessionId: text('session_id').notNull(),
  partNumber: integer('part_number').notNull(),
  etag: text('etag').notNull(),
  size: integer('size').notNull(),
}, t => [uniqueIndex('upload_parts_session_number_idx').on(t.sessionId,t.partNumber)]);
export const mediaGrants = sqliteTable(
  "media_grants",
  {
    tokenHash: text("token_hash").primaryKey(),
    postId: text("post_id").notNull(),
    wallet: text("wallet").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [index("media_grants_expiry_idx").on(t.expiresAt)],
);
export const profiles = sqliteTable("profiles", {
  ownerId: text("owner_id").primaryKey(),
  name: text("name").notNull(),
  bio: text("bio").notNull().default(""),
  avatar: text("avatar").notNull().default(""),
  updatedAt: integer("updated_at").notNull(),
});
export const savedPosts = sqliteTable(
  "saved_posts",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    postId: text("post_id").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("saved_posts_owner_post_idx").on(t.ownerId, t.postId)],
);
export const follows = sqliteTable(
  "follows",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    creatorId: text("creator_id").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("follows_owner_creator_idx").on(t.ownerId, t.creatorId)],
);
export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    postId: text("post_id").notNull(),
    name: text("name").notNull(),
    body: text("body").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("comments_post_created_idx").on(t.postId, t.createdAt)],
);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  googleSub: text("google_sub"),
  createdAt: integer("created_at").notNull(),
}, t => [uniqueIndex("users_email_idx").on(t.email), uniqueIndex("users_google_idx").on(t.googleSub)]);
export const sessions = sqliteTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, t => [index("sessions_user_idx").on(t.userId), index("sessions_expiry_idx").on(t.expiresAt)]);
export const authLimits = sqliteTable("auth_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
export const oauthStates = sqliteTable("oauth_states", {
  userId: text("user_id"),
  stateHash: text("state_hash").primaryKey(),
  verifier: text("verifier").notNull(),
  nonce: text("nonce").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
export const creatorPlans = sqliteTable("creator_plans", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  slot: text("slot").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  benefits: text("benefits").notNull().default("[]"),
  coverage: text("coverage").notNull().default("[]"),
  price: text("price").notNull(),
  durationDays: integer("duration_days").notNull().default(30),
  network: integer("network").notNull(),
  lock: text("lock").notNull(),
  wallet: text("wallet").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, t => [uniqueIndex("plans_owner_slot_idx").on(t.ownerId,t.slot), uniqueIndex("plans_lock_network_idx").on(t.lock,t.network)]);
