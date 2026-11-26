import {
  mysqlTable,
  bigint,
  varchar,
  text,
  boolean,
  timestamp,
  decimal,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';
import { users } from './identity';
import { humanitarianCases } from './humanitarian';

export const campaigns = mysqlTable(
  'campaigns',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    slug: varchar('slug', { length: 180 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    summary: text('summary').notNull(),
    description: text('description').notNull(),
    targetAmount: decimal('target_amount', { precision: 14, scale: 2 }).notNull(),
    raisedAmount: decimal('raised_amount', { precision: 14, scale: 2 }).notNull().default('0.00'),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    coverImageUrl: varchar('cover_image_url', { length: 500 }),
    status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
    startDate: timestamp('start_date', { fsp: 3 }).notNull(),
    endDate: timestamp('end_date', { fsp: 3 }).notNull(),
    createdBy: bigint('created_by', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => users.id),
    deletedAt: timestamp('deleted_at', { fsp: 3 }),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => ({
    slugUnique: uniqueIndex('ux_campaigns_slug').on(table.slug),
    statusIdx: index('ix_campaigns_status').on(table.status),
  }),
);

export const campaignCases = mysqlTable('campaign_cases', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  campaignId: bigint('campaign_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  caseId: bigint('case_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => humanitarianCases.id, { onDelete: 'cascade' }),
});

export const donations = mysqlTable(
  'donations',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    donationReference: varchar('donation_reference', { length: 64 }).notNull(),
    campaignId: bigint('campaign_id', { mode: 'number', unsigned: true }).references(() => campaigns.id),
    caseId: bigint('case_id', { mode: 'number', unsigned: true }).references(() => humanitarianCases.id),
    amount: decimal('amount', { precision: 14, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    donorName: varchar('donor_name', { length: 120 }).notNull(),
    donorEmail: varchar('donor_email', { length: 255 }).notNull(),
    isAnonymous: boolean('is_anonymous').notNull().default(false),
    dedicationNote: varchar('dedication_note', { length: 300 }),
    status: varchar('status', { length: 32 }).notNull().default('INITIATED'),
    paymentChannel: varchar('payment_channel', { length: 48 }).notNull(),
    confirmedAt: timestamp('confirmed_at', { fsp: 3 }),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => ({
    refUnique: uniqueIndex('ux_donations_reference').on(table.donationReference),
    statusIdx: index('ix_donations_status').on(table.status),
  }),
);

export const paymentTransactions = mysqlTable(
  'payment_transactions',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    donationId: bigint('donation_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => donations.id),
    provider: varchar('provider', { length: 64 }).notNull(),
    providerReference: varchar('provider_reference', { length: 128 }).notNull(),
    amount: decimal('amount', { precision: 14, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    status: varchar('status', { length: 32 }).notNull(),
    verifiedByWebhook: boolean('verified_by_webhook').notNull().default(false),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => ({
    providerRefUnique: uniqueIndex('ux_payment_provider_ref').on(table.providerReference),
  }),
);

export const paymentWebhookEvents = mysqlTable(
  'payment_webhook_events',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    eventId: varchar('event_id', { length: 128 }).notNull(),
    provider: varchar('provider', { length: 64 }).notNull(),
    signatureValid: boolean('signature_valid').notNull(),
    payloadHash: varchar('payload_hash', { length: 128 }).notNull(),
    processedAt: timestamp('processed_at', { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => ({
    eventUnique: uniqueIndex('ux_webhook_event_id').on(table.eventId),
  }),
);

export const refunds = mysqlTable('refunds', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  donationId: bigint('donation_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => donations.id),
  amount: decimal('amount', { precision: 14, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  reason: text('reason').notNull(),
  approvedBy: bigint('approved_by', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => users.id),
  status: varchar('status', { length: 32 }).notNull().default('COMPLETED'),
  createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
});

export const financialRecords = mysqlTable('financial_records', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  entryType: varchar('entry_type', { length: 32 }).notNull(),
  referenceCode: varchar('reference_code', { length: 64 }).notNull(),
  amount: decimal('amount', { precision: 14, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  campaignId: bigint('campaign_id', { mode: 'number', unsigned: true }).references(() => campaigns.id),
  caseId: bigint('case_id', { mode: 'number', unsigned: true }).references(() => humanitarianCases.id),
  description: text('description').notNull(),
  recordedAt: timestamp('recorded_at', { fsp: 3 }).defaultNow().notNull(),
});

export const financialReconciliations = mysqlTable('financial_reconciliations', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  donationId: bigint('donation_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => donations.id),
  reconciledBy: bigint('reconciled_by', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => users.id),
  reconciliationNote: text('reconciliation_note').notNull(),
  externalLedgerRef: varchar('external_ledger_ref', { length: 128 }).notNull(),
  reconciledAt: timestamp('reconciled_at', { fsp: 3 }).defaultNow().notNull(),
});
