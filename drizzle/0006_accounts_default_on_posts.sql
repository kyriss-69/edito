ALTER TABLE `social_accounts` ADD `default_on_posts` integer DEFAULT false NOT NULL;--> statement-breakpoint
-- Instagram et TikTok restent cochés d'office sur les nouveaux posts, comme avant.
UPDATE `social_accounts` SET `default_on_posts` = 1 WHERE `platform` IN ('instagram', 'tiktok');
