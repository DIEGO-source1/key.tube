CREATE TABLE `password_recovery_codes` (
  `flow_hash` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `code_hash` text NOT NULL,
  `attempts` integer DEFAULT 0 NOT NULL,
  `created_at` integer NOT NULL,
  `expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `password_recovery_user_idx` ON `password_recovery_codes` (`user_id`);
--> statement-breakpoint
CREATE INDEX `password_recovery_expiry_idx` ON `password_recovery_codes` (`expires_at`);
