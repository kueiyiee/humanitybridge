import crypto from 'node:crypto';
import { Router } from 'express';
import { and, desc, eq, gt, isNull, lte, or } from 'drizzle-orm';
import { z } from 'zod';
import {
  CMS_CONTENT_STATUSES,
  CMS_CONTENT_TYPES,
  hasPermission,
  type CmsContentStatus,
} from '../../../packages/shared/types';
import { db, schema, nowUtc } from '../../db/index';
import { requireAuth, requirePermission, type AuthenticatedRequest } from '../middleware/auth';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { writeAuditLog } from '../services/auditService';

const adminRoutes = Router();
const coordinatorRoutes = Router();
const publicRoutes = Router();

const contentInputSchema = z.object({
  type: z.enum(CMS_CONTENT_TYPES),
  title: z.string().trim().min(1).max(200),
  subtitle: z.string().trim().max(255).default(''),
  summary: z.string().trim().max(2000).default(''),
  body: z.unknown(),
  category: z.string().trim().max(120).default(''),
  authorDepartment: z.string().trim().max(160).default(''),
  location: z.string().trim().max(180).default(''),
  coverImageUrl: z.string().trim().max(500).default(''),
  coverAltText: z.string().trim().max(255).default(''),
  tags: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  attachments: z.array(z.object({
    url: z.string().trim().min(1).max(500),
    name: z.string().trim().min(1).max(180),
    mimeType: z.string().trim().max(100).default('application/octet-stream'),
  })).max(30).default([]),
  externalUrl: z.string().trim().max(500).default(''),
  scheduledAt: z.string().datetime({ offset: true }).nullable().default(null),
  expiresAt: z.string().datetime({ offset: true }).nullable().default(null),
  isFeatured: z.boolean().default(false),
  seoTitle: z.string().trim().max(180).default(''),
  seoDescription: z.string().trim().max(320).default(''),
});

type ContentInput = z.infer<typeof contentInputSchema>;

function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new AppError(400, 'Invalid content identifier.');
  return id;
}

function parseContentBody(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    (value as Record<string, unknown>).type !== 'doc') {
    throw new AppError(400, 'Content body must be a structured rich-text document.');
  }
  const json = JSON.stringify(value);
  if (json.length > 1_800_000) throw new AppError(413, 'Rich-text content exceeds the 1.8 MB limit.');
  const root = value as Record<string, unknown>;
  if (root.content !== undefined && !Array.isArray(root.content)) {
    throw new AppError(400, 'Content body contains an invalid document structure.');
  }
  const stack = ((root.content || []) as unknown[]).map((node) => ({ node, depth: 1 }));
  let nodeCount = 0;
  while (stack.length) {
    const { node: current, depth } = stack.pop()!;
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      throw new AppError(400, 'Content body contains an invalid node.');
    }
    const node = current as Record<string, unknown>;
    if (typeof node.type !== 'string' || node.type.length > 80 ||
      (node.text !== undefined && typeof node.text !== 'string') ||
      (node.content !== undefined && !Array.isArray(node.content)) ||
      (node.attrs !== undefined && (!node.attrs || typeof node.attrs !== 'object' || Array.isArray(node.attrs))) ||
      (node.marks !== undefined && !Array.isArray(node.marks))) {
      throw new AppError(400, 'Content body contains an invalid node.');
    }
    nodeCount += 1;
    if (nodeCount > 40_000 || depth > 50) throw new AppError(400, 'Content body exceeds supported structure limits.');
    if (node.type === 'image') {
      const source = (node.attrs as Record<string, unknown> | undefined)?.src;
      if (typeof source !== 'string' || !isSafePublicUrl(source)) {
        throw new AppError(400, 'Images must use an HTTPS URL or an approved HumanityBridge media URL.');
      }
    }
    for (const child of (node.content || []) as unknown[]) stack.push({ node: child, depth: depth + 1 });
  }
  return json;
}

function isSafePublicUrl(value: string): boolean {
  if (value.startsWith('/api/v1/media/public/')) return true;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function parseOptionalUrl(value: string, field: string): string | null {
  if (!value) return null;
  if (!isSafePublicUrl(value)) throw new AppError(400, `${field} must be an HTTP(S) URL.`);
  return value;
}

function toSlug(value: string): string {
  const normalized = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const base = normalized.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 160);
  return `${base || 'content'}-${crypto.randomBytes(3).toString('hex')}`;
}

function parseInput(value: unknown): ContentInput & { bodyJson: string } {
  const input = contentInputSchema.parse(value);
  return {
    ...input,
    bodyJson: parseContentBody(input.body),
  };
}

function contentValues(input: ContentInput & { bodyJson: string }, authorId: number) {
  return {
    type: input.type,
    slug: toSlug(input.title),
    title: input.title,
    subtitle: input.subtitle || null,
    summary: input.summary,
    bodyJson: input.bodyJson,
    category: input.category || null,
    authorId,
    authorDepartment: input.authorDepartment || null,
    location: input.location || null,
    coverImageUrl: parseOptionalUrl(input.coverImageUrl, 'Featured image'),
    coverAltText: input.coverAltText || null,
    tagsJson: JSON.stringify(input.tags),
    attachmentsJson: JSON.stringify(input.attachments.map((attachment) => ({
      ...attachment,
      url: parseOptionalUrl(attachment.url, 'Attachment URL'),
    }))),
    externalUrl: parseOptionalUrl(input.externalUrl, 'External link'),
    scheduledAt: input.scheduledAt,
    expiresAt: input.expiresAt,
    isFeatured: input.isFeatured,
    seoTitle: input.seoTitle || null,
    seoDescription: input.seoDescription || null,
  };
}

function publicVisibility() {
  const now = nowUtc();
  return and(
    isNull(schema.cmsContent.deletedAt),
    or(
      eq(schema.cmsContent.status, 'PUBLISHED'),
      and(eq(schema.cmsContent.status, 'SCHEDULED'), lte(schema.cmsContent.scheduledAt, now)),
    ),
    or(isNull(schema.cmsContent.expiresAt), gt(schema.cmsContent.expiresAt, now)),
  );
}

function recordToApi(row: typeof schema.cmsContent.$inferSelect & { authorName?: string | null }) {
  return {
    ...row,
    body: JSON.parse(row.bodyJson) as unknown,
    tags: row.tagsJson ? JSON.parse(row.tagsJson) as string[] : [],
    attachments: row.attachmentsJson
      ? JSON.parse(row.attachmentsJson) as Array<{ url: string; name: string; mimeType: string }>
      : [],
    authorName: row.authorName || null,
  };
}

function hasWrittenContent(bodyJson: string): boolean {
  const value = JSON.parse(bodyJson) as { content?: Array<Record<string, unknown>> };
  const stack = [...(value.content || [])];
  while (stack.length) {
    const node = stack.pop()!;
    if (typeof node.text === 'string' && node.text.trim()) return true;
    if (Array.isArray(node.content)) stack.push(...node.content as Array<Record<string, unknown>>);
  }
  return false;
}

async function writeContentAudit(
  req: AuthenticatedRequest,
  contentId: number,
  action: string,
  details: Record<string, unknown>,
) {
  await writeAuditLog({
    actorUserId: req.user!.id,
    actorRole: req.user!.role,
    action,
    resourceType: 'cms_content',
    resourceId: contentId,
    details,
    ipAddress: req.ip,
  });
}

adminRoutes.get(
  '/',
  requireAuth,
  requirePermission('admin:news:manage'),
  asyncHandler(async (req, res) => {
    const filters = [isNull(schema.cmsContent.deletedAt)];
    const type = String(req.query.type || '');
    const status = String(req.query.status || '');
    if (type && CMS_CONTENT_TYPES.includes(type as (typeof CMS_CONTENT_TYPES)[number])) {
      filters.push(eq(schema.cmsContent.type, type));
    }
    if (status && CMS_CONTENT_STATUSES.includes(status as (typeof CMS_CONTENT_STATUSES)[number])) {
      filters.push(eq(schema.cmsContent.status, status));
    }
    const rows = await db.select({
      content: schema.cmsContent,
      authorName: schema.userProfiles.displayName,
    }).from(schema.cmsContent)
      .leftJoin(schema.userProfiles, eq(schema.cmsContent.authorId, schema.userProfiles.userId))
      .where(and(...filters))
      .orderBy(desc(schema.cmsContent.updatedAt))
      .limit(250);
    const search = String(req.query.q || '').trim().toLowerCase();
    const filtered = search
      ? rows.filter(({ content }) => `${content.title} ${content.summary} ${content.category || ''}`.toLowerCase().includes(search))
      : rows;
    return res.json({
      success: true,
      message: 'Content records loaded.',
      data: filtered.map(({ content, authorName }) => recordToApi({ ...content, authorName })),
    });
  }),
);

adminRoutes.post(
  '/',
  requireAuth,
  requirePermission('admin:news:manage'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = parseInput(req.body);
    const timestamp = nowUtc();
    const values = contentValues(input, req.user!.id);
    await db.insert(schema.cmsContent).values({
      ...values,
      status: 'DRAFT',
      publishedAt: null,
      deletedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const [created] = await db.select().from(schema.cmsContent)
      .where(eq(schema.cmsContent.slug, values.slug)).limit(1);
    if (!created) throw new AppError(500, 'Content draft could not be confirmed after saving.');
    await writeContentAudit(req, created.id, 'CMS_CONTENT_CREATED', { type: created.type, status: created.status });
    return res.status(201).json({
      success: true,
      message: 'Content draft saved.',
      data: recordToApi(created),
    });
  }),
);

adminRoutes.put(
  '/:id',
  requireAuth,
  requirePermission('admin:news:manage'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = parseId(String(req.params.id));
    const input = parseInput(req.body);
    const [existing] = await db.select().from(schema.cmsContent)
      .where(and(eq(schema.cmsContent.id, id), isNull(schema.cmsContent.deletedAt))).limit(1);
    if (!existing) throw new AppError(404, 'Content record not found.');
    if (['PUBLISHED', 'SCHEDULED'].includes(existing.status) &&
      !hasPermission(req.user!.role, 'admin:news:publish')) {
      throw new AppError(403, 'Publishing permission is required to edit public or scheduled content.');
    }
    if (['PENDING_REVIEW', 'APPROVED'].includes(existing.status)) {
      throw new AppError(409, 'Return this record to draft before editing it.');
    }
    const { slug: _slug, ...values } = contentValues(input, existing.authorId);
    await db.update(schema.cmsContent).set({ ...values, updatedAt: nowUtc() })
      .where(eq(schema.cmsContent.id, id));
    await writeContentAudit(req, id, 'CMS_CONTENT_EDITED', {
      type: existing.type,
      status: existing.status,
    });
    const [updated] = await db.select().from(schema.cmsContent).where(eq(schema.cmsContent.id, id)).limit(1);
    return res.json({ success: true, message: 'Content changes saved.', data: recordToApi(updated) });
  }),
);

adminRoutes.patch(
  '/:id/status',
  requireAuth,
  requirePermission('admin:news:manage'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = parseId(String(req.params.id));
    const nextStatus = String(req.body?.status || '').toUpperCase() as CmsContentStatus;
    if (!CMS_CONTENT_STATUSES.includes(nextStatus)) throw new AppError(400, 'Invalid content status.');
    const [existing] = await db.select().from(schema.cmsContent)
      .where(and(eq(schema.cmsContent.id, id), isNull(schema.cmsContent.deletedAt))).limit(1);
    if (!existing) throw new AppError(404, 'Content record not found.');
    const allowed: Record<string, CmsContentStatus[]> = {
      DRAFT: ['PENDING_REVIEW', 'ARCHIVED'],
      PENDING_REVIEW: ['APPROVED', 'REJECTED', 'DRAFT'],
      APPROVED: ['PUBLISHED', 'SCHEDULED', 'ARCHIVED'],
      SCHEDULED: ['PUBLISHED', 'APPROVED', 'ARCHIVED'],
      PUBLISHED: ['APPROVED', 'ARCHIVED'],
      REJECTED: ['DRAFT', 'ARCHIVED'],
      ARCHIVED: ['DRAFT'],
    };
    if (!allowed[existing.status]?.includes(nextStatus)) {
      throw new AppError(409, `Content in ${existing.status} cannot transition to ${nextStatus}.`);
    }
    const reviewNotes = String(req.body?.notes || '').trim();
    if (['APPROVED', 'REJECTED', 'PUBLISHED'].includes(nextStatus) &&
      reviewNotes.length < 8) {
      throw new AppError(400, 'Provide at least 8 characters explaining this publishing decision.');
    }
    const changesPublicationState = ['SCHEDULED', 'PUBLISHED'].includes(existing.status) ||
      ['APPROVED', 'PUBLISHED', 'SCHEDULED', 'REJECTED'].includes(nextStatus);
    if (changesPublicationState && !hasPermission(req.user!.role, 'admin:news:publish')) {
      throw new AppError(403, 'You do not have permission to approve or publish content.');
    }
    if (nextStatus === 'PENDING_REVIEW' && !hasWrittenContent(existing.bodyJson)) {
      throw new AppError(400, 'Add content to the body before submitting it for review.');
    }
    const scheduledAt = req.body?.scheduledAt
      ? new Date(String(req.body.scheduledAt))
      : null;
    if (nextStatus === 'SCHEDULED' && (!scheduledAt || !Number.isFinite(scheduledAt.getTime()) || scheduledAt <= new Date())) {
      throw new AppError(400, 'Choose a future publication time.');
    }
    if (nextStatus === 'PUBLISHED' && !hasWrittenContent(existing.bodyJson)) {
      throw new AppError(400, 'Content must have a body before publication.');
    }
    const timestamp = nowUtc();
    await db.update(schema.cmsContent).set({
      status: nextStatus,
      scheduledAt: nextStatus === 'SCHEDULED' ? scheduledAt!.toISOString() : null,
      publishedAt: nextStatus === 'PUBLISHED' ? timestamp : existing.publishedAt,
      updatedAt: timestamp,
    }).where(eq(schema.cmsContent.id, id));
    await writeContentAudit(req, id, `CMS_CONTENT_${nextStatus}`, {
      type: existing.type,
      previousStatus: existing.status,
      status: nextStatus,
      notes: reviewNotes || undefined,
      scheduledAt: nextStatus === 'SCHEDULED' ? scheduledAt!.toISOString() : undefined,
    });
    return res.json({
      success: true,
      message: nextStatus === 'APPROVED' && existing.status === 'PUBLISHED'
        ? 'Content unpublished and returned to approved status.'
        : `Content moved to ${nextStatus}.`,
      data: { id, status: nextStatus },
    });
  }),
);

adminRoutes.delete(
  '/:id',
  requireAuth,
  requirePermission('admin:news:manage'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = parseId(String(req.params.id));
    const [existing] = await db.select().from(schema.cmsContent)
      .where(and(eq(schema.cmsContent.id, id), isNull(schema.cmsContent.deletedAt))).limit(1);
    if (!existing) throw new AppError(404, 'Content record not found.');
    if (!['DRAFT', 'REJECTED', 'ARCHIVED'].includes(existing.status)) {
      throw new AppError(409, 'Only drafts, rejected records, or archived content can be deleted.');
    }
    await db.update(schema.cmsContent).set({ deletedAt: nowUtc(), updatedAt: nowUtc() })
      .where(eq(schema.cmsContent.id, id));
    await writeContentAudit(req, id, 'CMS_CONTENT_DELETED', { type: existing.type, status: existing.status });
    return res.json({ success: true, message: 'Content removed from the workspace.', data: null });
  }),
);

coordinatorRoutes.get(
  '/',
  requireAuth,
  requirePermission('coordinator:content:submit'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const rows = await db.select().from(schema.cmsContent)
      .where(and(
        eq(schema.cmsContent.authorId, req.user!.id),
        isNull(schema.cmsContent.deletedAt),
      ))
      .orderBy(desc(schema.cmsContent.updatedAt));
    return res.json({ success: true, message: 'Your content submissions loaded.', data: rows.map(recordToApi) });
  }),
);

coordinatorRoutes.post(
  '/',
  requireAuth,
  requirePermission('coordinator:content:submit'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = parseInput(req.body);
    if (!['COMMUNITY_UPDATE', 'SUCCESS_STORY'].includes(input.type)) {
      throw new AppError(403, 'Coordinators may submit community updates and success stories only.');
    }
    if (req.body?.submitForReview === true && !hasWrittenContent(input.bodyJson)) {
      throw new AppError(400, 'Add content to the body before submitting it for review.');
    }
    const timestamp = nowUtc();
    const values = contentValues({ ...input, isFeatured: false }, req.user!.id);
    await db.insert(schema.cmsContent).values({
      ...values,
      status: req.body?.submitForReview === true ? 'PENDING_REVIEW' : 'DRAFT',
      publishedAt: null,
      deletedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const [created] = await db.select().from(schema.cmsContent)
      .where(eq(schema.cmsContent.slug, values.slug)).limit(1);
    if (!created) throw new AppError(500, 'Content submission could not be confirmed after saving.');
    await writeContentAudit(req, created.id, 'COORDINATOR_CONTENT_CREATED', {
      type: created.type,
      status: created.status,
    });
    return res.status(201).json({
      success: true,
      message: created.status === 'DRAFT' ? 'Content draft saved.' : 'Content submitted for editorial review.',
      data: recordToApi(created),
    });
  }),
);

coordinatorRoutes.put(
  '/:id',
  requireAuth,
  requirePermission('coordinator:content:submit'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = parseId(String(req.params.id));
    const input = parseInput(req.body);
    const [existing] = await db.select().from(schema.cmsContent)
      .where(and(
        eq(schema.cmsContent.id, id),
        eq(schema.cmsContent.authorId, req.user!.id),
        isNull(schema.cmsContent.deletedAt),
      )).limit(1);
    if (!existing) throw new AppError(404, 'Your content draft was not found.');
    if (!['COMMUNITY_UPDATE', 'SUCCESS_STORY'].includes(input.type) ||
      !['DRAFT', 'REJECTED'].includes(existing.status)) {
      throw new AppError(409, 'Only your draft or rejected community content can be edited.');
    }
    if (req.body?.submitForReview === true && !hasWrittenContent(input.bodyJson)) {
      throw new AppError(400, 'Add content to the body before submitting it for review.');
    }
    await db.update(schema.cmsContent).set({
      ...contentValues({ ...input, isFeatured: false }, existing.authorId),
      status: req.body?.submitForReview === true ? 'PENDING_REVIEW' : 'DRAFT',
      scheduledAt: null,
      updatedAt: nowUtc(),
    }).where(eq(schema.cmsContent.id, id));
    await writeContentAudit(req, id, 'COORDINATOR_CONTENT_EDITED', { type: input.type });
    return res.json({ success: true, message: 'Your content draft was saved.', data: { id } });
  }),
);

publicRoutes.get(
  '/cms-content/:type',
  asyncHandler(async (req, res) => {
    const type = String(req.params.type).toUpperCase();
    if (!CMS_CONTENT_TYPES.includes(type as (typeof CMS_CONTENT_TYPES)[number])) {
      throw new AppError(404, 'Content section not found.');
    }
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 12)));
    const rows = await db.select({
      content: schema.cmsContent,
      authorName: schema.userProfiles.displayName,
    }).from(schema.cmsContent)
      .leftJoin(schema.userProfiles, eq(schema.cmsContent.authorId, schema.userProfiles.userId))
      .where(and(eq(schema.cmsContent.type, type), publicVisibility()))
      .orderBy(desc(schema.cmsContent.publishedAt), desc(schema.cmsContent.createdAt));
    const search = String(req.query.q || '').trim().toLowerCase();
    const filtered = search ? rows.filter(({ content }) =>
      `${content.title} ${content.summary} ${content.category || ''} ${content.location || ''}`
        .toLowerCase().includes(search),
    ) : rows;
    const start = (page - 1) * limit;
    return res.json({
      success: true,
      message: 'Published content loaded.',
      data: filtered.slice(start, start + limit).map(({ content, authorName }) =>
        recordToApi({ ...content, authorName }),
      ),
      meta: { page, limit, total: filtered.length, totalPages: Math.max(1, Math.ceil(filtered.length / limit)) },
    });
  }),
);

publicRoutes.get(
  '/cms-content/:type/:slug',
  asyncHandler(async (req, res) => {
    const type = String(req.params.type).toUpperCase();
    if (!CMS_CONTENT_TYPES.includes(type as (typeof CMS_CONTENT_TYPES)[number])) {
      throw new AppError(404, 'Content section not found.');
    }
    const [row] = await db.select({
      content: schema.cmsContent,
      authorName: schema.userProfiles.displayName,
    }).from(schema.cmsContent)
      .leftJoin(schema.userProfiles, eq(schema.cmsContent.authorId, schema.userProfiles.userId))
      .where(and(
        eq(schema.cmsContent.type, type),
        eq(schema.cmsContent.slug, String(req.params.slug)),
        publicVisibility(),
      ))
      .limit(1);
    if (!row) throw new AppError(404, 'Published content not found.');
    return res.json({
      success: true,
      message: 'Published content loaded.',
      data: recordToApi({ ...row.content, authorName: row.authorName }),
    });
  }),
);

export const adminContentRoutes = adminRoutes;
export const coordinatorContentRoutes = coordinatorRoutes;
export const publicContentRoutes = publicRoutes;
