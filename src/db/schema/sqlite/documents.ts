import { sqliteTable, integer, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { users } from './index';

export const documentTypes = sqliteTable(
  'document_types',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    typeCode: text('type_code').notNull(),
    displayName: text('display_name').notNull(),
    referencePrefix: text('reference_prefix').notNull(),
    isApproved: integer('is_approved', { mode: 'boolean' }).notNull().default(false),
    requiresApproval: integer('requires_approval', { mode: 'boolean' }).notNull().default(true),
    publicVerification: integer('public_verification', { mode: 'boolean' }).notNull().default(false),
    publicRecipient: integer('public_recipient', { mode: 'boolean' }).notNull().default(false),
    createdBy: integer('created_by').notNull().references(() => users.id),
    updatedBy: integer('updated_by').notNull().references(() => users.id),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    codeUnique: uniqueIndex('ux_document_types_code').on(table.typeCode),
    prefixUnique: uniqueIndex('ux_document_types_prefix').on(table.referencePrefix),
    approvedIdx: index('ix_document_types_approved').on(table.isApproved),
  }),
);

export const documentSequences = sqliteTable(
  'document_sequences',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    referencePrefix: text('reference_prefix').notNull(),
    sequenceYear: integer('sequence_year').notNull(),
    nextNumber: integer('next_number').notNull().default(1),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    prefixYearUnique: uniqueIndex('ux_document_sequence_prefix_year').on(table.referencePrefix, table.sequenceYear),
  }),
);

export const documentTemplates = sqliteTable(
  'document_templates',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    documentTypeId: integer('document_type_id').notNull().references(() => documentTypes.id),
    name: text('name').notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
    currentVersion: integer('current_version').notNull().default(1),
    createdBy: integer('created_by').notNull().references(() => users.id),
    updatedBy: integer('updated_by').notNull().references(() => users.id),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    typeIdx: index('ix_document_templates_type').on(table.documentTypeId),
    activeIdx: index('ix_document_templates_active').on(table.isActive),
  }),
);

export const documentTemplateVersions = sqliteTable(
  'document_template_versions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    templateId: integer('template_id').notNull().references(() => documentTemplates.id),
    versionNumber: integer('version_number').notNull(),
    configurationJson: text('configuration_json').notNull(),
    createdBy: integer('created_by').notNull().references(() => users.id),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    versionUnique: uniqueIndex('ux_document_template_version').on(table.templateId, table.versionNumber),
    templateIdx: index('ix_document_template_versions_template').on(table.templateId),
  }),
);

export const documentOrganisationProfiles = sqliteTable('document_organisation_profiles', {
  id: integer('id').primaryKey(),
  officialName: text('official_name'),
  registeredAddress: text('registered_address'),
  country: text('country'),
  telephone: text('telephone'),
  email: text('email'),
  website: text('website'),
  registrationInformation: text('registration_information'),
  approvedTagline: text('approved_tagline'),
  issuingDepartment: text('issuing_department'),
  footerDisclaimer: text('footer_disclaimer'),
  logoStorageKey: text('logo_storage_key'),
  updatedBy: integer('updated_by').references(() => users.id),
  updatedAt: text('updated_at').notNull(),
});

export const documentSignatories = sqliteTable(
  'document_signatories',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    fullName: text('full_name').notNull(),
    position: text('position').notNull(),
    department: text('department'),
    authorisedTypeCodesJson: text('authorised_type_codes_json').notNull(),
    isAuthorised: integer('is_authorised', { mode: 'boolean' }).notNull().default(false),
    validFrom: text('valid_from'),
    validUntil: text('valid_until'),
    createdBy: integer('created_by').notNull().references(() => users.id),
    updatedBy: integer('updated_by').notNull().references(() => users.id),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    authorisedIdx: index('ix_document_signatories_authorised').on(table.isAuthorised),
  }),
);

export const documentEditorDrafts = sqliteTable(
  'document_editor_drafts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    title: text('title').notNull(),
    contentJson: text('content_json').notNull(),
    pageSettingsJson: text('page_settings_json').notNull(),
    createdBy: integer('created_by').notNull().references(() => users.id),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    creatorIdx: index('ix_document_editor_drafts_creator').on(table.createdBy),
    updatedIdx: index('ix_document_editor_drafts_updated').on(table.updatedAt),
  }),
);

export const issuedDocuments = sqliteTable(
  'issued_documents',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    referenceCode: text('reference_code'),
    documentTypeId: integer('document_type_id').notNull().references(() => documentTypes.id),
    templateVersionId: integer('template_version_id').notNull().references(() => documentTemplateVersions.id),
    status: text('status').notNull().default('DRAFT'),
    recipientName: text('recipient_name').notNull(),
    subject: text('subject').notNull(),
    payloadJson: text('payload_json').notNull(),
    contentJson: text('content_json'),
    organisationSnapshotJson: text('organisation_snapshot_json'),
    publicRecipientName: text('public_recipient_name'),
    storageKey: text('storage_key'),
    pdfSha256: text('pdf_sha256'),
    createdBy: integer('created_by').notNull().references(() => users.id),
    approvedBy: integer('approved_by').references(() => users.id),
    issuedBy: integer('issued_by').references(() => users.id),
    createdAt: text('created_at').notNull(),
    issuedAt: text('issued_at'),
    expiresAt: text('expires_at'),
    revokedAt: text('revoked_at'),
    archivedAt: text('archived_at'),
  },
  (table) => ({
    referenceUnique: uniqueIndex('ux_issued_documents_reference').on(table.referenceCode),
    typeIdx: index('ix_issued_documents_type').on(table.documentTypeId),
    statusIdx: index('ix_issued_documents_status').on(table.status),
    recipientIdx: index('ix_issued_documents_recipient').on(table.recipientName),
    issuedIdx: index('ix_issued_documents_issued_at').on(table.issuedAt),
    creatorIdx: index('ix_issued_documents_creator').on(table.createdBy),
  }),
);

export const documentStatusHistory = sqliteTable(
  'document_status_history',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    documentId: integer('document_id').notNull().references(() => issuedDocuments.id),
    previousStatus: text('previous_status'),
    newStatus: text('new_status').notNull(),
    reason: text('reason'),
    changedBy: integer('changed_by').notNull().references(() => users.id),
    changedAt: text('changed_at').notNull(),
  },
  (table) => ({
    documentIdx: index('ix_document_status_history_document').on(table.documentId),
  }),
);

export const documentVerificationEvents = sqliteTable(
  'document_verification_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    documentId: integer('document_id').notNull().references(() => issuedDocuments.id),
    verifiedAt: text('verified_at').notNull(),
  },
  (table) => ({
    documentIdx: index('ix_document_verifications_document').on(table.documentId),
    verifiedIdx: index('ix_document_verifications_time').on(table.verifiedAt),
  }),
);
