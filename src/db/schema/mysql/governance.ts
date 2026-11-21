import {
  mysqlTable,
  bigint,
  varchar,
  text,
  boolean,
  timestamp,
  int,
  index,
} from 'drizzle-orm/mysql-core';
import { users } from './identity';

export const auditLogs = mysqlTable(
  'audit_logs',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    actorUserId: bigint('actor_user_id', { mode: 'number', unsigned: true }).references(() => users.id),
    actorRole: varchar('actor_role', { length: 48 }),
    action: varchar('action', { length: 120 }).notNull(),
    resourceType: varchar('resource_type', { length: 80 }).notNull(),
    resourceId: varchar('resource_id', { length: 80 }),
    detailsJson: text('details_json'),
    ipAddress: varchar('ip_address', { length: 64 }),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => ({
    actorIdx: index('ix_audit_actor').on(table.actorUserId),
    actionIdx: index('ix_audit_action').on(table.action),
  }),
);

export const consentRecords = mysqlTable('consent_records', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  subjectType: varchar('subject_type', { length: 48 }).notNull(),
  subjectId: bigint('subject_id', { mode: 'number', unsigned: true }).notNull(),
  consentScope: varchar('consent_scope', { length: 120 }).notNull(),
  granted: boolean('granted').notNull(),
  recordedBy: bigint('recorded_by', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => users.id),
  withdrawnAt: timestamp('withdrawn_at', { fsp: 3 }),
  recordedAt: timestamp('recorded_at', { fsp: 3 }).defaultNow().notNull(),
});

export const safeguardingReports = mysqlTable('safeguarding_reports', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  subjectType: varchar('subject_type', { length: 48 }).notNull(),
  referenceCode: varchar('reference_code', { length: 80 }),
  severity: varchar('severity', { length: 24 }).notNull(),
  description: text('description').notNull(),
  reporterEmail: varchar('reporter_email', { length: 255 }),
  status: varchar('status', { length: 32 }).notNull().default('OPEN'),
  assignedAdminId: bigint('assigned_admin_id', { mode: 'number', unsigned: true }).references(() => users.id),
  resolutionNotes: text('resolution_notes'),
  createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
});

export const privacyRequests = mysqlTable('privacy_requests', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  requesterEmail: varchar('requester_email', { length: 255 }).notNull(),
  requestType: varchar('request_type', { length: 48 }).notNull(),
  referenceCode: varchar('reference_code', { length: 80 }),
  details: text('details').notNull(),
  status: varchar('status', { length: 32 }).notNull().default('OPEN'),
  handledBy: bigint('handled_by', { mode: 'number', unsigned: true }).references(() => users.id),
  createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
});

export const moderationActions = mysqlTable('moderation_actions', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  targetType: varchar('target_type', { length: 48 }).notNull(),
  targetId: bigint('target_id', { mode: 'number', unsigned: true }).notNull(),
  actionType: varchar('action_type', { length: 48 }).notNull(),
  reason: text('reason').notNull(),
  moderatorId: bigint('moderator_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
});

export const systemSettings = mysqlTable('system_settings', {
  settingKey: varchar('setting_key', { length: 120 }).primaryKey(),
  settingValue: text('setting_value').notNull(),
  isPublic: boolean('is_public').notNull().default(false),
  updatedBy: bigint('updated_by', { mode: 'number', unsigned: true }).references(() => users.id),
  updatedAt: timestamp('updated_at', { fsp: 3 }).defaultNow().notNull(),
});

export const mediaFiles = mysqlTable('media_files', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  storageScope: varchar('storage_scope', { length: 24 }).notNull(),
  safeFilename: varchar('safe_filename', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 120 }).notNull(),
  sizeBytes: int('size_bytes').notNull(),
  uploadedBy: bigint('uploaded_by', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => users.id),
  altText: varchar('alt_text', { length: 255 }),
  createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
});

export const activityLogs = mysqlTable('activity_logs', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  userId: bigint('user_id', { mode: 'number', unsigned: true }).references(() => users.id),
  summary: varchar('summary', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
});

export const backupRecords = mysqlTable('backup_records', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  backupType: varchar('backup_type', { length: 48 }).notNull(),
  status: varchar('status', { length: 32 }).notNull(),
  locationLabel: varchar('location_label', { length: 255 }).notNull(),
  recordedAt: timestamp('recorded_at', { fsp: 3 }).defaultNow().notNull(),
});
