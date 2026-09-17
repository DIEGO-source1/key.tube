ALTER TABLE `profiles` ADD `wallet` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `posts` ADD `views` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE INDEX `posts_views_idx` ON `posts` (`views`);
