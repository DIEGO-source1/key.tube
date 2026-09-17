CREATE TABLE `auth_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE UNIQUE INDEX `plans_owner_slot_idx` ON `creator_plans` (`owner_id`,`slot`);--> statement-breakpoint
CREATE UNIQUE INDEX `plans_lock_network_idx` ON `creator_plans` (`lock`,`network`);--> statement-breakpoint
CREATE TABLE `oauth_states` (
	`user_id` text,
	`state_hash` text PRIMARY KEY NOT NULL,
	`verifier` text NOT NULL,
	`nonce` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expiry_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text,
	`google_sub` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_idx` ON `users` (`google_sub`);--> statement-breakpoint
ALTER TABLE `posts` ADD `visibility` text DEFAULT 'members' NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `plan_id` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `premium_lock` text;