import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { eq } from 'drizzle-orm';
import { db, schema, nowUtc } from '../../db/index';
import { env } from '../config/env';
import { type AuthenticatedRequest, requireAuth } from '../middleware/auth';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { signHmac, verifyHmac } from '../utils/crypto';
import { DASHBOARD_ROLES } from '../../../packages/shared/types';

const router = Router();

fs.mkdirSync(env.privateStorageDir, { recursive: true });
fs.mkdirSync(env.publicMediaDir, { recursive: true });

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new AppError(400, 'Unsupported or unsafe file type. Allowed: JPG, PNG, WebP, PDF.'));
    }
    cb(null, true);
  },
});

function hasValidMagicSignature(buf: Buffer, mimeType: string): boolean {
  if (buf.length < 4) return false;
  if (mimeType === 'image/jpeg') return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (mimeType === 'image/png') return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (mimeType === 'image/webp') return buf.subarray(0, 4).toString('ascii') === 'RIFF';
  if (mimeType === 'application/pdf') return buf.subarray(0, 4).toString('ascii') === '%PDF';
  return false;
}

router.post(
  '/upload',
  requireAuth,
  upload.single('file'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.file) throw new AppError(400, 'No file uploaded');
    if (!hasValidMagicSignature(req.file.buffer, req.file.mimetype)) {
      throw new AppError(400, 'File content signature does not match declared MIME type');
    }

    const scope = req.body?.scope === 'PUBLIC_STORY' ? 'PUBLIC_STORY' : 'PRIVATE_CASE_EVIDENCE';
    if (scope === 'PUBLIC_STORY' && req.file.mimetype === 'application/pdf') {
      throw new AppError(400, 'Public story media must be a safe image format (JPG, PNG, WebP)');
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const safeFilename = `${crypto.randomUUID()}${ext}`;
    const targetDir = scope === 'PUBLIC_STORY' ? env.publicMediaDir : env.privateStorageDir;
    const diskPath = path.join(targetDir, safeFilename);
    fs.writeFileSync(diskPath, req.file.buffer);

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
    const fileRecord = createdRows[0];

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
    const diskPath = path.join(env.publicMediaDir, filename);
    if (!fs.existsSync(diskPath)) throw new AppError(404, 'Media file not found');
    return res.sendFile(diskPath);
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
    if (!file) throw new AppError(404, 'File not found');

    if (req.user!.role !== DASHBOARD_ROLES.PLATFORM_ADMIN && file.uploadedBy !== req.user!.id) {
      throw new AppError(403, 'Access denied to confidential evidence file');
    }

    const expires = Date.now() + 5 * 60 * 1000;
    const payload = `${file.id}:${file.safeFilename}:${expires}`;
    const sig = signHmac(payload, env.signedUrlSecret);

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
    if (!file) throw new AppError(404, 'File not found');

    const payload = `${file.id}:${file.safeFilename}:${expires}`;
    if (!verifyHmac(payload, sig, env.signedUrlSecret)) {
      throw new AppError(403, 'Invalid file access signature');
    }

    const diskPath = path.join(env.privateStorageDir, path.basename(file.safeFilename));
    if (!fs.existsSync(diskPath)) throw new AppError(404, 'File missing from private storage');
    return res.sendFile(diskPath);
  }),
);

export default router;
