import {
  mysqlTable,
  bigint,
  varchar,
  longtext,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';
import { users } from './identity';

export const cmsContent = mysqlTable(
  'cms_content',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    type: varchar('type', { length: 40 }).notNull(),
    slug: varchar('slug', { length: 180 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    subtitle: varchar('subtitle', { length: 255 }),
    summary: varchar('summary', { length: 2000 }).notNull(),
    bodyJson: longtext('body_json').notNull(),
    category: varchar('category', { length: 120 }),
    authorId: bigint('author_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => users.id),
    authorDepartment: varchar('author_department', { length: 160 }),
    location: varchar('location', { length: 180 }),
    coverImageUrl: varchar('cover_image_url', { length: 500 }),
    coverAltText: varchar('cover_alt_text', { length: 255 }),
    tagsJson: longtext('tags_json'),
    attachmentsJson: longtext('attachments_json'),
    externalUrl: varchar('external_url', { length: 500 }),
    status: varchar('status', { length: 32 }).notNull().default('DRAFT'),
    scheduledAt: timestamp('scheduled_at', { fsp: 3 }),
    publishedAt: timestamp('published_at', { fsp: 3 }),
    expiresAt: timestamp('expires_at', { fsp: 3 }),
    isFeatured: boolean('is_featured').notNull().default(false),
    seoTitle: varchar('seo_title', { length: 180 }),
    seoDescription: varchar('seo_description', { length: 320 }),
    deletedAt: timestamp('deleted_at', { fsp: 3 }),
    createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => ({
    typeSlugUnique: uniqueIndex('ux_cms_content_type_slug').on(table.type, table.slug),
    typeStatusIdx: index('ix_cms_content_type_status').on(table.type, table.status),
    publishedIdx: index('ix_cms_content_published_at').on(table.publishedAt),
    authorIdx: index('ix_cms_content_author').on(table.authorId),
  }),
);
