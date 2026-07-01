CREATE TABLE `profile_types` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profile_types_key_unique` ON `profile_types` (`key`);--> statement-breakpoint
ALTER TABLE `buildings` ADD `slug` text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `buildings_project_slug_idx` ON `buildings` (`project_id`,`slug`);--> statement-breakpoint
ALTER TABLE `cutting_plans` ADD `is_applied` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `slug` text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `projects_slug_unique` ON `projects` (`slug`);