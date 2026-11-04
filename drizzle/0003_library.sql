CREATE TABLE `hashtag_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`hashtags` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `library_assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_name` text NOT NULL,
	`original_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`title` text NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `post_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`hashtags` text DEFAULT '' NOT NULL,
	`cta` text DEFAULT '' NOT NULL,
	`format` text DEFAULT 'image' NOT NULL,
	`platforms` text DEFAULT '[]' NOT NULL,
	`pillar_id` integer,
	`notes` text DEFAULT '' NOT NULL,
	`checklist` text DEFAULT '[]' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`pillar_id`) REFERENCES `pillars`(`id`) ON UPDATE no action ON DELETE set null
);
