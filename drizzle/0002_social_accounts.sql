CREATE TABLE `account_checklist_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`label` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `social_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `social_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`platform` text NOT NULL,
	`status` text DEFAULT 'todo' NOT NULL,
	`handle` text DEFAULT '' NOT NULL,
	`profile_url` text DEFAULT '' NOT NULL,
	`account_type` text DEFAULT 'business' NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`bio_link` text DEFAULT '' NOT NULL,
	`followers_goal` integer,
	`posts_per_week` integer,
	`notes` text DEFAULT '' NOT NULL,
	`avatar_file_name` text,
	`avatar_mime_type` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `social_accounts_platform_unique` ON `social_accounts` (`platform`);