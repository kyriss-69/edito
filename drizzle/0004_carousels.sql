CREATE TABLE `carousels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`mockup_asset_id` integer,
	`slides` text DEFAULT '[]' NOT NULL,
	`style` text DEFAULT '{}' NOT NULL,
	`post_id` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`mockup_asset_id`) REFERENCES `library_assets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE set null
);
