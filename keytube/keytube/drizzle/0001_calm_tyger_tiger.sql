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
--> statement-breakpoint
CREATE INDEX `assets_owner_idx` ON `assets` (`owner_id`);--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`post_id` text NOT NULL,
	`name` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `comments_post_created_idx` ON `comments` (`post_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `follows` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`creator_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `follows_owner_creator_idx` ON `follows` (`owner_id`,`creator_id`);--> statement-breakpoint
CREATE TABLE `media_grants` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`wallet` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `media_grants_expiry_idx` ON `media_grants` (`expires_at`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`avatar` text DEFAULT 'valeria' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `saved_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`post_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `saved_posts_owner_post_idx` ON `saved_posts` (`owner_id`,`post_id`);--> statement-breakpoint
ALTER TABLE `posts` ADD `type` text DEFAULT 'text' NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `category` text DEFAULT 'Educación' NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `thumbnail_id` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `preview_id` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `asset_id` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `updated_at` integer DEFAULT 0 NOT NULL;