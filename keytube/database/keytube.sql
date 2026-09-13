-- KeyTube: empty SQLite schema. Import once into a new database.
-- Full files live in private R2 storage; this database holds their metadata.
PRAGMA foreign_keys=ON;
BEGIN TRANSACTION;
CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`storage_key` text NOT NULL,
	`role` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` integer NOT NULL
);

CREATE TABLE `auth_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);

CREATE TABLE `challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`requester` text NOT NULL,
	`user_id` text NOT NULL,
	`wallet` text NOT NULL,
	`network` integer NOT NULL,
	`purpose` text NOT NULL,
	`target` text NOT NULL,
	`message` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer
);

CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`post_id` text NOT NULL,
	`name` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL
);

CREATE TABLE `creator_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`slot` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`benefits` text DEFAULT '[]' NOT NULL,
	`coverage` text DEFAULT '[]' NOT NULL,
	`price` text NOT NULL,
	`duration_days` integer DEFAULT 30 NOT NULL,
	`network` integer NOT NULL,
	`lock` text NOT NULL,
	`wallet` text NOT NULL,
	`updated_at` integer NOT NULL
);

CREATE TABLE `follows` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`creator_id` text NOT NULL,
	`created_at` integer NOT NULL
);

CREATE TABLE `media_grants` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`wallet` text NOT NULL,
	`expires_at` integer NOT NULL
);

CREATE TABLE `oauth_states` (
	`user_id` text,
	`state_hash` text PRIMARY KEY NOT NULL,
	`verifier` text NOT NULL,
	`nonce` text NOT NULL,
	`expires_at` integer NOT NULL
);

CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`wallet` text NOT NULL,
	`creator` text NOT NULL,
	`title` text NOT NULL,
	`intro` text NOT NULL,
	`body` text NOT NULL,
	`lock` text NOT NULL,
	`network` integer NOT NULL,
	`created_at` integer NOT NULL
, `type` text DEFAULT 'text' NOT NULL, `category` text DEFAULT 'Educación' NOT NULL, `thumbnail_id` text, `preview_id` text, `asset_id` text, `updated_at` integer DEFAULT 0 NOT NULL, `visibility` text DEFAULT 'members' NOT NULL, `plan_id` text, `premium_lock` text);

CREATE TABLE `profiles` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`avatar` text DEFAULT 'valeria' NOT NULL,
	`updated_at` integer NOT NULL
);

CREATE TABLE `saved_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`post_id` text NOT NULL,
	`created_at` integer NOT NULL
);

CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL
);

CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text,
	`google_sub` text,
	`created_at` integer NOT NULL
);

CREATE INDEX `assets_owner_idx` ON `assets` (`owner_id`);

CREATE INDEX `challenge_requester_created_idx` ON `challenges` (`requester`,`created_at`);

CREATE INDEX `comments_post_created_idx` ON `comments` (`post_id`,`created_at`);

CREATE UNIQUE INDEX `follows_owner_creator_idx` ON `follows` (`owner_id`,`creator_id`);

CREATE INDEX `media_grants_expiry_idx` ON `media_grants` (`expires_at`);

CREATE UNIQUE INDEX `plans_lock_network_idx` ON `creator_plans` (`lock`,`network`);

CREATE UNIQUE INDEX `plans_owner_slot_idx` ON `creator_plans` (`owner_id`,`slot`);

CREATE INDEX `posts_created_idx` ON `posts` (`created_at`);

CREATE INDEX `posts_owner_idx` ON `posts` (`owner_id`);

CREATE UNIQUE INDEX `saved_posts_owner_post_idx` ON `saved_posts` (`owner_id`,`post_id`);

CREATE INDEX `sessions_expiry_idx` ON `sessions` (`expires_at`);

CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);

CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);

CREATE UNIQUE INDEX `users_google_idx` ON `users` (`google_sub`);
COMMIT;
