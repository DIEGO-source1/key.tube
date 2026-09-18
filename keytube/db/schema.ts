import {
  pgTable,
  text,
  integer,
  bigint,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const epochMs = (name: string) => bigint(name, { mode: "number" });

export const posts = pgTable(
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
    createdAt: epochMs("created_at").notNull(),
    type: text("type").notNull().default("text"),
    category: text("category").notNull().default("Educación"),
    thumbnailId: text("thumbnail_id"),
    previewId: text("preview_id"),
    assetId: text("asset_id"),
    updatedAt: epochMs("updated_at").notNull().default(0),
    visibility: text("visibility").notNull().default("members"),
    planId: text("plan_id"),
    premiumLock: text("premium_lock"),
    views: integer("views").notNull().default(0),
  },
  (t) => [
    index("posts_owner_idx").on(t.ownerId),
    index("posts_created_idx").on(t.createdAt),
    index("posts_views_idx").on(t.views),
  ],
);

export const challenges = pgTable(
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
    createdAt: epochMs("created_at").notNull(),
    expiresAt: epochMs("expires_at").notNull(),
    consumedAt: epochMs("consumed_at"),
  },
  (t) => [index("challenge_requester_created_idx").on(t.requester, t.createdAt)],
);

export const assets = pgTable(
  "assets",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    storageKey: text("storage_key").notNull(),
    role: text("role").notNull(),
    name: text("name").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    createdAt: epochMs("created_at").notNull(),
  },
  (t) => [index("assets_owner_idx").on(t.ownerId)],
);

export const mediaGrants = pgTable(
  "media_grants",
  {
    tokenHash: text("token_hash").primaryKey(),
    postId: text("post_id").notNull(),
    wallet: text("wallet").notNull(),
    expiresAt: epochMs("expires_at").notNull(),
  },
  (t) => [index("media_grants_expiry_idx").on(t.expiresAt)],
);

export const profiles = pgTable("profiles", {
  ownerId: text("owner_id").primaryKey(),
  name: text("name").notNull(),
  bio: text("bio").notNull().default(""),
  avatar: text("avatar").notNull().default("valeria"),
  cover: text("cover").notNull().default(""),
  website: text("website").notNull().default(""),
  instagram: text("instagram").notNull().default(""),
  youtube: text("youtube").notNull().default(""),
  verified: integer("verified").notNull().default(0),
  role: text("role").notNull().default("user"),
  wallet: text("wallet").notNull().default(""),
  updatedAt: epochMs("updated_at").notNull(),
});

export const savedPosts = pgTable(
  "saved_posts",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    postId: text("post_id").notNull(),
    createdAt: epochMs("created_at").notNull(),
  },
  (t) => [uniqueIndex("saved_posts_owner_post_idx").on(t.ownerId, t.postId)],
);

export const follows = pgTable(
  "follows",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    creatorId: text("creator_id").notNull(),
    createdAt: epochMs("created_at").notNull(),
  },
  (t) => [uniqueIndex("follows_owner_creator_idx").on(t.ownerId, t.creatorId)],
);

export const comments = pgTable(
  "comments",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    postId: text("post_id").notNull(),
    name: text("name").notNull(),
    body: text("body").notNull(),
    parentId: text("parent_id"),
    createdAt: epochMs("created_at").notNull(),
  },
  (t) => [index("comments_post_created_idx").on(t.postId, t.createdAt)],
);

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash"),
    googleSub: text("google_sub"),
    createdAt: epochMs("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("users_email_idx").on(t.email),
    uniqueIndex("users_google_idx").on(t.googleSub),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id").notNull(),
    expiresAt: epochMs("expires_at").notNull(),
  },
  (t) => [
    index("sessions_user_idx").on(t.userId),
    index("sessions_expiry_idx").on(t.expiresAt),
  ],
);

export const authLimits = pgTable("auth_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: epochMs("expires_at").notNull(),
});

export const oauthStates = pgTable("oauth_states", {
  userId: text("user_id"),
  stateHash: text("state_hash").primaryKey(),
  verifier: text("verifier").notNull(),
  nonce: text("nonce").notNull(),
  expiresAt: epochMs("expires_at").notNull(),
});

export const passwordRecoveryCodes = pgTable(
  "password_recovery_codes",
  {
    flowHash: text("flow_hash").primaryKey(),
    userId: text("user_id").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    createdAt: epochMs("created_at").notNull(),
    expiresAt: epochMs("expires_at").notNull(),
  },
  (t) => [
    index("password_recovery_user_idx").on(t.userId),
    index("password_recovery_expiry_idx").on(t.expiresAt),
  ],
);

export const creatorPlans = pgTable(
  "creator_plans",
  {
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
    updatedAt: epochMs("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("plans_owner_slot_idx").on(t.ownerId, t.slot),
    uniqueIndex("plans_lock_network_idx").on(t.lock, t.network),
  ],
);


export const postLikes = pgTable(
  "post_likes",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    postId: text("post_id").notNull(),
    createdAt: epochMs("created_at").notNull(),
  },
  (t) => [uniqueIndex("post_likes_owner_post_idx").on(t.ownerId, t.postId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    actorId: text("actor_id"),
    type: text("type").notNull(),
    targetId: text("target_id"),
    message: text("message").notNull(),
    readAt: epochMs("read_at"),
    createdAt: epochMs("created_at").notNull(),
  },
  (t) => [index("notifications_owner_created_idx").on(t.ownerId, t.createdAt)],
);

export const viewHistory = pgTable(
  "view_history",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    postId: text("post_id").notNull(),
    progress: integer("progress").notNull().default(0),
    positionSeconds: integer("position_seconds").notNull().default(0),
    updatedAt: epochMs("updated_at").notNull(),
  },
  (t) => [uniqueIndex("view_history_owner_post_idx").on(t.ownerId, t.postId)],
);

export const collections = pgTable(
  "collections",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    createdAt: epochMs("created_at").notNull(),
    updatedAt: epochMs("updated_at").notNull(),
  },
  (t) => [uniqueIndex("collections_owner_name_idx").on(t.ownerId, t.name)],
);

export const collectionPosts = pgTable(
  "collection_posts",
  {
    id: text("id").primaryKey(),
    collectionId: text("collection_id").notNull(),
    postId: text("post_id").notNull(),
    createdAt: epochMs("created_at").notNull(),
  },
  (t) => [uniqueIndex("collection_posts_collection_post_idx").on(t.collectionId, t.postId)],
);

export const reports = pgTable(
  "reports",
  {
    id: text("id").primaryKey(),
    reporterId: text("reporter_id").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason").notNull(),
    details: text("details").notNull().default(""),
    status: text("status").notNull().default("open"),
    createdAt: epochMs("created_at").notNull(),
    resolvedAt: epochMs("resolved_at"),
  },
  (t) => [index("reports_status_created_idx").on(t.status, t.createdAt)],
);

export const blocks = pgTable(
  "blocks",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    blockedUserId: text("blocked_user_id").notNull(),
    createdAt: epochMs("created_at").notNull(),
  },
  (t) => [uniqueIndex("blocks_owner_user_idx").on(t.ownerId, t.blockedUserId)],
);

export const accessHistory = pgTable(
  "access_history",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    creatorId: text("creator_id").notNull(),
    postId: text("post_id").notNull(),
    lockAddress: text("lock_address").notNull(),
    network: integer("network").notNull(),
    verifiedAt: epochMs("verified_at").notNull(),
  },
  (t) => [index("access_history_owner_idx").on(t.ownerId, t.verifiedAt)],
);
