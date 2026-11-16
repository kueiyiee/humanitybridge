CREATE TABLE `email_verification_tokens` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`token_hash` varchar(128) NOT NULL,
	`expires_at` timestamp(3) NOT NULL,
	`verified_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `email_verification_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_verification_tokens_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`ip_address` varchar(64),
	`success` boolean NOT NULL,
	`reason` varchar(120),
	`attempted_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `login_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mfa_settings` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`totp_secret` varchar(128) NOT NULL,
	`backup_codes_hash` text,
	`enabled` boolean NOT NULL DEFAULT false,
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `mfa_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `mfa_settings_user_id_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `password_reset_tokens` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`token_hash` varchar(128) NOT NULL,
	`expires_at` timestamp(3) NOT NULL,
	`used_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `password_reset_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `password_reset_tokens_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `permissions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`role_code` varchar(48) NOT NULL,
	`permission_key` varchar(120) NOT NULL,
	`description` varchar(255),
	CONSTRAINT `permissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`code` varchar(48) NOT NULL,
	`display_name` varchar(120) NOT NULL,
	`description` text,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `roles_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`display_name` varchar(120) NOT NULL,
	`region` varchar(120),
	`organization` varchar(160),
	`bio` text,
	`avatar_url` varchar(500),
	`preferred_language` varchar(16) NOT NULL DEFAULT 'en',
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `user_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_sessions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`session_token_hash` varchar(128) NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`ip_address` varchar(64),
	`user_agent` varchar(300),
	`expires_at` timestamp(3) NOT NULL,
	`revoked_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `user_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `ux_sessions_token` UNIQUE(`session_token_hash`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`role` varchar(48) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'ACTIVE',
	`email_verified` boolean NOT NULL DEFAULT false,
	`mfa_enabled` boolean NOT NULL DEFAULT false,
	`last_login_at` timestamp(3),
	`deleted_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `ux_users_email` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `assistance_distributions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`case_id` bigint unsigned NOT NULL,
	`request_id` bigint unsigned,
	`amount_usd` decimal(12,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`approved_by` bigint unsigned NOT NULL,
	`distribution_notes` text NOT NULL,
	`distributed_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `assistance_distributions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `assistance_requests` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`case_id` bigint unsigned NOT NULL,
	`coordinator_id` bigint unsigned NOT NULL,
	`support_type` varchar(120) NOT NULL,
	`requested_amount_usd` decimal(12,2) NOT NULL DEFAULT '0.00',
	`justification` text NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'SUBMITTED',
	`admin_feedback` text,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `assistance_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `case_categories` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`slug` varchar(80) NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `case_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `case_categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `case_documents` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`case_id` bigint unsigned NOT NULL,
	`uploaded_by` bigint unsigned NOT NULL,
	`document_type` varchar(64) NOT NULL,
	`storage_key` varchar(255) NOT NULL,
	`original_filename` varchar(255) NOT NULL,
	`is_confidential` boolean NOT NULL DEFAULT true,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `case_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `case_requirements` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`case_id` bigint unsigned NOT NULL,
	`item_label` varchar(180) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`estimated_unit_cost_usd` decimal(12,2) DEFAULT '0.00',
	`fulfilled` boolean NOT NULL DEFAULT false,
	CONSTRAINT `case_requirements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `case_status_history` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`case_id` bigint unsigned NOT NULL,
	`previous_status` varchar(32),
	`new_status` varchar(32) NOT NULL,
	`changed_by` bigint unsigned NOT NULL,
	`reason` text,
	`changed_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `case_status_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `case_verifications` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`case_id` bigint unsigned NOT NULL,
	`reviewer_id` bigint unsigned NOT NULL,
	`decision` varchar(32) NOT NULL,
	`notes` text NOT NULL,
	`publish_publicly` boolean NOT NULL DEFAULT false,
	`decided_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `case_verifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `community_locations` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`region_name` varchar(120) NOT NULL,
	`country` varchar(120) NOT NULL,
	`approximate_lat` decimal(9,6),
	`approximate_lng` decimal(9,6),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `community_locations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `humanitarian_cases` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`reference_code` varchar(48) NOT NULL,
	`title` varchar(200) NOT NULL,
	`category_id` bigint unsigned NOT NULL,
	`location_id` bigint unsigned NOT NULL,
	`coordinator_id` bigint unsigned NOT NULL,
	`public_summary` text NOT NULL,
	`assistance_needed` text NOT NULL,
	`affected_count` int NOT NULL DEFAULT 1,
	`urgency_level` varchar(24) NOT NULL DEFAULT 'MEDIUM',
	`estimated_cost_usd` decimal(12,2) DEFAULT '0.00',
	`status` varchar(32) NOT NULL DEFAULT 'SUBMITTED',
	`is_public` boolean NOT NULL DEFAULT false,
	`is_child_related` boolean NOT NULL DEFAULT false,
	`guardian_consent_obtained` boolean NOT NULL DEFAULT false,
	`beneficiary_consent_obtained` boolean NOT NULL DEFAULT false,
	`private_contact_name` varchar(120) NOT NULL,
	`private_contact_phone` varchar(64) NOT NULL,
	`private_location_notes` text NOT NULL,
	`internal_admin_notes` text,
	`verified_by` bigint unsigned,
	`verified_at` timestamp(3),
	`deleted_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `humanitarian_cases_id` PRIMARY KEY(`id`),
	CONSTRAINT `ux_cases_reference` UNIQUE(`reference_code`)
);
--> statement-breakpoint
CREATE TABLE `stories` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`slug` varchar(180) NOT NULL,
	`title` varchar(200) NOT NULL,
	`category_id` bigint unsigned NOT NULL,
	`author_id` bigint unsigned NOT NULL,
	`region_name` varchar(120) NOT NULL,
	`excerpt` text NOT NULL,
	`body` text NOT NULL,
	`cover_image_url` varchar(500),
	`anonymous_publication` boolean NOT NULL DEFAULT false,
	`is_minor_subject` boolean NOT NULL DEFAULT false,
	`status` varchar(32) NOT NULL DEFAULT 'SUBMITTED',
	`language_code` varchar(16) NOT NULL DEFAULT 'en',
	`translated_content_json` text,
	`published_at` timestamp(3),
	`deleted_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `stories_id` PRIMARY KEY(`id`),
	CONSTRAINT `ux_stories_slug` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `story_categories` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`slug` varchar(80) NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	CONSTRAINT `story_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `story_categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `story_consents` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`story_id` bigint unsigned NOT NULL,
	`consent_story` boolean NOT NULL DEFAULT false,
	`consent_media` boolean NOT NULL DEFAULT false,
	`consent_identity` boolean NOT NULL DEFAULT false,
	`guardian_consent_recorded` boolean NOT NULL DEFAULT false,
	`withdrawn_at` timestamp(3),
	`recorded_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `story_consents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `story_media` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`story_id` bigint unsigned NOT NULL,
	`media_type` varchar(24) NOT NULL,
	`url` varchar(500) NOT NULL,
	`alt_text` varchar(255) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `story_media_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `story_publications` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`story_id` bigint unsigned NOT NULL,
	`published_by` bigint unsigned NOT NULL,
	`scheduled_for` timestamp(3),
	`published_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `story_publications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `story_reviews` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`story_id` bigint unsigned NOT NULL,
	`reviewer_id` bigint unsigned NOT NULL,
	`decision` varchar(32) NOT NULL,
	`editorial_notes` text,
	`reviewed_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `story_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaign_cases` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`campaign_id` bigint unsigned NOT NULL,
	`case_id` bigint unsigned NOT NULL,
	CONSTRAINT `campaign_cases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`slug` varchar(180) NOT NULL,
	`title` varchar(200) NOT NULL,
	`summary` text NOT NULL,
	`description` text NOT NULL,
	`target_amount` decimal(14,2) NOT NULL,
	`raised_amount` decimal(14,2) NOT NULL DEFAULT '0.00',
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`cover_image_url` varchar(500),
	`status` varchar(32) NOT NULL DEFAULT 'ACTIVE',
	`start_date` timestamp(3) NOT NULL,
	`end_date` timestamp(3) NOT NULL,
	`created_by` bigint unsigned NOT NULL,
	`deleted_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `campaigns_id` PRIMARY KEY(`id`),
	CONSTRAINT `ux_campaigns_slug` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `donations` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`donation_reference` varchar(64) NOT NULL,
	`campaign_id` bigint unsigned,
	`case_id` bigint unsigned,
	`amount` decimal(14,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`donor_name` varchar(120) NOT NULL,
	`donor_email` varchar(255) NOT NULL,
	`is_anonymous` boolean NOT NULL DEFAULT false,
	`dedication_note` varchar(300),
	`status` varchar(32) NOT NULL DEFAULT 'INITIATED',
	`payment_channel` varchar(48) NOT NULL,
	`confirmed_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `donations_id` PRIMARY KEY(`id`),
	CONSTRAINT `ux_donations_reference` UNIQUE(`donation_reference`)
);
--> statement-breakpoint
CREATE TABLE `financial_reconciliations` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`donation_id` bigint unsigned NOT NULL,
	`reconciled_by` bigint unsigned NOT NULL,
	`reconciliation_note` text NOT NULL,
	`external_ledger_ref` varchar(128) NOT NULL,
	`reconciled_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `financial_reconciliations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `financial_records` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`entry_type` varchar(32) NOT NULL,
	`reference_code` varchar(64) NOT NULL,
	`amount` decimal(14,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`campaign_id` bigint unsigned,
	`case_id` bigint unsigned,
	`description` text NOT NULL,
	`recorded_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `financial_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payment_transactions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`donation_id` bigint unsigned NOT NULL,
	`provider` varchar(64) NOT NULL,
	`provider_reference` varchar(128) NOT NULL,
	`amount` decimal(14,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`status` varchar(32) NOT NULL,
	`verified_by_webhook` boolean NOT NULL DEFAULT false,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_transactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `ux_payment_provider_ref` UNIQUE(`provider_reference`)
);
--> statement-breakpoint
CREATE TABLE `payment_webhook_events` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`event_id` varchar(128) NOT NULL,
	`provider` varchar(64) NOT NULL,
	`signature_valid` boolean NOT NULL,
	`payload_hash` varchar(128) NOT NULL,
	`processed_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_webhook_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `ux_webhook_event_id` UNIQUE(`event_id`)
);
--> statement-breakpoint
CREATE TABLE `refunds` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`donation_id` bigint unsigned NOT NULL,
	`amount` decimal(14,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`reason` text NOT NULL,
	`approved_by` bigint unsigned NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'COMPLETED',
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `refunds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `announcements` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`title` varchar(180) NOT NULL,
	`body` text NOT NULL,
	`target_role` varchar(48) NOT NULL DEFAULT 'ALL',
	`created_by` bigint unsigned NOT NULL,
	`published_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `announcements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `article_categories` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`slug` varchar(80) NOT NULL,
	`name` varchar(120) NOT NULL,
	CONSTRAINT `article_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `article_categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `articles` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`slug` varchar(180) NOT NULL,
	`title` varchar(200) NOT NULL,
	`category_id` bigint unsigned NOT NULL,
	`author_id` bigint unsigned NOT NULL,
	`summary` text NOT NULL,
	`body` text NOT NULL,
	`cover_image_url` varchar(500),
	`status` varchar(32) NOT NULL DEFAULT 'PUBLISHED',
	`published_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `articles_id` PRIMARY KEY(`id`),
	CONSTRAINT `ux_articles_slug` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `contact_messages` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`email` varchar(255) NOT NULL,
	`subject` varchar(180) NOT NULL,
	`message` text NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'NEW',
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `contact_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `field_activities` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`report_id` bigint unsigned NOT NULL,
	`activity_title` varchar(180) NOT NULL,
	`notes` text,
	CONSTRAINT `field_activities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `field_reports` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`coordinator_id` bigint unsigned NOT NULL,
	`case_id` bigint unsigned,
	`location_id` bigint unsigned NOT NULL,
	`visit_date` timestamp(3) NOT NULL,
	`summary` text NOT NULL,
	`assistance_delivered` text,
	`people_reached` int NOT NULL DEFAULT 0,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `field_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`event_type` varchar(64) NOT NULL,
	`title` varchar(180) NOT NULL,
	`message` text NOT NULL,
	`is_read` boolean NOT NULL DEFAULT false,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `partnership_enquiries` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`organization_name` varchar(160) NOT NULL,
	`contact_name` varchar(120) NOT NULL,
	`email` varchar(255) NOT NULL,
	`organization_type` varchar(48) NOT NULL,
	`region` varchar(120) NOT NULL,
	`proposal_summary` text NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'PENDING',
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `partnership_enquiries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `partnerships` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`enquiry_id` bigint unsigned,
	`organization_name` varchar(160) NOT NULL,
	`organization_type` varchar(48) NOT NULL,
	`region` varchar(120) NOT NULL,
	`focus_area` varchar(180) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'ACTIVE',
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `partnerships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `volunteer_applications` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`full_name` varchar(120) NOT NULL,
	`email` varchar(255) NOT NULL,
	`phone` varchar(48) NOT NULL,
	`region` varchar(120) NOT NULL,
	`skills` text NOT NULL,
	`availability` varchar(200) NOT NULL,
	`motivation` text NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'PENDING',
	`reviewed_by` bigint unsigned,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `volunteer_applications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `volunteers` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`application_id` bigint unsigned,
	`full_name` varchar(120) NOT NULL,
	`email` varchar(255) NOT NULL,
	`region` varchar(120) NOT NULL,
	`specialty` varchar(160) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'ACTIVE',
	`joined_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `volunteers_id` PRIMARY KEY(`id`),
	CONSTRAINT `volunteers_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `activity_logs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned,
	`summary` varchar(255) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`actor_user_id` bigint unsigned,
	`actor_role` varchar(48),
	`action` varchar(120) NOT NULL,
	`resource_type` varchar(80) NOT NULL,
	`resource_id` varchar(80),
	`details_json` text,
	`ip_address` varchar(64),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `backup_records` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`backup_type` varchar(48) NOT NULL,
	`status` varchar(32) NOT NULL,
	`location_label` varchar(255) NOT NULL,
	`recorded_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `backup_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `consent_records` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`subject_type` varchar(48) NOT NULL,
	`subject_id` bigint unsigned NOT NULL,
	`consent_scope` varchar(120) NOT NULL,
	`granted` boolean NOT NULL,
	`recorded_by` bigint unsigned NOT NULL,
	`withdrawn_at` timestamp(3),
	`recorded_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `consent_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `media_files` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`storage_scope` varchar(24) NOT NULL,
	`safe_filename` varchar(255) NOT NULL,
	`mime_type` varchar(120) NOT NULL,
	`size_bytes` int NOT NULL,
	`uploaded_by` bigint unsigned NOT NULL,
	`alt_text` varchar(255),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `media_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `moderation_actions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`target_type` varchar(48) NOT NULL,
	`target_id` bigint unsigned NOT NULL,
	`action_type` varchar(48) NOT NULL,
	`reason` text NOT NULL,
	`moderator_id` bigint unsigned NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `moderation_actions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `privacy_requests` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`requester_email` varchar(255) NOT NULL,
	`request_type` varchar(48) NOT NULL,
	`reference_code` varchar(80),
	`details` text NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'OPEN',
	`handled_by` bigint unsigned,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `privacy_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `safeguarding_reports` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`subject_type` varchar(48) NOT NULL,
	`reference_code` varchar(80),
	`severity` varchar(24) NOT NULL,
	`description` text NOT NULL,
	`reporter_email` varchar(255),
	`status` varchar(32) NOT NULL DEFAULT 'OPEN',
	`assigned_admin_id` bigint unsigned,
	`resolution_notes` text,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `safeguarding_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `system_settings` (
	`setting_key` varchar(120) NOT NULL,
	`setting_value` text NOT NULL,
	`is_public` boolean NOT NULL DEFAULT false,
	`updated_by` bigint unsigned,
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `system_settings_setting_key` PRIMARY KEY(`setting_key`)
);
--> statement-breakpoint
ALTER TABLE `email_verification_tokens` ADD CONSTRAINT `email_verification_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mfa_settings` ADD CONSTRAINT `mfa_settings_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD CONSTRAINT `user_profiles_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_sessions` ADD CONSTRAINT `user_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assistance_distributions` ADD CONSTRAINT `assistance_distributions_case_id_humanitarian_cases_id_fk` FOREIGN KEY (`case_id`) REFERENCES `humanitarian_cases`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assistance_distributions` ADD CONSTRAINT `assistance_distributions_request_id_assistance_requests_id_fk` FOREIGN KEY (`request_id`) REFERENCES `assistance_requests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assistance_distributions` ADD CONSTRAINT `assistance_distributions_approved_by_users_id_fk` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assistance_requests` ADD CONSTRAINT `assistance_requests_case_id_humanitarian_cases_id_fk` FOREIGN KEY (`case_id`) REFERENCES `humanitarian_cases`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assistance_requests` ADD CONSTRAINT `assistance_requests_coordinator_id_users_id_fk` FOREIGN KEY (`coordinator_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `case_documents` ADD CONSTRAINT `case_documents_case_id_humanitarian_cases_id_fk` FOREIGN KEY (`case_id`) REFERENCES `humanitarian_cases`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `case_documents` ADD CONSTRAINT `case_documents_uploaded_by_users_id_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `case_requirements` ADD CONSTRAINT `case_requirements_case_id_humanitarian_cases_id_fk` FOREIGN KEY (`case_id`) REFERENCES `humanitarian_cases`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `case_status_history` ADD CONSTRAINT `case_status_history_case_id_humanitarian_cases_id_fk` FOREIGN KEY (`case_id`) REFERENCES `humanitarian_cases`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `case_status_history` ADD CONSTRAINT `case_status_history_changed_by_users_id_fk` FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `case_verifications` ADD CONSTRAINT `case_verifications_case_id_humanitarian_cases_id_fk` FOREIGN KEY (`case_id`) REFERENCES `humanitarian_cases`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `case_verifications` ADD CONSTRAINT `case_verifications_reviewer_id_users_id_fk` FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `humanitarian_cases` ADD CONSTRAINT `humanitarian_cases_category_id_case_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `case_categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `humanitarian_cases` ADD CONSTRAINT `humanitarian_cases_location_id_community_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `community_locations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `humanitarian_cases` ADD CONSTRAINT `humanitarian_cases_coordinator_id_users_id_fk` FOREIGN KEY (`coordinator_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `humanitarian_cases` ADD CONSTRAINT `humanitarian_cases_verified_by_users_id_fk` FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stories` ADD CONSTRAINT `stories_category_id_story_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `story_categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stories` ADD CONSTRAINT `stories_author_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `story_consents` ADD CONSTRAINT `story_consents_story_id_stories_id_fk` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `story_media` ADD CONSTRAINT `story_media_story_id_stories_id_fk` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `story_publications` ADD CONSTRAINT `story_publications_story_id_stories_id_fk` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `story_publications` ADD CONSTRAINT `story_publications_published_by_users_id_fk` FOREIGN KEY (`published_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `story_reviews` ADD CONSTRAINT `story_reviews_story_id_stories_id_fk` FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `story_reviews` ADD CONSTRAINT `story_reviews_reviewer_id_users_id_fk` FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaign_cases` ADD CONSTRAINT `campaign_cases_campaign_id_campaigns_id_fk` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaign_cases` ADD CONSTRAINT `campaign_cases_case_id_humanitarian_cases_id_fk` FOREIGN KEY (`case_id`) REFERENCES `humanitarian_cases`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaigns` ADD CONSTRAINT `campaigns_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `donations` ADD CONSTRAINT `donations_campaign_id_campaigns_id_fk` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `donations` ADD CONSTRAINT `donations_case_id_humanitarian_cases_id_fk` FOREIGN KEY (`case_id`) REFERENCES `humanitarian_cases`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `financial_reconciliations` ADD CONSTRAINT `financial_reconciliations_donation_id_donations_id_fk` FOREIGN KEY (`donation_id`) REFERENCES `donations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `financial_reconciliations` ADD CONSTRAINT `financial_reconciliations_reconciled_by_users_id_fk` FOREIGN KEY (`reconciled_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `financial_records` ADD CONSTRAINT `financial_records_campaign_id_campaigns_id_fk` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `financial_records` ADD CONSTRAINT `financial_records_case_id_humanitarian_cases_id_fk` FOREIGN KEY (`case_id`) REFERENCES `humanitarian_cases`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_transactions` ADD CONSTRAINT `payment_transactions_donation_id_donations_id_fk` FOREIGN KEY (`donation_id`) REFERENCES `donations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_donation_id_donations_id_fk` FOREIGN KEY (`donation_id`) REFERENCES `donations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_approved_by_users_id_fk` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `announcements` ADD CONSTRAINT `announcements_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `articles` ADD CONSTRAINT `articles_category_id_article_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `article_categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `articles` ADD CONSTRAINT `articles_author_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `field_activities` ADD CONSTRAINT `field_activities_report_id_field_reports_id_fk` FOREIGN KEY (`report_id`) REFERENCES `field_reports`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `field_reports` ADD CONSTRAINT `field_reports_coordinator_id_users_id_fk` FOREIGN KEY (`coordinator_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `field_reports` ADD CONSTRAINT `field_reports_case_id_humanitarian_cases_id_fk` FOREIGN KEY (`case_id`) REFERENCES `humanitarian_cases`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `field_reports` ADD CONSTRAINT `field_reports_location_id_community_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `community_locations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partnerships` ADD CONSTRAINT `partnerships_enquiry_id_partnership_enquiries_id_fk` FOREIGN KEY (`enquiry_id`) REFERENCES `partnership_enquiries`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `volunteer_applications` ADD CONSTRAINT `volunteer_applications_reviewed_by_users_id_fk` FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `volunteers` ADD CONSTRAINT `volunteers_application_id_volunteer_applications_id_fk` FOREIGN KEY (`application_id`) REFERENCES `volunteer_applications`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actor_user_id_users_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `consent_records` ADD CONSTRAINT `consent_records_recorded_by_users_id_fk` FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `media_files` ADD CONSTRAINT `media_files_uploaded_by_users_id_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `moderation_actions` ADD CONSTRAINT `moderation_actions_moderator_id_users_id_fk` FOREIGN KEY (`moderator_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `privacy_requests` ADD CONSTRAINT `privacy_requests_handled_by_users_id_fk` FOREIGN KEY (`handled_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `safeguarding_reports` ADD CONSTRAINT `safeguarding_reports_assigned_admin_id_users_id_fk` FOREIGN KEY (`assigned_admin_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `system_settings` ADD CONSTRAINT `system_settings_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ix_login_attempts_email` ON `login_attempts` (`email`);--> statement-breakpoint
CREATE INDEX `ix_sessions_user` ON `user_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `ix_users_role` ON `users` (`role`);--> statement-breakpoint
CREATE INDEX `ix_cases_status` ON `humanitarian_cases` (`status`);--> statement-breakpoint
CREATE INDEX `ix_cases_coordinator` ON `humanitarian_cases` (`coordinator_id`);--> statement-breakpoint
CREATE INDEX `ix_stories_status` ON `stories` (`status`);--> statement-breakpoint
CREATE INDEX `ix_campaigns_status` ON `campaigns` (`status`);--> statement-breakpoint
CREATE INDEX `ix_donations_status` ON `donations` (`status`);--> statement-breakpoint
CREATE INDEX `ix_notifications_user` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `ix_audit_actor` ON `audit_logs` (`actor_user_id`);--> statement-breakpoint
CREATE INDEX `ix_audit_action` ON `audit_logs` (`action`);