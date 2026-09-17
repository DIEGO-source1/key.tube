CREATE TABLE `upload_parts` (
	`session_id` text NOT NULL,
	`part_number` integer NOT NULL,
	`etag` text NOT NULL,
	`size` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `upload_parts_session_number_idx` ON `upload_parts` (`session_id`,`part_number`);--> statement-breakpoint
CREATE TABLE `upload_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`storage_key` text NOT NULL,
	`upload_id` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`state` text DEFAULT 'uploading' NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `uploads_owner_expiry_idx` ON `upload_sessions` (`owner_id`,`expires_at`);--> statement-breakpoint
ALTER TABLE `posts` ADD `status` text DEFAULT 'published' NOT NULL;