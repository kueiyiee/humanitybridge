import { sqliteTable, integer, text, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
export * from './documents';
export * from './content';

// Identity & Access
export const roles = sqliteTable('roles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  displayName: text('display_name').notNull(),
  description: text('description'),
  createdAt: text('created_at').notNull(),
});

export const permissions = sqliteTable('permissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  roleCode: text('role_code').notNull(),
  permissionKey: text('permission_key').notNull(),
  description: text('description'),
});

export const users = sqliteTable(
  'users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role').notNull(),
    status: text('status').notNull().default('ACTIVE'),
    emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
    mfaEnabled: integer('mfa_enabled', { mode: 'boolean' }).notNull().default(false),
    lastLoginAt: text('last_login_at'),
    deletedAt: text('deleted_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    emailUnique: uniqueIndex('ux_users_email').on(table.email),
    roleIdx: index('ix_users_role').on(table.role),
  }),
);

export const userProfiles = sqliteTable('user_profiles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  region: text('region'),
  organization: text('organization'),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  preferredLanguage: text('preferred_language').notNull().default('en'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const userSessions = sqliteTable(
  'user_sessions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sessionTokenHash: text('session_token_hash').notNull(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    expiresAt: text('expires_at').notNull(),
    revokedAt: text('revoked_at'),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    tokenUnique: uniqueIndex('ux_sessions_token').on(table.sessionTokenHash),
    userIdx: index('ix_sessions_user').on(table.userId),
  }),
);

export const passwordResetTokens = sqliteTable('password_reset_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  usedAt: text('used_at'),
  createdAt: text('created_at').notNull(),
});

export const emailVerificationTokens = sqliteTable('email_verification_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  verifiedAt: text('verified_at'),
  createdAt: text('created_at').notNull(),
});

export const mfaSettings = sqliteTable('mfa_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  totpSecret: text('totp_secret').notNull(),
  backupCodesHash: text('backup_codes_hash'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  updatedAt: text('updated_at').notNull(),
});

export const loginAttempts = sqliteTable(
  'login_attempts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    email: text('email').notNull(),
    ipAddress: text('ip_address'),
    success: integer('success', { mode: 'boolean' }).notNull(),
    reason: text('reason'),
    attemptedAt: text('attempted_at').notNull(),
  },
  (table) => ({
    emailIdx: index('ix_login_attempts_email').on(table.email),
  }),
);

// Humanitarian Operations
export const caseCategories = sqliteTable('case_categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: text('created_at').notNull(),
});

export const communityLocations = sqliteTable('community_locations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  regionName: text('region_name').notNull(),
  country: text('country').notNull(),
  approximateLat: real('approximate_lat'),
  approximateLng: real('approximate_lng'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
});

export const humanitarianCases = sqliteTable(
  'humanitarian_cases',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    referenceCode: text('reference_code').notNull(),
    title: text('title').notNull(),
    categoryId: integer('category_id')
      .notNull()
      .references(() => caseCategories.id),
    locationId: integer('location_id')
      .notNull()
      .references(() => communityLocations.id),
    coordinatorId: integer('coordinator_id')
      .notNull()
      .references(() => users.id),
    publicSummary: text('public_summary').notNull(),
    assistanceNeeded: text('assistance_needed').notNull(),
    affectedCount: integer('affected_count').notNull().default(1),
    urgencyLevel: text('urgency_level').notNull().default('MEDIUM'),
    estimatedCostUsd: real('estimated_cost_usd').default(0),
    status: text('status').notNull().default('SUBMITTED'),
    isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(false),
    isChildRelated: integer('is_child_related', { mode: 'boolean' }).notNull().default(false),
    guardianConsentObtained: integer('guardian_consent_obtained', { mode: 'boolean' }).notNull().default(false),
    beneficiaryConsentObtained: integer('beneficiary_consent_obtained', { mode: 'boolean' }).notNull().default(false),
    privateContactName: text('private_contact_name').notNull(),
    privateContactPhone: text('private_contact_phone').notNull(),
    beneficiaryFullName: text('beneficiary_full_name').notNull().default(''),
    beneficiaryAgeBand: text('beneficiary_age_band').notNull().default('UNKNOWN'),
    beneficiaryGender: text('beneficiary_gender').notNull().default('UNKNOWN'),
    householdSize: integer('household_size').notNull().default(1),
    beneficiaryPreferredLanguage: text('beneficiary_preferred_language'),
    beneficiaryNeedsNotes: text('beneficiary_needs_notes'),
    privateLocationNotes: text('private_location_notes').notNull(),
    internalAdminNotes: text('internal_admin_notes'),
    verifiedBy: integer('verified_by').references(() => users.id),
    verifiedAt: text('verified_at'),
    deletedAt: text('deleted_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    refUnique: uniqueIndex('ux_cases_reference').on(table.referenceCode),
    statusIdx: index('ix_cases_status').on(table.status),
    coordIdx: index('ix_cases_coordinator').on(table.coordinatorId),
  }),
);

export const caseRequirements = sqliteTable('case_requirements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  caseId: integer('case_id')
    .notNull()
    .references(() => humanitarianCases.id, { onDelete: 'cascade' }),
  itemLabel: text('item_label').notNull(),
  quantity: integer('quantity').notNull().default(1),
  estimatedUnitCostUsd: real('estimated_unit_cost_usd').default(0),
  fulfilled: integer('fulfilled', { mode: 'boolean' }).notNull().default(false),
});

export const caseDocuments = sqliteTable('case_documents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  caseId: integer('case_id')
    .notNull()
    .references(() => humanitarianCases.id, { onDelete: 'cascade' }),
  uploadedBy: integer('uploaded_by')
    .notNull()
    .references(() => users.id),
  documentType: text('document_type').notNull(),
  storageKey: text('storage_key').notNull(),
  originalFilename: text('original_filename').notNull(),
  isConfidential: integer('is_confidential', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
});

export const caseVerifications = sqliteTable('case_verifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  caseId: integer('case_id')
    .notNull()
    .references(() => humanitarianCases.id, { onDelete: 'cascade' }),
  reviewerId: integer('reviewer_id')
    .notNull()
    .references(() => users.id),
  decision: text('decision').notNull(),
  notes: text('notes').notNull(),
  publishPublicly: integer('publish_publicly', { mode: 'boolean' }).notNull().default(false),
  decidedAt: text('decided_at').notNull(),
});

export const caseStatusHistory = sqliteTable('case_status_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  caseId: integer('case_id')
    .notNull()
    .references(() => humanitarianCases.id, { onDelete: 'cascade' }),
  previousStatus: text('previous_status'),
  newStatus: text('new_status').notNull(),
  changedBy: integer('changed_by')
    .notNull()
    .references(() => users.id),
  reason: text('reason'),
  changedAt: text('changed_at').notNull(),
});

export const assistanceRequests = sqliteTable('assistance_requests', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  caseId: integer('case_id')
    .notNull()
    .references(() => humanitarianCases.id, { onDelete: 'cascade' }),
  coordinatorId: integer('coordinator_id')
    .notNull()
    .references(() => users.id),
  supportType: text('support_type').notNull(),
  requestedAmountUsd: real('requested_amount_usd').notNull().default(0),
  justification: text('justification').notNull(),
  status: text('status').notNull().default('SUBMITTED'),
  adminFeedback: text('admin_feedback'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const assistanceDistributions = sqliteTable('assistance_distributions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  caseId: integer('case_id')
    .notNull()
    .references(() => humanitarianCases.id),
  requestId: integer('request_id').references(() => assistanceRequests.id),
  amountUsd: real('amount_usd').notNull(),
  currency: text('currency').notNull().default('USD'),
  approvedBy: integer('approved_by')
    .notNull()
    .references(() => users.id),
  distributionNotes: text('distribution_notes').notNull(),
  distributedAt: text('distributed_at').notNull(),
});

// Storytelling
export const storyCategories = sqliteTable('story_categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
});

export const stories = sqliteTable(
  'stories',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    categoryId: integer('category_id')
      .notNull()
      .references(() => storyCategories.id),
    authorId: integer('author_id')
      .notNull()
      .references(() => users.id),
    regionName: text('region_name').notNull(),
    countryName: text('country_name'),
    stateRegionName: text('state_region_name'),
    communityName: text('community_name'),
    tagsJson: text('tags_json'),
    isFeatured: integer('is_featured', { mode: 'boolean' }).notNull().default(false),
    internalEditorialNotes: text('internal_editorial_notes'),
    excerpt: text('excerpt').notNull(),
    body: text('body').notNull(),
    coverImageUrl: text('cover_image_url'),
    coverAltText: text('cover_alt_text'),
    anonymousPublication: integer('anonymous_publication', { mode: 'boolean' }).notNull().default(false),
    isMinorSubject: integer('is_minor_subject', { mode: 'boolean' }).notNull().default(false),
    status: text('status').notNull().default('SUBMITTED'),
    languageCode: text('language_code').notNull().default('en'),
    translatedContentJson: text('translated_content_json'),
    publishedAt: text('published_at'),
    deletedAt: text('deleted_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    slugUnique: uniqueIndex('ux_stories_slug').on(table.slug),
    statusIdx: index('ix_stories_status').on(table.status),
  }),
);

export const storyMedia = sqliteTable('story_media', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  storyId: integer('story_id')
    .notNull()
    .references(() => stories.id, { onDelete: 'cascade' }),
  mediaType: text('media_type').notNull(),
  url: text('url').notNull(),
  altText: text('alt_text').notNull(),
  caption: text('caption'),
  position: integer('position').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

export const storyConsents = sqliteTable('story_consents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  storyId: integer('story_id')
    .notNull()
    .references(() => stories.id, { onDelete: 'cascade' }),
  consentStory: integer('consent_story', { mode: 'boolean' }).notNull().default(false),
  consentMedia: integer('consent_media', { mode: 'boolean' }).notNull().default(false),
  consentIdentity: integer('consent_identity', { mode: 'boolean' }).notNull().default(false),
  guardianConsentRecorded: integer('guardian_consent_recorded', { mode: 'boolean' }).notNull().default(false),
  consentReference: text('consent_reference'),
  consentVerifiedBy: integer('consent_verified_by').references(() => users.id),
  consentVerifiedAt: text('consent_verified_at'),
  consentExpiresAt: text('consent_expires_at'),
  withdrawnAt: text('withdrawn_at'),
  recordedAt: text('recorded_at').notNull(),
});

export const storyReviews = sqliteTable('story_reviews', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  storyId: integer('story_id')
    .notNull()
    .references(() => stories.id, { onDelete: 'cascade' }),
  reviewerId: integer('reviewer_id')
    .notNull()
    .references(() => users.id),
  decision: text('decision').notNull(),
  editorialNotes: text('editorial_notes'),
  reviewedAt: text('reviewed_at').notNull(),
});

export const storyPublications = sqliteTable('story_publications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  storyId: integer('story_id')
    .notNull()
    .references(() => stories.id, { onDelete: 'cascade' }),
  publishedBy: integer('published_by')
    .notNull()
    .references(() => users.id),
  scheduledFor: text('scheduled_for'),
  publishedAt: text('published_at').notNull(),
});

export const storyAssignments = sqliteTable(
  'story_assignments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    storyId: integer('story_id')
      .notNull()
      .references(() => stories.id, { onDelete: 'cascade' }),
    reviewerId: integer('reviewer_id')
      .notNull()
      .references(() => users.id),
    assignedBy: integer('assigned_by')
      .notNull()
      .references(() => users.id),
    assignmentReason: text('assignment_reason').notNull(),
    assignedAt: text('assigned_at').notNull(),
    endedAt: text('ended_at'),
  },
  (table) => ({
    storyIdx: index('ix_story_assignments_story').on(table.storyId),
  }),
);

export const storyComments = sqliteTable(
  'story_comments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    storyId: integer('story_id')
      .notNull()
      .references(() => stories.id, { onDelete: 'cascade' }),
    authorId: integer('author_id')
      .notNull()
      .references(() => users.id),
    commentBody: text('comment_body').notNull(),
    resolvedAt: text('resolved_at'),
    resolvedBy: integer('resolved_by').references(() => users.id),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    storyIdx: index('ix_story_comments_story').on(table.storyId),
  }),
);

export const storyVersions = sqliteTable(
  'story_versions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    storyId: integer('story_id')
      .notNull()
      .references(() => stories.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    snapshotJson: text('snapshot_json').notNull(),
    changedBy: integer('changed_by')
      .notNull()
      .references(() => users.id),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    storyVersionUnique: uniqueIndex('ux_story_versions_story_version').on(table.storyId, table.versionNumber),
    storyVersionIdx: index('ix_story_versions_story').on(table.storyId),
  }),
);

// Fundraising
export const campaigns = sqliteTable(
  'campaigns',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    description: text('description').notNull(),
    targetAmount: real('target_amount').notNull(),
    raisedAmount: real('raised_amount').notNull().default(0),
    currency: text('currency').notNull().default('USD'),
    coverImageUrl: text('cover_image_url'),
    status: text('status').notNull().default('DRAFT'),
    startDate: text('start_date').notNull(),
    endDate: text('end_date').notNull(),
    createdBy: integer('created_by')
      .notNull()
      .references(() => users.id),
    deletedAt: text('deleted_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    slugUnique: uniqueIndex('ux_campaigns_slug').on(table.slug),
    statusIdx: index('ix_campaigns_status').on(table.status),
  }),
);

export const campaignCases = sqliteTable('campaign_cases', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  campaignId: integer('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  caseId: integer('case_id')
    .notNull()
    .references(() => humanitarianCases.id, { onDelete: 'cascade' }),
});

export const campaignPublications = sqliteTable(
  'campaign_publications',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    campaignId: integer('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    publishedBy: integer('published_by')
      .notNull()
      .references(() => users.id),
    publishedAt: text('published_at').notNull(),
  },
  (table) => ({
    campaignUnique: uniqueIndex('ux_campaign_publications_campaign').on(table.campaignId),
  }),
);

export const campaignAssignments = sqliteTable(
  'campaign_assignments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    campaignId: integer('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    coordinatorId: integer('coordinator_id')
      .notNull()
      .references(() => users.id),
    assignedBy: integer('assigned_by')
      .notNull()
      .references(() => users.id),
    assignmentReason: text('assignment_reason').notNull(),
    assignedAt: text('assigned_at').notNull(),
    endedAt: text('ended_at'),
  },
  (table) => ({
    campaignIdx: index('ix_campaign_assignments_campaign').on(table.campaignId),
    coordinatorIdx: index('ix_campaign_assignments_coordinator').on(table.coordinatorId),
  }),
);

export const donations = sqliteTable(
  'donations',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    donationReference: text('donation_reference').notNull(),
    campaignId: integer('campaign_id').references(() => campaigns.id),
    caseId: integer('case_id').references(() => humanitarianCases.id),
    amount: real('amount').notNull(),
    currency: text('currency').notNull().default('USD'),
    donorName: text('donor_name').notNull(),
    donorEmail: text('donor_email').notNull(),
    isAnonymous: integer('is_anonymous', { mode: 'boolean' }).notNull().default(false),
    dedicationNote: text('dedication_note'),
    status: text('status').notNull().default('INITIATED'),
    paymentChannel: text('payment_channel').notNull(),
    confirmedAt: text('confirmed_at'),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    refUnique: uniqueIndex('ux_donations_reference').on(table.donationReference),
    statusIdx: index('ix_donations_status').on(table.status),
  }),
);

export const paymentTransactions = sqliteTable(
  'payment_transactions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    donationId: integer('donation_id')
      .notNull()
      .references(() => donations.id),
    provider: text('provider').notNull(),
    providerReference: text('provider_reference').notNull(),
    amount: real('amount').notNull(),
    currency: text('currency').notNull().default('USD'),
    status: text('status').notNull(),
    verifiedByWebhook: integer('verified_by_webhook', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    providerRefUnique: uniqueIndex('ux_payment_provider_ref').on(table.providerReference),
  }),
);

export const paymentWebhookEvents = sqliteTable(
  'payment_webhook_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    eventId: text('event_id').notNull(),
    provider: text('provider').notNull(),
    signatureValid: integer('signature_valid', { mode: 'boolean' }).notNull(),
    payloadHash: text('payload_hash').notNull(),
    processedAt: text('processed_at').notNull(),
  },
  (table) => ({
    eventUnique: uniqueIndex('ux_webhook_event_id').on(table.eventId),
  }),
);

export const refunds = sqliteTable('refunds', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  donationId: integer('donation_id')
    .notNull()
    .references(() => donations.id),
  amount: real('amount').notNull(),
  currency: text('currency').notNull().default('USD'),
  reason: text('reason').notNull(),
  approvedBy: integer('approved_by')
    .notNull()
    .references(() => users.id),
  status: text('status').notNull().default('COMPLETED'),
  createdAt: text('created_at').notNull(),
});

export const financialRecords = sqliteTable('financial_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  entryType: text('entry_type').notNull(),
  referenceCode: text('reference_code').notNull(),
  amount: real('amount').notNull(),
  currency: text('currency').notNull().default('USD'),
  campaignId: integer('campaign_id').references(() => campaigns.id),
  caseId: integer('case_id').references(() => humanitarianCases.id),
  description: text('description').notNull(),
  recordedAt: text('recorded_at').notNull(),
});

export const financialReconciliations = sqliteTable('financial_reconciliations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  donationId: integer('donation_id')
    .notNull()
    .references(() => donations.id),
  reconciledBy: integer('reconciled_by')
    .notNull()
    .references(() => users.id),
  reconciliationNote: text('reconciliation_note').notNull(),
  externalLedgerRef: text('external_ledger_ref').notNull(),
  reconciledAt: text('reconciled_at').notNull(),
});

// Community Operations
export const fieldReports = sqliteTable('field_reports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  coordinatorId: integer('coordinator_id')
    .notNull()
    .references(() => users.id),
  caseId: integer('case_id').references(() => humanitarianCases.id),
  locationId: integer('location_id')
    .notNull()
    .references(() => communityLocations.id),
  visitDate: text('visit_date').notNull(),
  summary: text('summary').notNull(),
  assistanceDelivered: text('assistance_delivered'),
  peopleReached: integer('people_reached').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

export const fieldActivities = sqliteTable('field_activities', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  reportId: integer('report_id')
    .notNull()
    .references(() => fieldReports.id, { onDelete: 'cascade' }),
  activityTitle: text('activity_title').notNull(),
  notes: text('notes'),
});

export const volunteerApplications = sqliteTable('volunteer_applications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  fullName: text('full_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  region: text('region').notNull(),
  skills: text('skills').notNull(),
  availability: text('availability').notNull(),
  motivation: text('motivation').notNull(),
  status: text('status').notNull().default('PENDING'),
  reviewedBy: integer('reviewed_by').references(() => users.id),
  createdAt: text('created_at').notNull(),
});

export const volunteers = sqliteTable('volunteers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  applicationId: integer('application_id').references(() => volunteerApplications.id),
  fullName: text('full_name').notNull(),
  email: text('email').notNull().unique(),
  region: text('region').notNull(),
  specialty: text('specialty').notNull(),
  status: text('status').notNull().default('ACTIVE'),
  joinedAt: text('joined_at').notNull(),
});

export const partnershipEnquiries = sqliteTable('partnership_enquiries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  organizationName: text('organization_name').notNull(),
  contactName: text('contact_name').notNull(),
  email: text('email').notNull(),
  organizationType: text('organization_type').notNull(),
  region: text('region').notNull(),
  proposalSummary: text('proposal_summary').notNull(),
  status: text('status').notNull().default('PENDING'),
  createdAt: text('created_at').notNull(),
});

export const partnerships = sqliteTable('partnerships', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  enquiryId: integer('enquiry_id').references(() => partnershipEnquiries.id),
  organizationName: text('organization_name').notNull(),
  organizationType: text('organization_type').notNull(),
  region: text('region').notNull(),
  focusArea: text('focus_area').notNull(),
  status: text('status').notNull().default('ACTIVE'),
  createdAt: text('created_at').notNull(),
});

export const notifications = sqliteTable(
  'notifications',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    userIdx: index('ix_notifications_user').on(table.userId),
  }),
);

export const announcements = sqliteTable('announcements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  body: text('body').notNull(),
  targetRole: text('target_role').notNull().default('ALL'),
  createdBy: integer('created_by')
    .notNull()
    .references(() => users.id),
  publishedAt: text('published_at').notNull(),
});

export const articleCategories = sqliteTable('article_categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
});

export const articles = sqliteTable(
  'articles',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    categoryId: integer('category_id')
      .notNull()
      .references(() => articleCategories.id),
    authorId: integer('author_id')
      .notNull()
      .references(() => users.id),
    summary: text('summary').notNull(),
    body: text('body').notNull(),
    coverImageUrl: text('cover_image_url'),
    status: text('status').notNull().default('DRAFT'),
    publishedAt: text('published_at').notNull(),
  },
  (table) => ({
    slugUnique: uniqueIndex('ux_articles_slug').on(table.slug),
  }),
);

export const cmsContent = sqliteTable(
  'cms_content',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    type: text('type').notNull(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    subtitle: text('subtitle'),
    summary: text('summary').notNull(),
    bodyJson: text('body_json').notNull(),
    category: text('category'),
    authorId: integer('author_id').notNull().references(() => users.id),
    authorDepartment: text('author_department'),
    location: text('location'),
    coverImageUrl: text('cover_image_url'),
    coverAltText: text('cover_alt_text'),
    tagsJson: text('tags_json'),
    attachmentsJson: text('attachments_json'),
    externalUrl: text('external_url'),
    status: text('status').notNull().default('DRAFT'),
    scheduledAt: text('scheduled_at'),
    publishedAt: text('published_at'),
    expiresAt: text('expires_at'),
    isFeatured: integer('is_featured', { mode: 'boolean' }).notNull().default(false),
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    deletedAt: text('deleted_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    typeSlugUnique: uniqueIndex('ux_cms_content_type_slug').on(table.type, table.slug),
    typeStatusIdx: index('ix_cms_content_type_status').on(table.type, table.status),
    publishedIdx: index('ix_cms_content_published_at').on(table.publishedAt),
    authorIdx: index('ix_cms_content_author').on(table.authorId),
  }),
);

export const contactMessages = sqliteTable('contact_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull(),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  status: text('status').notNull().default('NEW'),
  createdAt: text('created_at').notNull(),
});

// Governance & System
export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    actorUserId: integer('actor_user_id').references(() => users.id),
    actorRole: text('actor_role'),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id'),
    detailsJson: text('details_json'),
    ipAddress: text('ip_address'),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    actorIdx: index('ix_audit_actor').on(table.actorUserId),
    actionIdx: index('ix_audit_action').on(table.action),
  }),
);

export const consentRecords = sqliteTable('consent_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  subjectType: text('subject_type').notNull(),
  subjectId: integer('subject_id').notNull(),
  consentScope: text('consent_scope').notNull(),
  granted: integer('granted', { mode: 'boolean' }).notNull(),
  recordedBy: integer('recorded_by')
    .notNull()
    .references(() => users.id),
  withdrawnAt: text('withdrawn_at'),
  recordedAt: text('recorded_at').notNull(),
});

export const safeguardingReports = sqliteTable('safeguarding_reports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  subjectType: text('subject_type').notNull(),
  referenceCode: text('reference_code'),
  severity: text('severity').notNull(),
  description: text('description').notNull(),
  reporterEmail: text('reporter_email'),
  status: text('status').notNull().default('OPEN'),
  assignedAdminId: integer('assigned_admin_id').references(() => users.id),
  resolutionNotes: text('resolution_notes'),
  createdAt: text('created_at').notNull(),
});

export const privacyRequests = sqliteTable('privacy_requests', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  requesterEmail: text('requester_email').notNull(),
  requestType: text('request_type').notNull(),
  referenceCode: text('reference_code'),
  details: text('details').notNull(),
  status: text('status').notNull().default('OPEN'),
  handledBy: integer('handled_by').references(() => users.id),
  createdAt: text('created_at').notNull(),
});

export const moderationActions = sqliteTable('moderation_actions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  targetType: text('target_type').notNull(),
  targetId: integer('target_id').notNull(),
  actionType: text('action_type').notNull(),
  reason: text('reason').notNull(),
  moderatorId: integer('moderator_id')
    .notNull()
    .references(() => users.id),
  createdAt: text('created_at').notNull(),
});

export const systemSettings = sqliteTable('system_settings', {
  settingKey: text('setting_key').primaryKey(),
  settingValue: text('setting_value').notNull(),
  isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(false),
  updatedBy: integer('updated_by').references(() => users.id),
  updatedAt: text('updated_at').notNull(),
});

export const mediaFiles = sqliteTable('media_files', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  storageScope: text('storage_scope').notNull(),
  safeFilename: text('safe_filename').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  uploadedBy: integer('uploaded_by')
    .notNull()
    .references(() => users.id),
  altText: text('alt_text'),
  createdAt: text('created_at').notNull(),
});

export const bankTransferRecords = sqliteTable(
  'bank_transfer_records',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    caseId: integer('case_id').notNull().references(() => humanitarianCases.id),
    beneficiaryName: text('beneficiary_name').notNull(),
    bankName: text('bank_name').notNull(),
    bankReference: text('bank_reference').notNull(),
    amount: real('amount').notNull(),
    currency: text('currency').notNull(),
    transferDate: text('transfer_date').notNull(),
    recipientAccountLast4: text('recipient_account_last4'),
    purpose: text('purpose').notNull(),
    notes: text('notes').notNull(),
    evidenceMediaId: integer('evidence_media_id').notNull().references(() => mediaFiles.id),
    status: text('status').notNull().default('PENDING_REVIEW'),
    recordedBy: integer('recorded_by').notNull().references(() => users.id),
    verifiedBy: integer('verified_by').references(() => users.id),
    verificationNotes: text('verification_notes'),
    receiptNumber: text('receipt_number'),
    verifiedAt: text('verified_at'),
    receiptIssuedAt: text('receipt_issued_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    bankReferenceUnique: uniqueIndex('ux_bank_transfer_reference').on(table.bankName, table.bankReference),
    receiptUnique: uniqueIndex('ux_bank_transfer_receipt').on(table.receiptNumber),
    statusIdx: index('ix_bank_transfer_status').on(table.status),
    caseIdx: index('ix_bank_transfer_case').on(table.caseId),
  }),
);

export const activityLogs = sqliteTable('activity_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id),
  summary: text('summary').notNull(),
  createdAt: text('created_at').notNull(),
});

export const backupRecords = sqliteTable('backup_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  backupType: text('backup_type').notNull(),
  status: text('status').notNull(),
  locationLabel: text('location_label').notNull(),
  recordedAt: text('recorded_at').notNull(),
});
