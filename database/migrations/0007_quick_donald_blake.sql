CREATE TABLE `story_assignments` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`story_id` bigint unsigned NOT NULL,
	`reviewer_id` bigint unsigned NOT NULL,
	`assigned_by` bigint unsigned NOT NULL,
	`assignment_reason` text NOT NULL,
	`assigned_at` timestamp(3) NOT NULL DEFAULT (now()),
	`ended_at` timestamp(3) NULL DEFAULT NULL,
	CONSTRAINT `story_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `story_comments` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`story_id` bigint unsigned NOT NULL,
	`author_id` bigint unsigned NOT NULL,
	`comment_body` text NOT NULL,
	`resolved_at` timestamp(3) NULL DEFAULT NULL,
	`resolved_by` bigint unsigned,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `story_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `stories` ADD `country_name` varchar(120);--> statement-breakpoint
ALTER TABLE `stories` ADD `state_region_name` varchar(120);--> statement-breakpoint
ALTER TABLE `stories` ADD `community_name` varchar(120);--> statement-breakpoint
ALTER TABLE `stories` ADD `tags_json` text;--> statement-breakpoint
ALTER TABLE `stories` ADD `is_featured` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `stories` ADD `internal_editorial_notes` text;--> statement-breakpoint
ALTER TABLE `story_consents` ADD `consent_reference` varchar(180);--> statement-breakpoint
ALTER TABLE `story_consents` ADD `consent_verified_by` bigint unsigned;--> statement-breakpoint
ALTER TABLE `story_consents` ADD `consent_verified_at` timestamp(3) NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `story_consents` ADD `consent_expires_at` timestamp(3) NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `story_media` ADD `position` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `story_assignments` ADD CONSTRAINT `story_assignments_story_id_stories_id_fk` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `story_assignments` ADD CONSTRAINT `story_assignments_reviewer_id_users_id_fk` FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `story_assignments` ADD CONSTRAINT `story_assignments_assigned_by_users_id_fk` FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `story_comments` ADD CONSTRAINT `story_comments_story_id_stories_id_fk` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `story_comments` ADD CONSTRAINT `story_comments_author_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `story_comments` ADD CONSTRAINT `story_comments_resolved_by_users_id_fk` FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ix_story_assignments_story` ON `story_assignments` (`story_id`);--> statement-breakpoint
CREATE INDEX `ix_story_comments_story` ON `story_comments` (`story_id`);--> statement-breakpoint
ALTER TABLE `story_consents` ADD CONSTRAINT `story_consents_consent_verified_by_users_id_fk` FOREIGN KEY (`consent_verified_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;