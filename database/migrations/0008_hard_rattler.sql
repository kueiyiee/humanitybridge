CREATE TABLE `document_organisation_profiles` (
	`id` int NOT NULL,
	`official_name` varchar(180),
	`registered_address` varchar(500),
	`country` varchar(120),
	`telephone` varchar(80),
	`email` varchar(255),
	`website` varchar(255),
	`registration_information` varchar(255),
	`approved_tagline` varchar(255),
	`issuing_department` varchar(160),
	`footer_disclaimer` varchar(500),
	`logo_storage_key` varchar(255),
	`updated_by` bigint unsigned,
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `document_organisation_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_sequences` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`reference_prefix` varchar(24) NOT NULL,
	`sequence_year` int NOT NULL,
	`next_number` int NOT NULL DEFAULT 1,
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `document_sequences_id` PRIMARY KEY(`id`),
	CONSTRAINT `ux_document_sequence_prefix_year` UNIQUE(`reference_prefix`,`sequence_year`)
);
--> statement-breakpoint
CREATE TABLE `document_signatories` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`full_name` varchar(180) NOT NULL,
	`position` varchar(160) NOT NULL,
	`department` varchar(160),
	`authorised_type_codes_json` text NOT NULL,
	`is_authorised` boolean NOT NULL DEFAULT false,
	`valid_from` timestamp(3) NULL DEFAULT NULL,
	`valid_until` timestamp(3) NULL DEFAULT NULL,
	`created_by` bigint unsigned NOT NULL,
	`updated_by` bigint unsigned NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `document_signatories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_status_history` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`document_id` bigint unsigned NOT NULL,
	`previous_status` varchar(32),
	`new_status` varchar(32) NOT NULL,
	`reason` varchar(500),
	`changed_by` bigint unsigned NOT NULL,
	`changed_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `document_status_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_template_versions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`template_id` bigint unsigned NOT NULL,
	`version_number` int NOT NULL,
	`configuration_json` text NOT NULL,
	`created_by` bigint unsigned NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `document_template_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `ux_document_template_version` UNIQUE(`template_id`,`version_number`)
);
--> statement-breakpoint
CREATE TABLE `document_templates` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`document_type_id` bigint unsigned NOT NULL,
	`name` varchar(120) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT false,
	`current_version` int NOT NULL DEFAULT 1,
	`created_by` bigint unsigned NOT NULL,
	`updated_by` bigint unsigned NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `document_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_types` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`type_code` varchar(32) NOT NULL,
	`display_name` varchar(120) NOT NULL,
	`reference_prefix` varchar(24) NOT NULL,
	`is_approved` boolean NOT NULL DEFAULT false,
	`requires_approval` boolean NOT NULL DEFAULT true,
	`public_verification` boolean NOT NULL DEFAULT false,
	`public_recipient` boolean NOT NULL DEFAULT false,
	`created_by` bigint unsigned NOT NULL,
	`updated_by` bigint unsigned NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `document_types_id` PRIMARY KEY(`id`),
	CONSTRAINT `ux_document_types_code` UNIQUE(`type_code`),
	CONSTRAINT `ux_document_types_prefix` UNIQUE(`reference_prefix`)
);
--> statement-breakpoint
CREATE TABLE `document_verification_events` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`document_id` bigint unsigned NOT NULL,
	`verified_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `document_verification_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `issued_documents` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`reference_code` varchar(80),
	`document_type_id` bigint unsigned NOT NULL,
	`template_version_id` bigint unsigned NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'DRAFT',
	`recipient_name` varchar(180) NOT NULL,
	`subject` varchar(240) NOT NULL,
	`payload_json` text NOT NULL,
	`organisation_snapshot_json` text,
	`public_recipient_name` varchar(180),
	`storage_key` varchar(255),
	`pdf_sha256` varchar(64),
	`created_by` bigint unsigned NOT NULL,
	`approved_by` bigint unsigned,
	`issued_by` bigint unsigned,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`issued_at` timestamp(3) NULL DEFAULT NULL,
	`expires_at` timestamp(3) NULL DEFAULT NULL,
	`revoked_at` timestamp(3) NULL DEFAULT NULL,
	`archived_at` timestamp(3) NULL DEFAULT NULL,
	CONSTRAINT `issued_documents_id` PRIMARY KEY(`id`),
	CONSTRAINT `ux_issued_documents_reference` UNIQUE(`reference_code`)
);
--> statement-breakpoint
ALTER TABLE `document_organisation_profiles` ADD CONSTRAINT `document_organisation_profiles_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_signatories` ADD CONSTRAINT `document_signatories_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_signatories` ADD CONSTRAINT `document_signatories_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_status_history` ADD CONSTRAINT `document_status_history_document_id_issued_documents_id_fk` FOREIGN KEY (`document_id`) REFERENCES `issued_documents`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_status_history` ADD CONSTRAINT `document_status_history_changed_by_users_id_fk` FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_template_versions` ADD CONSTRAINT `document_template_versions_template_id_document_templates_id_fk` FOREIGN KEY (`template_id`) REFERENCES `document_templates`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_template_versions` ADD CONSTRAINT `document_template_versions_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_templates` ADD CONSTRAINT `document_templates_document_type_id_document_types_id_fk` FOREIGN KEY (`document_type_id`) REFERENCES `document_types`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_templates` ADD CONSTRAINT `document_templates_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_templates` ADD CONSTRAINT `document_templates_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_types` ADD CONSTRAINT `document_types_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_types` ADD CONSTRAINT `document_types_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_verification_events` ADD CONSTRAINT `document_verification_events_document_id_issued_documents_id_fk` FOREIGN KEY (`document_id`) REFERENCES `issued_documents`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `issued_documents` ADD CONSTRAINT `issued_documents_document_type_id_document_types_id_fk` FOREIGN KEY (`document_type_id`) REFERENCES `document_types`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `issued_documents` ADD CONSTRAINT `issued_documents_template_version_fk` FOREIGN KEY (`template_version_id`) REFERENCES `document_template_versions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `issued_documents` ADD CONSTRAINT `issued_documents_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `issued_documents` ADD CONSTRAINT `issued_documents_approved_by_users_id_fk` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `issued_documents` ADD CONSTRAINT `issued_documents_issued_by_users_id_fk` FOREIGN KEY (`issued_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ix_document_signatories_authorised` ON `document_signatories` (`is_authorised`);--> statement-breakpoint
CREATE INDEX `ix_document_status_history_document` ON `document_status_history` (`document_id`);--> statement-breakpoint
CREATE INDEX `ix_document_template_versions_template` ON `document_template_versions` (`template_id`);--> statement-breakpoint
CREATE INDEX `ix_document_templates_type` ON `document_templates` (`document_type_id`);--> statement-breakpoint
CREATE INDEX `ix_document_templates_active` ON `document_templates` (`is_active`);--> statement-breakpoint
CREATE INDEX `ix_document_types_approved` ON `document_types` (`is_approved`);--> statement-breakpoint
CREATE INDEX `ix_document_verifications_document` ON `document_verification_events` (`document_id`);--> statement-breakpoint
CREATE INDEX `ix_document_verifications_time` ON `document_verification_events` (`verified_at`);--> statement-breakpoint
CREATE INDEX `ix_issued_documents_type` ON `issued_documents` (`document_type_id`);--> statement-breakpoint
CREATE INDEX `ix_issued_documents_status` ON `issued_documents` (`status`);--> statement-breakpoint
CREATE INDEX `ix_issued_documents_recipient` ON `issued_documents` (`recipient_name`);--> statement-breakpoint
CREATE INDEX `ix_issued_documents_issued_at` ON `issued_documents` (`issued_at`);--> statement-breakpoint
CREATE INDEX `ix_issued_documents_creator` ON `issued_documents` (`created_by`);