# HumanityBridge System Architecture & Database Design

## 1. Two-Dashboard Permission Matrix

| Capability | Public Visitor | `COMMUNITY_COORDINATOR` | `PLATFORM_ADMIN` |
|---|---|---|---|
| Read published stories & verified cases | Yes | Yes | Yes |
| Initiate donation & verify receipt | Yes | Yes | Yes |
| Submit safeguarding / contact report | Yes | Yes | Yes |
| Register humanitarian case (draft / submitted) | No | Own records only | Yes |
| Submit humanitarian story (unpublished) | No | Own records only | Yes |
| View private beneficiary contact vault | No | Own submissions only | Full access |
| Approve / verify / publish cases or stories | **Never** | **Never** | **Yes** |
| Create / manage campaigns | No | No | Yes |
| Reconcile donations, refunds, disbursements | No | No | Yes |
| Manage users, coordinators & MFA | No | Own profile/sessions | Full governance |
| Inspect immutable audit logs & safeguarding | No | No | Yes |

## 2. Database Entity Relationship Overview (52 Normalized Tables)

- **Identity & Access**: `roles`, `permissions`, `users` (1:1 `user_profiles`, 1:1 `mfa_settings`, 1:N `user_sessions`, `password_reset_tokens`, `email_verification_tokens`), `login_attempts`.
- **Humanitarian Operations**: `case_categories` & `community_locations` -> 1:N `humanitarian_cases` -> 1:N `case_requirements`, `case_documents`, `case_verifications`, `case_status_history`, `assistance_requests` -> `assistance_distributions`.
- **Storytelling & Consent**: `story_categories` -> 1:N `stories` -> 1:1 `story_consents`, 1:N `story_media`, `story_reviews`, `story_publications`.
- **Fundraising & Ledger**: `campaigns` <-> `campaign_cases` <-> `humanitarian_cases`; `donations` -> 1:N `payment_transactions` (unique `provider_reference`), `refunds`, `financial_reconciliations`; `payment_webhook_events` (unique `event_id` for idempotency); `financial_records`.
- **Community Operations**: `field_reports` -> `field_activities`; `volunteer_applications` -> `volunteers`; `partnership_enquiries` -> `partnerships`; `notifications`, `announcements`, `article_categories` -> `articles`, `contact_messages`.
- **Governance & Security**: `audit_logs`, `consent_records`, `safeguarding_reports`, `privacy_requests`, `moderation_actions`, `system_settings`, `media_files`, `activity_logs`, `backup_records`.
