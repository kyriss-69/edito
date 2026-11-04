ALTER TABLE `columns` ADD `kind` text DEFAULT 'progress' NOT NULL;--> statement-breakpoint
-- Rôle des colonnes existantes, déduit de leur nom (même ordre de priorité que guessColumnKind).
UPDATE `columns` SET `kind` = 'archived' WHERE lower(`name`) LIKE '%archiv%';--> statement-breakpoint
UPDATE `columns` SET `kind` = 'published' WHERE lower(`name`) LIKE '%publi%' OR lower(`name`) LIKE '%en ligne%';--> statement-breakpoint
UPDATE `columns` SET `kind` = 'scheduled' WHERE lower(`name`) LIKE '%planifi%' OR lower(`name`) LIKE '%programm%';--> statement-breakpoint
UPDATE `columns` SET `kind` = 'review' WHERE lower(`name`) LIKE '%valid%' OR lower(`name`) LIKE '%relecture%';--> statement-breakpoint
UPDATE `columns` SET `kind` = 'idea' WHERE lower(`name`) LIKE '%idée%' OR lower(`name`) LIKE '%idee%';
