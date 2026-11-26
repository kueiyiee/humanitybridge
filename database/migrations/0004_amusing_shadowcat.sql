CREATE TABLE `campaign_assignments` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`campaign_id` bigint unsigned NOT NULL,
	`coordinator_id` bigint unsigned NOT NULL,
	`assigned_by` bigint unsigned NOT NULL,
	`assignment_reason` text NOT NULL,
	`assigned_at` timestamp(3) NOT NULL DEFAULT (now()),
	`ended_at` timestamp(3) NULL DEFAULT NULL,
	CONSTRAINT `campaign_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `campaign_assignments` ADD CONSTRAINT `campaign_assignments_campaign_id_campaigns_id_fk` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaign_assignments` ADD CONSTRAINT `campaign_assignments_coordinator_id_users_id_fk` FOREIGN KEY (`coordinator_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaign_assignments` ADD CONSTRAINT `campaign_assignments_assigned_by_users_id_fk` FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ix_campaign_assignments_campaign` ON `campaign_assignments` (`campaign_id`);--> statement-breakpoint
CREATE INDEX `ix_campaign_assignments_coordinator` ON `campaign_assignments` (`coordinator_id`);