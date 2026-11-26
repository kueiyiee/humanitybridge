CREATE TABLE `story_versions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`story_id` bigint unsigned NOT NULL,
	`version_number` bigint unsigned NOT NULL,
	`snapshot_json` text NOT NULL,
	`changed_by` bigint unsigned NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `story_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `ux_story_versions_story_version` UNIQUE(`story_id`,`version_number`)
);
--> statement-breakpoint
ALTER TABLE `story_media` ADD `caption` varchar(500);--> statement-breakpoint
ALTER TABLE `story_versions` ADD CONSTRAINT `story_versions_story_id_stories_id_fk` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `story_versions` ADD CONSTRAINT `story_versions_changed_by_users_id_fk` FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ix_story_versions_story` ON `story_versions` (`story_id`);