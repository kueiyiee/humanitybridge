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
import { users } from './identity';
import { communityLocations, humanitarianCases } from './humanitarian';

export const fieldReports = mysqlTable('field_reports', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  coordinatorId: bigint('coordinator_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => users.id),
  caseId: bigint('case_id', { mode: 'number', unsigned: true }).references(() => humanitarianCases.id),
  locationId: bigint('location_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => communityLocations.id),
  visitDate: timestamp('visit_date', { fsp: 3 }).notNull(),
  summary: text('summary').notNull(),
  assistanceDelivered: text('assistance_delivered'),
  peopleReached: int('people_reached').notNull().default(0),
  createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
});

export const fieldActivities = mysqlTable('field_activities', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  reportId: bigint('report_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => fieldReports.id, { onDelete: 'cascade' }),
  activityTitle: varchar('activity_title', { length: 180 }).notNull(),
  notes: text('notes'),
});

export const volunteerApplications = mysqlTable('volunteer_applications', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  fullName: varchar('full_name', { length: 120 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 48 }).notNull(),
  region: varchar('region', { length: 120 }).notNull(),
  skills: text('skills').notNull(),
  availability: varchar('availability', { length: 200 }).notNull(),
  motivation: text('motivation').notNull(),
  status: varchar('status', { length: 32 }).notNull().default('PENDING'),
  reviewedBy: bigint('reviewed_by', { mode: 'number', unsigned: true }).references(() => users.id),
  createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
});

export const volunteers = mysqlTable('volunteers', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  applicationId: bigint('application_id', { mode: 'number', unsigned: true }).references(
    () => volunteerApplications.id,
  ),
  fullName: varchar('full_name', { length: 120 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  region: varchar('region', { length: 120 }).notNull(),
  specialty: varchar('specialty', { length: 160 }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
  joinedAt: timestamp('joined_at', { fsp: 3 }).defaultNow().notNull(),
});

export const partnershipEnquiries = mysqlTable('partnership_enquiries', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  organizationName: varchar('organization_name', { length: 160 }).notNull(),
  contactName: varchar('contact_name', { length: 120 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  organizationType: varchar('organization_type', { length: 48 }).notNull(),
  region: varchar('region', { length: 120 }).notNull(),
  proposalSummary: text('proposal_summary').notNull(),
  status: varchar('status', { length: 32 }).notNull().default('PENDING'),
  createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
});

export const partnerships = mysqlTable('partnerships', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  enquiryId: bigint('enquiry_id', { mode: 'number', unsigned: true }).references(() => partnershipEnquiries.id),
  organizationName: varchar('organization_name', { length: 160 }).notNull(),
  organizationType: varchar('organization_type', { length: 48 }).notNull(),
  region: varchar('region', { length: 120 }).notNull(),
  focusArea: varchar('focus_area', { length: 180 }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
});

export const notifications = mysqlTable(
  'notifications',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    userId: bigint('user_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 64 }).notNull(),
    title: varchar('title', { length: 180 }).notNull(),
    message: text('message').notNull(),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('ix_notifications_user').on(table.userId),
  }),
);

export const announcements = mysqlTable('announcements', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  title: varchar('title', { length: 180 }).notNull(),
  body: text('body').notNull(),
  targetRole: varchar('target_role', { length: 48 }).notNull().default('ALL'),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => users.id),
  publishedAt: timestamp('published_at', { fsp: 3 }).defaultNow().notNull(),
});

export const articleCategories = mysqlTable('article_categories', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  slug: varchar('slug', { length: 80 }).notNull().unique(),
  name: varchar('name', { length: 120 }).notNull(),
});

export const articles = mysqlTable(
  'articles',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    slug: varchar('slug', { length: 180 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    categoryId: bigint('category_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => articleCategories.id),
    authorId: bigint('author_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => users.id),
    summary: text('summary').notNull(),
    body: text('body').notNull(),
    coverImageUrl: varchar('cover_image_url', { length: 500 }),
    status: varchar('status', { length: 32 }).notNull().default('PUBLISHED'),
    publishedAt: timestamp('published_at', { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => ({
    slugUnique: uniqueIndex('ux_articles_slug').on(table.slug),
  }),
);

export const contactMessages = mysqlTable('contact_messages', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 180 }).notNull(),
  message: text('message').notNull(),
  status: varchar('status', { length: 32 }).notNull().default('NEW'),
  createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
});
