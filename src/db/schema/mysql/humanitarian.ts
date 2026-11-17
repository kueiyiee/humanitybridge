import {
  mysqlTable,
  bigint,
  varchar,
  text,
  boolean,
  timestamp,
  int,
  decimal,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';
import { users } from './identity';
import { mediaFiles } from './governance';

export const caseCategories = mysqlTable('case_categories', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  slug: varchar('slug', { length: 80 }).notNull().unique(),
  name: varchar('name', { length: 120 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
});

export const communityLocations = mysqlTable('community_locations', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  regionName: varchar('region_name', { length: 120 }).notNull(),
  country: varchar('country', { length: 120 }).notNull(),
  approximateLat: decimal('approximate_lat', { precision: 9, scale: 6 }),
  approximateLng: decimal('approximate_lng', { precision: 9, scale: 6 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
});

export const humanitarianCases = mysqlTable(
  'humanitarian_cases',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    referenceCode: varchar('reference_code', { length: 48 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    categoryId: bigint('category_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => caseCategories.id),
    locationId: bigint('location_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => communityLocations.id),
    coordinatorId: bigint('coordinator_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => users.id),
    publicSummary: text('public_summary').notNull(),
    assistanceNeeded: text('assistance_needed').notNull(),
    affectedCount: int('affected_count').notNull().default(1),
    urgencyLevel: varchar('urgency_level', { length: 24 }).notNull().default('MEDIUM'),
    estimatedCostUsd: decimal('estimated_cost_usd', { precision: 12, scale: 2 }).default('0.00'),
    status: varchar('status', { length: 32 }).notNull().default('SUBMITTED'),
    isPublic: boolean('is_public').notNull().default(false),
    isChildRelated: boolean('is_child_related').notNull().default(false),
    guardianConsentObtained: boolean('guardian_consent_obtained').notNull().default(false),
    beneficiaryConsentObtained: boolean('beneficiary_consent_obtained').notNull().default(false),
    privateContactName: varchar('private_contact_name', { length: 120 }).notNull(),
    privateContactPhone: varchar('private_contact_phone', { length: 64 }).notNull(),
    beneficiaryFullName: varchar('beneficiary_full_name', { length: 120 }).notNull(),
    beneficiaryAgeBand: varchar('beneficiary_age_band', { length: 24 }).notNull().default('UNKNOWN'),
    beneficiaryGender: varchar('beneficiary_gender', { length: 24 }).notNull().default('UNKNOWN'),
    householdSize: int('household_size').notNull().default(1),
    beneficiaryPreferredLanguage: varchar('beneficiary_preferred_language', { length: 60 }),
    beneficiaryNeedsNotes: text('beneficiary_needs_notes'),
    privateLocationNotes: text('private_location_notes').notNull(),
    internalAdminNotes: text('internal_admin_notes'),
    verifiedBy: bigint('verified_by', { mode: 'number', unsigned: true }).references(() => users.id),
    verifiedAt: timestamp('verified_at', { fsp: 3 }),
    deletedAt: timestamp('deleted_at', { fsp: 3 }),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => ({
    refUnique: uniqueIndex('ux_cases_reference').on(table.referenceCode),
    statusIdx: index('ix_cases_status').on(table.status),
    coordIdx: index('ix_cases_coordinator').on(table.coordinatorId),
  }),
);

export const caseRequirements = mysqlTable('case_requirements', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  caseId: bigint('case_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => humanitarianCases.id, { onDelete: 'cascade' }),
  itemLabel: varchar('item_label', { length: 180 }).notNull(),
  quantity: int('quantity').notNull().default(1),
  estimatedUnitCostUsd: decimal('estimated_unit_cost_usd', { precision: 12, scale: 2 }).default('0.00'),
  fulfilled: boolean('fulfilled').notNull().default(false),
});

export const caseDocuments = mysqlTable('case_documents', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  caseId: bigint('case_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => humanitarianCases.id, { onDelete: 'cascade' }),
  uploadedBy: bigint('uploaded_by', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => users.id),
  documentType: varchar('document_type', { length: 64 }).notNull(),
  storageKey: varchar('storage_key', { length: 255 }).notNull(),
  originalFilename: varchar('original_filename', { length: 255 }).notNull(),
  isConfidential: boolean('is_confidential').notNull().default(true),
  createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
});

export const caseVerifications = mysqlTable('case_verifications', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  caseId: bigint('case_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => humanitarianCases.id, { onDelete: 'cascade' }),
  reviewerId: bigint('reviewer_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => users.id),
  decision: varchar('decision', { length: 32 }).notNull(),
  notes: text('notes').notNull(),
  publishPublicly: boolean('publish_publicly').notNull().default(false),
  decidedAt: timestamp('decided_at', { fsp: 3 }).defaultNow().notNull(),
});

export const caseStatusHistory = mysqlTable('case_status_history', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  caseId: bigint('case_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => humanitarianCases.id, { onDelete: 'cascade' }),
  previousStatus: varchar('previous_status', { length: 32 }),
  newStatus: varchar('new_status', { length: 32 }).notNull(),
  changedBy: bigint('changed_by', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => users.id),
  reason: text('reason'),
  changedAt: timestamp('changed_at', { fsp: 3 }).defaultNow().notNull(),
});

export const assistanceRequests = mysqlTable('assistance_requests', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  caseId: bigint('case_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => humanitarianCases.id, { onDelete: 'cascade' }),
  coordinatorId: bigint('coordinator_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => users.id),
  supportType: varchar('support_type', { length: 120 }).notNull(),
  requestedAmountUsd: decimal('requested_amount_usd', { precision: 12, scale: 2 }).notNull().default('0.00'),
  justification: text('justification').notNull(),
  status: varchar('status', { length: 32 }).notNull().default('SUBMITTED'),
  adminFeedback: text('admin_feedback'),
  createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { fsp: 3 }).defaultNow().notNull(),
});

export const assistanceDistributions = mysqlTable('assistance_distributions', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  caseId: bigint('case_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => humanitarianCases.id),
  requestId: bigint('request_id', { mode: 'number', unsigned: true }).references(() => assistanceRequests.id),
  amountUsd: decimal('amount_usd', { precision: 12, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  approvedBy: bigint('approved_by', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => users.id),
  distributionNotes: text('distribution_notes').notNull(),
  distributedAt: timestamp('distributed_at', { fsp: 3 }).defaultNow().notNull(),
});

export const bankTransferRecords = mysqlTable(
  'bank_transfer_records',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    caseId: bigint('case_id', { mode: 'number', unsigned: true }).notNull().references(() => humanitarianCases.id),
    beneficiaryName: varchar('beneficiary_name', { length: 120 }).notNull(),
    bankName: varchar('bank_name', { length: 120 }).notNull(),
    bankReference: varchar('bank_reference', { length: 120 }).notNull(),
    amount: decimal('amount', { precision: 14, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    transferDate: timestamp('transfer_date', { fsp: 3 }).notNull(),
    recipientAccountLast4: varchar('recipient_account_last4', { length: 4 }),
    purpose: varchar('purpose', { length: 180 }).notNull(),
    notes: text('notes').notNull(),
    evidenceMediaId: bigint('evidence_media_id', { mode: 'number', unsigned: true }).notNull().references(() => mediaFiles.id),
    status: varchar('status', { length: 24 }).notNull().default('PENDING_REVIEW'),
    recordedBy: bigint('recorded_by', { mode: 'number', unsigned: true }).notNull().references(() => users.id),
    verifiedBy: bigint('verified_by', { mode: 'number', unsigned: true }).references(() => users.id),
    verificationNotes: text('verification_notes'),
    receiptNumber: varchar('receipt_number', { length: 48 }),
    verifiedAt: timestamp('verified_at', { fsp: 3 }),
    receiptIssuedAt: timestamp('receipt_issued_at', { fsp: 3 }),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => ({
    bankReferenceUnique: uniqueIndex('ux_bank_transfer_reference').on(table.bankName, table.bankReference),
    receiptUnique: uniqueIndex('ux_bank_transfer_receipt').on(table.receiptNumber),
    statusIdx: index('ix_bank_transfer_status').on(table.status),
    caseIdx: index('ix_bank_transfer_case').on(table.caseId),
  }),
);
