CREATE TABLE `cms_content` (
  `id` bigint unsigned AUTO_INCREMENT NOT NULL,
  `type` varchar(40) NOT NULL,
  `slug` varchar(180) NOT NULL,
  `title` varchar(200) NOT NULL,
  `subtitle` varchar(255),
  `summary` varchar(2000) NOT NULL,
  `body_json` longtext NOT NULL,
  `category` varchar(120),
  `author_id` bigint unsigned NOT NULL,
  `author_department` varchar(160),
  `location` varchar(180),
  `cover_image_url` varchar(500),
  `cover_alt_text` varchar(255),
  `tags_json` longtext,
  `attachments_json` longtext,
  `external_url` varchar(500),
  `status` varchar(32) NOT NULL DEFAULT 'DRAFT',
  `scheduled_at` timestamp(3),
  `published_at` timestamp(3),
  `expires_at` timestamp(3),
  `is_featured` boolean NOT NULL DEFAULT false,
  `seo_title` varchar(180),
  `seo_description` varchar(320),
  `deleted_at` timestamp(3),
  `created_at` timestamp(3) NOT NULL DEFAULT (now()),
  `updated_at` timestamp(3) NOT NULL DEFAULT (now()),
  CONSTRAINT `cms_content_id` PRIMARY KEY(`id`),
  CONSTRAINT `cms_content_author_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_cms_content_type_slug` ON `cms_content` (`type`,`slug`);
--> statement-breakpoint
CREATE INDEX `ix_cms_content_type_status` ON `cms_content` (`type`,`status`);
--> statement-breakpoint
CREATE INDEX `ix_cms_content_published_at` ON `cms_content` (`published_at`);
--> statement-breakpoint
CREATE INDEX `ix_cms_content_author` ON `cms_content` (`author_id`);
