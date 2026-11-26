ALTER TABLE `issued_documents` ADD `content_json` text;
--> statement-breakpoint
CREATE TABLE `document_editor_drafts` (
  `id` bigint unsigned AUTO_INCREMENT NOT NULL,
  `title` varchar(180) NOT NULL,
  `content_json` text NOT NULL,
  `page_settings_json` text NOT NULL,
  `created_by` bigint unsigned NOT NULL,
  `created_at` timestamp(3) NOT NULL DEFAULT (now()),
  `updated_at` timestamp(3) NOT NULL DEFAULT (now()),
  CONSTRAINT `document_editor_drafts_id` PRIMARY KEY(`id`),
  CONSTRAINT `document_editor_drafts_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX `ix_document_editor_drafts_creator` ON `document_editor_drafts` (`created_by`);
--> statement-breakpoint
CREATE INDEX `ix_document_editor_drafts_updated` ON `document_editor_drafts` (`updated_at`);
