import {
  mysqlTable,
  bigint,
  varchar,
  text,
  boolean,
  timestamp,
  int,
  foreignKey,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';
import { users } from './identity';

export const documentTypes = mysqlTable(
  'document_types',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    typeCode: varchar('type_code', { length: 32 }).notNull(),
    displayName: varchar('display_name', { length: 120 }).notNull(),
    referencePrefix: varchar('reference_prefix', { length: 24 }).notNull(),
    isApproved: boolean('is_approved').notNull().default(false),
    requiresApproval: boolean('requires_approval').notNull().default(true),
    publicVerification: boolean('public_verification').notNull().default(false),
    publicRecipient: boolean('public_recipient').notNull().default(false),
    createdBy: bigint('created_by', { mode: 'number', unsigned: true }).notNull().references(() => users.id),
    updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }).notNull().references(() => users.id),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => ({
    codeUnique: uniqueIndex('ux_document_types_code').on(table.typeCode),
    prefixUnique: uniqueIndex('ux_document_types_prefix').on(table.referencePrefix),
    approvedIdx: index('ix_document_types_approved').on(table.isApproved),
  }),
);

export const documentSequences = mysqlTable(
  'document_sequences',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    referencePrefix: varchar('reference_prefix', { length: 24 }).notNull(),
    sequenceYear: int('sequence_year').notNull(),
    nextNumber: int('next_number').notNull().default(1),
    updatedAt: timestamp('updated_at', { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => ({
    prefixYearUnique: uniqueIndex('ux_document_sequence_prefix_year').on(table.referencePrefix, table.sequenceYear),
  }),
);

export const documentTemplates = mysqlTable(
  'document_templates',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    documentTypeId: bigint('document_type_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => documentTypes.id),
    name: varchar('name', { length: 120 }).notNull(),
    isActive: boolean('is_active').notNull().default(false),
    currentVersion: int('current_version').notNull().default(1),
    createdBy: bigint('created_by', { mode: 'number', unsigned: true }).notNull().references(() => users.id),
    updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }).notNull().references(() => users.id),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => ({
    typeIdx: index('ix_document_templates_type').on(table.documentTypeId),
    activeIdx: index('ix_document_templates_active').on(table.isActive),
  }),
);

export const documentTemplateVersions = mysqlTable(
  'document_template_versions',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    templateId: bigint('template_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => documentTemplates.id),
    versionNumber: int('version_number').notNull(),
    configurationJson: text('configuration_json').notNull(),
    createdBy: bigint('created_by', { mode: 'number', unsigned: true }).notNull().references(() => users.id),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => ({
    versionUnique: uniqueIndex('ux_document_template_version').on(table.templateId, table.versionNumber),
    templateIdx: index('ix_document_template_versions_template').on(table.templateId),
  }),
);

export const documentOrganisationProfiles = mysqlTable(
  'document_organisation_profiles',
  {
    id: int('id').primaryKey(),
    officialName: varchar('official_name', { length: 180 }),
    registeredAddress: varchar('registered_address', { length: 500 }),
    country: varchar('country', { length: 120 }),
    telephone: varchar('telephone', { length: 80 }),
    email: varchar('email', { length: 255 }),
    website: varchar('website', { length: 255 }),
    registrationInformation: varchar('registration_information', { length: 255 }),
    approvedTagline: varchar('approved_tagline', { length: 255 }),
    issuingDepartment: varchar('issuing_department', { length: 160 }),
    footerDisclaimer: varchar('footer_disclaimer', { length: 500 }),
    logoStorageKey: varchar('logo_storage_key', { length: 255 }),
    updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }).references(() => users.id),
    updatedAt: timestamp('updated_at', { fsp: 3 }).defaultNow().notNull(),
  },
);

export const documentSignatories = mysqlTable(
  'document_signatories',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    fullName: varchar('full_name', { length: 180 }).notNull(),
    position: varchar('position', { length: 160 }).notNull(),
    department: varchar('department', { length: 160 }),
    authorisedTypeCodesJson: text('authorised_type_codes_json').notNull(),
    isAuthorised: boolean('is_authorised').notNull().default(false),
    validFrom: timestamp('valid_from', { fsp: 3 }),
    validUntil: timestamp('valid_until', { fsp: 3 }),
    createdBy: bigint('created_by', { mode: 'number', unsigned: true }).notNull().references(() => users.id),
    updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }).notNull().references(() => users.id),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => ({
    authorisedIdx: index('ix_document_signatories_authorised').on(table.isAuthorised),
  }),
);

export const documentEditorDrafts = mysqlTable(
  'document_editor_drafts',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    title: varchar('title', { length: 180 }).notNull(),
    contentJson: text('content_json').notNull(),
    pageSettingsJson: text('page_settings_json').notNull(),
    createdBy: bigint('created_by', { mode: 'number', unsigned: true }).notNull().references(() => users.id),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => ({
    creatorIdx: index('ix_document_editor_drafts_creator').on(table.createdBy),
    updatedIdx: index('ix_document_editor_drafts_updated').on(table.updatedAt),
  }),
);

export const issuedDocuments = mysqlTable(
  'issued_documents',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    referenceCode: varchar('reference_code', { length: 80 }),
    documentTypeId: bigint('document_type_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => documentTypes.id),
    templateVersionId: bigint('template_version_id', { mode: 'number', unsigned: true })
      .notNull(),
    status: varchar('status', { length: 32 }).notNull().default('DRAFT'),
    recipientName: varchar('recipient_name', { length: 180 }).notNull(),
    subject: varchar('subject', { length: 240 }).notNull(),
    payloadJson: text('payload_json').notNull(),
    contentJson: text('content_json'),
    organisationSnapshotJson: text('organisation_snapshot_json'),
    publicRecipientName: varchar('public_recipient_name', { length: 180 }),
    storageKey: varchar('storage_key', { length: 255 }),
    pdfSha256: varchar('pdf_sha256', { length: 64 }),
    createdBy: bigint('created_by', { mode: 'number', unsigned: true }).notNull().references(() => users.id),
    approvedBy: bigint('approved_by', { mode: 'number', unsigned: true }).references(() => users.id),
    issuedBy: bigint('issued_by', { mode: 'number', unsigned: true }).references(() => users.id),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
    issuedAt: timestamp('issued_at', { fsp: 3 }),
    expiresAt: timestamp('expires_at', { fsp: 3 }),
    revokedAt: timestamp('revoked_at', { fsp: 3 }),
    archivedAt: timestamp('archived_at', { fsp: 3 }),
  },
  (table) => ({
    templateVersionFk: foreignKey({
      name: 'issued_documents_template_version_fk',
      columns: [table.templateVersionId],
      foreignColumns: [documentTemplateVersions.id],
    }),
    referenceUnique: uniqueIndex('ux_issued_documents_reference').on(table.referenceCode),
    typeIdx: index('ix_issued_documents_type').on(table.documentTypeId),
    statusIdx: index('ix_issued_documents_status').on(table.status),
    recipientIdx: index('ix_issued_documents_recipient').on(table.recipientName),
    issuedIdx: index('ix_issued_documents_issued_at').on(table.issuedAt),
    creatorIdx: index('ix_issued_documents_creator').on(table.createdBy),
  }),
);

export const documentStatusHistory = mysqlTable(
  'document_status_history',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    documentId: bigint('document_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => issuedDocuments.id),
    previousStatus: varchar('previous_status', { length: 32 }),
    newStatus: varchar('new_status', { length: 32 }).notNull(),
    reason: varchar('reason', { length: 500 }),
    changedBy: bigint('changed_by', { mode: 'number', unsigned: true }).notNull().references(() => users.id),
    changedAt: timestamp('changed_at', { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => ({
    documentIdx: index('ix_document_status_history_document').on(table.documentId),
  }),
);

export const documentVerificationEvents = mysqlTable(
  'document_verification_events',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    documentId: bigint('document_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => issuedDocuments.id),
    verifiedAt: timestamp('verified_at', { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => ({
    documentIdx: index('ix_document_verifications_document').on(table.documentId),
    verifiedIdx: index('ix_document_verifications_time').on(table.verifiedAt),
  }),
);
