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

export const storyCategories = mysqlTable('story_categories', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  slug: varchar('slug', { length: 80 }).notNull().unique(),
  name: varchar('name', { length: 120 }).notNull(),
  description: text('description'),
});

export const stories = mysqlTable(
  'stories',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    slug: varchar('slug', { length: 180 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    categoryId: bigint('category_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => storyCategories.id),
    authorId: bigint('author_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => users.id),
    regionName: varchar('region_name', { length: 120 }).notNull(),
    countryName: varchar('country_name', { length: 120 }),
    stateRegionName: varchar('state_region_name', { length: 120 }),
    communityName: varchar('community_name', { length: 120 }),
    tagsJson: text('tags_json'),
    isFeatured: boolean('is_featured').notNull().default(false),
    internalEditorialNotes: text('internal_editorial_notes'),
    excerpt: text('excerpt').notNull(),
    body: text('body').notNull(),
    coverImageUrl: varchar('cover_image_url', { length: 500 }),
    coverAltText: varchar('cover_alt_text', { length: 255 }),
    anonymousPublication: boolean('anonymous_publication').notNull().default(false),
    isMinorSubject: boolean('is_minor_subject').notNull().default(false),
    status: varchar('status', { length: 32 }).notNull().default('SUBMITTED'),
    languageCode: varchar('language_code', { length: 16 }).notNull().default('en'),
    translatedContentJson: text('translated_content_json'),
    publishedAt: timestamp('published_at', { fsp: 3 }),
    deletedAt: timestamp('deleted_at', { fsp: 3 }),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => ({
    slugUnique: uniqueIndex('ux_stories_slug').on(table.slug),
    statusIdx: index('ix_stories_status').on(table.status),
  }),
);

export const storyMedia = mysqlTable('story_media', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  storyId: bigint('story_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => stories.id, { onDelete: 'cascade' }),
  mediaType: varchar('media_type', { length: 24 }).notNull(),
  url: varchar('url', { length: 500 }).notNull(),
  altText: varchar('alt_text', { length: 255 }).notNull(),
  caption: varchar('caption', { length: 500 }),
  position: int('position').notNull().default(0),
  createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
});

export const storyConsents = mysqlTable('story_consents', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  storyId: bigint('story_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => stories.id, { onDelete: 'cascade' }),
  consentStory: boolean('consent_story').notNull().default(false),
  consentMedia: boolean('consent_media').notNull().default(false),
  consentIdentity: boolean('consent_identity').notNull().default(false),
  guardianConsentRecorded: boolean('guardian_consent_recorded').notNull().default(false),
  consentReference: varchar('consent_reference', { length: 180 }),
  consentVerifiedBy: bigint('consent_verified_by', { mode: 'number', unsigned: true }).references(() => users.id),
  consentVerifiedAt: timestamp('consent_verified_at', { fsp: 3 }),
  consentExpiresAt: timestamp('consent_expires_at', { fsp: 3 }),
  withdrawnAt: timestamp('withdrawn_at', { fsp: 3 }),
  recordedAt: timestamp('recorded_at', { fsp: 3 }).defaultNow().notNull(),
});

export const storyReviews = mysqlTable('story_reviews', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  storyId: bigint('story_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => stories.id, { onDelete: 'cascade' }),
  reviewerId: bigint('reviewer_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => users.id),
  decision: varchar('decision', { length: 32 }).notNull(),
  editorialNotes: text('editorial_notes'),
  reviewedAt: timestamp('reviewed_at', { fsp: 3 }).defaultNow().notNull(),
});

export const storyPublications = mysqlTable('story_publications', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  storyId: bigint('story_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => stories.id, { onDelete: 'cascade' }),
  publishedBy: bigint('published_by', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => users.id),
  scheduledFor: timestamp('scheduled_for', { fsp: 3 }),
  publishedAt: timestamp('published_at', { fsp: 3 }).defaultNow().notNull(),
});

export const storyAssignments = mysqlTable(
  'story_assignments',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    storyId: bigint('story_id', { mode: 'number', unsigned: true })
      .notNull().references(() => stories.id, { onDelete: 'cascade' }),
    reviewerId: bigint('reviewer_id', { mode: 'number', unsigned: true })
      .notNull().references(() => users.id),
    assignedBy: bigint('assigned_by', { mode: 'number', unsigned: true })
      .notNull().references(() => users.id),
    assignmentReason: text('assignment_reason').notNull(),
    assignedAt: timestamp('assigned_at', { fsp: 3 }).defaultNow().notNull(),
    endedAt: timestamp('ended_at', { fsp: 3 }),
  },
  (table) => ({
    storyIdx: index('ix_story_assignments_story').on(table.storyId),
  }),
);

export const storyComments = mysqlTable(
  'story_comments',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    storyId: bigint('story_id', { mode: 'number', unsigned: true })
      .notNull().references(() => stories.id, { onDelete: 'cascade' }),
    authorId: bigint('author_id', { mode: 'number', unsigned: true })
      .notNull().references(() => users.id),
    commentBody: text('comment_body').notNull(),
    resolvedAt: timestamp('resolved_at', { fsp: 3 }),
    resolvedBy: bigint('resolved_by', { mode: 'number', unsigned: true }).references(() => users.id),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => ({
    storyIdx: index('ix_story_comments_story').on(table.storyId),
  }),
);

export const storyVersions = mysqlTable(
  'story_versions',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    storyId: bigint('story_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => stories.id, { onDelete: 'cascade' }),
    versionNumber: bigint('version_number', { mode: 'number', unsigned: true }).notNull(),
    snapshotJson: text('snapshot_json').notNull(),
    changedBy: bigint('changed_by', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => ({
    storyVersionUnique: uniqueIndex('ux_story_versions_story_version').on(table.storyId, table.versionNumber),
    storyVersionIdx: index('ix_story_versions_story').on(table.storyId),
  }),
);
