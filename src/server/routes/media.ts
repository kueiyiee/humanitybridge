import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { and, eq, gt, inArray, isNull, like, lte, or } from 'drizzle-orm';
import { db, schema, nowUtc } from '../../db/index';
import { env } from '../config/env';
import { type AuthenticatedRequest, requireAuth } from '../middleware/auth';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { signHmac, verifyHmac } from '../utils/crypto';
import { DASHBOARD_ROLES, hasPermission } from '../../../packages/shared/types';
import { hasValidMagicSignature } from '../utils/fileValidation';
import { deletePublicMedia, readPublicMedia, storePublicMedia } from '../services/mediaStorage';

const router = Router();

async function assertPrivateEvidenceAccess(
  user: NonNullable<AuthenticatedRequest['user']>,
  file: typeof schema.mediaFiles.$inferSelect,
) {
  if (user.role === DASHBOARD_ROLES.PLATFORM_ADMIN || file.uploadedBy === user.id) return;
  if (!hasPermission(user.role, 'admin:cases:confidential')) {
    throw new AppError(403, 'Access denied to confidential evidence file');
  }
  const linkedCases = await db.select({ regionName: schema.communityLocations.regionName })
    .from(schema.caseDocuments)
    .innerJoin(schema.humanitarianCases, eq(schema.caseDocuments.caseId, schema.humanitarianCases.id))
    .innerJoin(schema.communityLocations, eq(schema.humanitarianCases.locationId, schema.communityLocations.id))
    .where(eq(schema.caseDocuments.storageKey, file.safeFilename));
  const hasAssignedRegion = linkedCases.some(({ regionName }) =>
    Boolean(user.region && regionName &&
      user.region.trim().toLocaleLowerCase() === regionName.trim().toLocaleLowerCase()),
  );
  if (!hasAssignedRegion) throw new AppError(403, 'Evidence is outside your assigned region');
}

fs.mkdirSync(env.privateStorageDir, { recursive: true });
if (env.mediaStorageProvider === 'local') fs.mkdirSync(env.publicMediaDir, { recursive: true });

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'application/pdf',
]);

const ALLOWED_FILE_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.pdf': 'application/pdf',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(file.mimetype) || ALLOWED_FILE_TYPES[ext] !== file.mimetype) {
      return cb(new AppError(400, 'Unsupported or unsafe file type. Allowed: JPG, PNG, WebP, PDF.'));
    }
    cb(null, true);
  },
});


router.post(
  '/upload',
  requireAuth,
  upload.single('file'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.file) throw new AppError(400, 'No file uploaded');
    const requestedScope = req.body?.scope;
    if (requestedScope && !['PUBLIC_STORY', 'PRIVATE_CASE_EVIDENCE'].includes(requestedScope)) {
      throw new AppError(400, 'Invalid media storage scope');
    }
    if (!hasValidMagicSignature(req.file.buffer, req.file.mimetype)) {
      throw new AppError(400, 'File content signature does not match declared MIME type');
    }

    const scope = requestedScope === 'PUBLIC_STORY' ? 'PUBLIC_STORY' : 'PRIVATE_CASE_EVIDENCE';
    const canUploadPublicMedia = hasPermission(req.user!.role, 'admin:stories:moderate') ||
      hasPermission(req.user!.role, 'admin:stories:publish') ||
      hasPermission(req.user!.role, 'admin:news:manage') ||
      hasPermission(req.user!.role, 'admin:news:publish') ||
      hasPermission(req.user!.role, 'coordinator:content:submit');
    if (scope === 'PUBLIC_STORY' && !canUploadPublicMedia) {
      throw new AppError(403, 'Your account is not authorised to upload public content media');
    }
    if (scope === 'PRIVATE_CASE_EVIDENCE' &&
      req.user!.role !== DASHBOARD_ROLES.PLATFORM_ADMIN &&
      req.user!.role !== DASHBOARD_ROLES.COMMUNITY_COORDINATOR) {
      throw new AppError(403, 'Your account is not authorised to upload platform media');
    }
    if (scope === 'PUBLIC_STORY' && req.file.mimetype === 'application/pdf') {
      throw new AppError(400, 'Public story media must be a supported image format');
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const safeFilename = `${crypto.randomUUID()}${ext}`;
    const targetDir = scope === 'PUBLIC_STORY' ? env.publicMediaDir : env.privateStorageDir;
    const diskPath = path.join(targetDir, safeFilename);

    let fileRecord: typeof schema.mediaFiles.$inferSelect | undefined;
    try {
      if (scope === 'PUBLIC_STORY') {
        await storePublicMedia(safeFilename, req.file.buffer, req.file.mimetype);
      } else {
        await fs.promises.writeFile(diskPath, req.file.buffer, { flag: 'wx', mode: 0o600 });
      }

      await db.insert(schema.mediaFiles).values({
        storageScope: scope,
        safeFilename,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        uploadedBy: req.user!.id,
        altText: String(req.body?.altText || '').slice(0, 240) || null,
        createdAt: nowUtc(),
      });

      const createdRows = await db
        .select()
        .from(schema.mediaFiles)
        .where(eq(schema.mediaFiles.safeFilename, safeFilename))
        .limit(1);
      fileRecord = createdRows[0];
      if (!fileRecord) throw new Error('Media metadata could not be confirmed after upload');
    } catch (error) {
      try {
        if (scope === 'PUBLIC_STORY') await deletePublicMedia(safeFilename);
        else await fs.promises.unlink(diskPath);
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          'Media upload failed and its incomplete storage object could not be removed',
        );
      }
      throw error;
    }

    const publicUrl = scope === 'PUBLIC_STORY' ? `/api/v1/media/public/${safeFilename}` : null;
    return res.status(201).json({
      success: true,
      message: 'File securely validated and stored',
      data: {
        id: fileRecord.id,
        storageScope: scope,
        safeFilename,
        publicUrl,
      },
    });
  }),
);

router.get(
  '/public/:filename',
  asyncHandler(async (req, res) => {
    const filename = path.basename(String(req.params.filename));
    const mediaRows = await db.select().from(schema.mediaFiles)
      .where(eq(schema.mediaFiles.safeFilename, filename)).limit(1);
    const media = mediaRows[0];
    if (!media || media.storageScope !== 'PUBLIC_STORY') {
      throw new AppError(404, 'Media file not found');
    }

    const publicStory = await db.select({ id: schema.stories.id })
      .from(schema.stories)
      .innerJoin(schema.storyConsents, eq(schema.stories.id, schema.storyConsents.storyId))
      .leftJoin(schema.storyMedia, eq(schema.storyMedia.storyId, schema.stories.id))
      .where(and(
        or(
          eq(schema.stories.coverImageUrl, `/api/v1/media/public/${filename}`),
          eq(schema.storyMedia.url, `/api/v1/media/public/${filename}`),
        ),
        eq(schema.stories.status, 'PUBLISHED'),
        eq(schema.storyConsents.consentStory, true),
        eq(schema.storyConsents.consentMedia, true),
        or(eq(schema.stories.isMinorSubject, false), eq(schema.storyConsents.guardianConsentRecorded, true)),
        isNull(schema.storyConsents.withdrawnAt),
        isNull(schema.stories.deletedAt),
      ))
      .limit(1);
    if (!publicStory[0]) {
      const now = nowUtc();
      const publicContent = await db.select({ id: schema.cmsContent.id })
        .from(schema.cmsContent)
        .where(and(
          isNull(schema.cmsContent.deletedAt),
          or(
            eq(schema.cmsContent.status, 'PUBLISHED'),
            and(
              eq(schema.cmsContent.status, 'SCHEDULED'),
              lte(schema.cmsContent.scheduledAt, now),
            ),
          ),
          or(isNull(schema.cmsContent.expiresAt), gt(schema.cmsContent.expiresAt, now)),
          or(
            eq(schema.cmsContent.coverImageUrl, `/api/v1/media/public/${filename}`),
            like(schema.cmsContent.bodyJson, `%/api/v1/media/public/${filename}%`),
            like(schema.cmsContent.attachmentsJson, `%/api/v1/media/public/${filename}%`),
          ),
        ))
        .limit(1);
      if (!publicContent[0]) throw new AppError(404, 'Media is not approved for public publication');
    }

    const contents = await readPublicMedia(filename);
    if (!contents) throw new AppError(404, 'Media file not found');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.type(media.mimeType);
    if (media.mimeType === 'application/pdf') res.setHeader('Content-Disposition', 'attachment');
    return res.send(contents);
  }),
);

router.get(
  '/library',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!hasPermission(req.user!.role, 'admin:stories:moderate') &&
      !hasPermission(req.user!.role, 'admin:stories:publish') &&
      !hasPermission(req.user!.role, 'admin:news:manage') &&
      !hasPermission(req.user!.role, 'admin:news:publish') &&
      !hasPermission(req.user!.role, 'coordinator:content:submit')) {
      throw new AppError(403, 'You are not authorised to browse the public media library');
    }
    const search = String(req.query.q || '').trim().toLowerCase();
    const files = await db.select({
      id: schema.mediaFiles.id,
      safeFilename: schema.mediaFiles.safeFilename,
      mimeType: schema.mediaFiles.mimeType,
      sizeBytes: schema.mediaFiles.sizeBytes,
      altText: schema.mediaFiles.altText,
      createdAt: schema.mediaFiles.createdAt,
      uploadedBy: schema.mediaFiles.uploadedBy,
    }).from(schema.mediaFiles)
      .where(eq(schema.mediaFiles.storageScope, 'PUBLIC_STORY'))
      .orderBy(schema.mediaFiles.createdAt);
    const filtered = files.filter((file) => !search || file.safeFilename.toLowerCase().includes(search) ||
      (file.altText || '').toLowerCase().includes(search));
    const urls = filtered.map((file) => `/api/v1/media/public/${file.safeFilename}`);
    const references = urls.length
      ? await db.select({
          url: schema.storyMedia.url,
          storyId: schema.stories.id,
          storyTitle: schema.stories.title,
          storyStatus: schema.stories.status,
        }).from(schema.storyMedia)
          .innerJoin(schema.stories, eq(schema.storyMedia.storyId, schema.stories.id))
          .where(inArray(schema.storyMedia.url, urls))
      : [];
    const covers = urls.length
      ? await db.select({
          url: schema.stories.coverImageUrl,
          storyId: schema.stories.id,
          storyTitle: schema.stories.title,
          storyStatus: schema.stories.status,
        }).from(schema.stories)
          .where(inArray(schema.stories.coverImageUrl, urls))
      : [];
    return res.json({
      success: true,
      message: 'Story media library loaded',
      data: filtered.map((file) => {
        const uses = [...references, ...covers].filter((use) =>
          use.url === `/api/v1/media/public/${file.safeFilename}`,
        );
        return {
          ...file,
          publicUrl: `/api/v1/media/public/${file.safeFilename}`,
          usageCount: uses.length,
          usedInPublishedContent: uses.some((use) => use.storyStatus === 'PUBLISHED'),
          stories: uses.map((use) => ({ id: use.storyId, title: use.storyTitle, status: use.storyStatus })),
        };
      }),
    });
  }),
);

// Signed expiring URL generator for confidential case documents (Admin or uploading owner only)
router.get(
  '/private/:id/signed-url',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const fileId = Number(req.params.id);
    const rows = await db.select().from(schema.mediaFiles).where(eq(schema.mediaFiles.id, fileId)).limit(1);
    const file = rows[0];
    if (!file || file.storageScope !== 'PRIVATE_CASE_EVIDENCE') {
      throw new AppError(404, 'Private evidence file not found');
    }

    await assertPrivateEvidenceAccess(req.user!, file);

    const expires = Date.now() + 5 * 60 * 1000;
    const payload = `${file.id}:${file.safeFilename}:${req.user!.id}:${expires}`;
    const sig = signHmac(payload, env.signedUrlSecret);

    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success: true,
      message: 'Expiring signed access URL generated (valid for 5 minutes)',
      data: {
        signedUrl: `/api/v1/media/private-access/${file.id}?expires=${expires}&sig=${sig}`,
      },
    });
  }),
);

router.get(
  '/private-access/:id',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const fileId = Number(req.params.id);
    const expires = Number(req.query.expires || 0);
    const sig = String(req.query.sig || '');
    if (!expires || Date.now() > expires) {
      throw new AppError(403, 'Signed file link has expired');
    }

    const rows = await db.select().from(schema.mediaFiles).where(eq(schema.mediaFiles.id, fileId)).limit(1);
    const file = rows[0];
    if (!file || file.storageScope !== 'PRIVATE_CASE_EVIDENCE') {
      throw new AppError(404, 'Private evidence file not found');
    }
    await assertPrivateEvidenceAccess(req.user!, file);

    const payload = `${file.id}:${file.safeFilename}:${req.user!.id}:${expires}`;
    if (!verifyHmac(payload, sig, env.signedUrlSecret)) {
      throw new AppError(403, 'Invalid file access signature');
    }

    const diskPath = path.join(env.privateStorageDir, path.basename(file.safeFilename));
    if (!fs.existsSync(diskPath)) throw new AppError(404, 'File missing from private storage');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.type(file.mimeType);
    res.setHeader('Content-Disposition', 'attachment');
    return res.sendFile(diskPath);
  }),
);

export default router;
