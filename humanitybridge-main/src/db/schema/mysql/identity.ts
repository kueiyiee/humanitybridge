import {
  mysqlTable,
  bigint,
  varchar,
  text,
  boolean,
  timestamp,
  int,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';

export const roles = mysqlTable('roles', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  code: varchar('code', { length: 48 }).notNull().unique(),
  displayName: varchar('display_name', { length: 120 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
});

export const permissions = mysqlTable('permissions', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  roleCode: varchar('role_code', { length: 48 }).notNull(),
  permissionKey: varchar('permission_key', { length: 120 }).notNull(),
  description: varchar('description', { length: 255 }),
});

export const users = mysqlTable(
  'users',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    role: varchar('role', { length: 48 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
    emailVerified: boolean('email_verified').notNull().default(false),
    mfaEnabled: boolean('mfa_enabled').notNull().default(false),
    lastLoginAt: timestamp('last_login_at', { fsp: 3 }),
    deletedAt: timestamp('deleted_at', { fsp: 3 }),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => ({
    emailUnique: uniqueIndex('ux_users_email').on(table.email),
    roleIdx: index('ix_users_role').on(table.role),
  }),
);

export const userProfiles = mysqlTable('user_profiles', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  userId: bigint('user_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  displayName: varchar('display_name', { length: 120 }).notNull(),
  region: varchar('region', { length: 120 }),
  organization: varchar('organization', { length: 160 }),
  bio: text('bio'),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  preferredLanguage: varchar('preferred_language', { length: 16 }).notNull().default('en'),
  createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { fsp: 3 }).defaultNow().notNull(),
});

export const userSessions = mysqlTable(
  'user_sessions',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    sessionTokenHash: varchar('session_token_hash', { length: 128 }).notNull(),
    userId: bigint('user_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: varchar('user_agent', { length: 300 }),
    expiresAt: timestamp('expires_at', { fsp: 3 }).notNull(),
    revokedAt: timestamp('revoked_at', { fsp: 3 }),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => ({
    tokenUnique: uniqueIndex('ux_sessions_token').on(table.sessionTokenHash),
    userIdx: index('ix_sessions_user').on(table.userId),
  }),
);

export const passwordResetTokens = mysqlTable('password_reset_tokens', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  userId: bigint('user_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 128 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { fsp: 3 }).notNull(),
  usedAt: timestamp('used_at', { fsp: 3 }),
  createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
});

export const emailVerificationTokens = mysqlTable('email_verification_tokens', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  userId: bigint('user_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 128 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { fsp: 3 }).notNull(),
  verifiedAt: timestamp('verified_at', { fsp: 3 }),
  createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
});

export const mfaSettings = mysqlTable('mfa_settings', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  userId: bigint('user_id', { mode: 'number', unsigned: true })
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  totpSecret: varchar('totp_secret', { length: 128 }).notNull(),
  backupCodesHash: text('backup_codes_hash'),
  enabled: boolean('enabled').notNull().default(false),
  updatedAt: timestamp('updated_at', { fsp: 3 }).defaultNow().notNull(),
});

export const loginAttempts = mysqlTable(
  'login_attempts',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    email: varchar('email', { length: 255 }).notNull(),
    ipAddress: varchar('ip_address', { length: 64 }),
    success: boolean('success').notNull(),
    reason: varchar('reason', { length: 120 }),
    attemptedAt: timestamp('attempted_at', { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index('ix_login_attempts_email').on(table.email),
  }),
);
