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
--> statement-breakpoint
CREATE INDEX `challenge_requester_created_idx` ON `challenges` (`requester`,`created_at`);--> statement-breakpoint
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
);
--> statement-breakpoint
CREATE INDEX `posts_owner_idx` ON `posts` (`owner_id`);--> statement-breakpoint
CREATE INDEX `posts_created_idx` ON `posts` (`created_at`);