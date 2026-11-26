CREATE TABLE `campaign_publications` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`campaign_id` bigint unsigned NOT NULL,
	`published_by` bigint unsigned NOT NULL,
	`published_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `campaign_publications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `campaigns` MODIFY COLUMN `status` varchar(32) NOT NULL DEFAULT 'DRAFT';--> statement-breakpoint
ALTER TABLE `articles` MODIFY COLUMN `status` varchar(32) NOT NULL DEFAULT 'DRAFT';--> statement-breakpoint
ALTER TABLE `campaign_publications` ADD CONSTRAINT `campaign_publications_campaign_id_campaigns_id_fk` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaign_publications` ADD CONSTRAINT `campaign_publications_published_by_users_id_fk` FOREIGN KEY (`published_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint