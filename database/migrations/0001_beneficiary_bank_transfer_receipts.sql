ALTER TABLE `humanitarian_cases` ADD COLUMN `beneficiary_full_name` varchar(120) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE `humanitarian_cases` ADD COLUMN `beneficiary_age_band` varchar(24) NOT NULL DEFAULT 'UNKNOWN';--> statement-breakpoint
ALTER TABLE `humanitarian_cases` ADD COLUMN `beneficiary_gender` varchar(24) NOT NULL DEFAULT 'UNKNOWN';--> statement-breakpoint
ALTER TABLE `humanitarian_cases` ADD COLUMN `household_size` int NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `humanitarian_cases` ADD COLUMN `beneficiary_preferred_language` varchar(60);--> statement-breakpoint
ALTER TABLE `humanitarian_cases` ADD COLUMN `beneficiary_needs_notes` text;--> statement-breakpoint
CREATE TABLE `bank_transfer_records` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT, `case_id` bigint unsigned NOT NULL,
  `beneficiary_name` varchar(120) NOT NULL, `bank_name` varchar(120) NOT NULL,
  `bank_reference` varchar(120) NOT NULL, `amount` decimal(14,2) NOT NULL,
  `currency` varchar(3) NOT NULL, `transfer_date` timestamp(3) NOT NULL,
  `recipient_account_last4` varchar(4), `purpose` varchar(180) NOT NULL, `notes` text NOT NULL,
  `evidence_media_id` bigint unsigned NOT NULL, `status` varchar(24) NOT NULL DEFAULT 'PENDING_REVIEW',
  `recorded_by` bigint unsigned NOT NULL, `verified_by` bigint unsigned, `verification_notes` text,
  `receipt_number` varchar(48), `verified_at` timestamp(3), `receipt_issued_at` timestamp(3),
  `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), CONSTRAINT `ux_bank_transfer_reference` UNIQUE (`bank_name`, `bank_reference`),
  CONSTRAINT `ux_bank_transfer_receipt` UNIQUE (`receipt_number`),
  CONSTRAINT `bank_transfer_case_fk` FOREIGN KEY (`case_id`) REFERENCES `humanitarian_cases`(`id`),
  CONSTRAINT `bank_transfer_evidence_fk` FOREIGN KEY (`evidence_media_id`) REFERENCES `media_files`(`id`),
  CONSTRAINT `bank_transfer_recorded_by_fk` FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`),
  CONSTRAINT `bank_transfer_verified_by_fk` FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`)
);--> statement-breakpoint
CREATE INDEX `ix_bank_transfer_status` ON `bank_transfer_records` (`status`);--> statement-breakpoint
CREATE INDEX `ix_bank_transfer_case` ON `bank_transfer_records` (`case_id`);