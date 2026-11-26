import { Router } from 'express';
import { and, desc, eq, isNull } from 'drizzle-orm';
import rateLimit from 'express-rate-limit';
import { db, schema, nowUtc } from '../../db/index';
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from '../../../packages/shared/validation';
import { DASHBOARD_ROLES, ROLE_PERMISSIONS } from '../../../packages/shared/types';
import {
  generateRandomToken,
  generateTotpSecret,
  encryptMfaSecret,
  decryptMfaSecret,
  hashPasswordArgon2id,
  hashToken,
  verifyPasswordArgon2id,
  verifyTotpCode,
} from '../utils/crypto';
import {
  type AuthenticatedRequest,
  clearAuthCookies,
  requireAuth,
  setAuthCookies,
} from '../middleware/auth';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { writeAuditLog } from '../services/auditService';
import { env } from '../config/env';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many sign-in attempts from this network. Please wait before trying again.', data: null },
});

const sensitiveActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many verification attempts. Please wait before trying again.', data: null },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts. Try again shortly.', data: null },
});

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.parse(req.body);
    const email = parsed.email.toLowerCase();
    const ip = req.ip || 'unknown';
    const ts = nowUtc();

    const matchingUsers = await db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.email, email), isNull(schema.users.deletedAt)))
      .limit(1);
    const user = matchingUsers[0];

    if (!user || !verifyPasswordArgon2id(parsed.password, user.passwordHash)) {
      await db.insert(schema.loginAttempts).values({
        email,
        ipAddress: ip,
        success: false,
        reason: 'INVALID_CREDENTIALS',
        attemptedAt: ts,
      });
      throw new AppError(401, 'Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      await db.insert(schema.loginAttempts).values({
        email,
        ipAddress: ip,
        success: false,
        reason: `ACCOUNT_${user.status}`,
        attemptedAt: ts,
      });
      throw new AppError(
        403,
        user.status === 'PENDING_APPROVAL'
          ? 'Your Community Coordinator application is awaiting Administrator approval.'
          : 'Your account is currently suspended. Contact Platform Administration.',
      );
    }

    if (user.mfaEnabled) {
      const mfaRows = await db
        .select()
        .from(schema.mfaSettings)
        .where(eq(schema.mfaSettings.userId, user.id))
        .limit(1);
      const mfa = mfaRows[0];
      if (!mfa || !mfa.enabled) {
        throw new AppError(500, 'MFA configuration mismatch');
      }
      if (!parsed.mfaCode) {
        return res.status(200).json({
          success: true,
          message: 'MFA verification code required',
          data: { mfaRequired: true },
        });
      }
      if (!verifyTotpCode(decryptMfaSecret(mfa.totpSecret), parsed.mfaCode)) {
        await db.insert(schema.loginAttempts).values({
          email,
          ipAddress: ip,
          success: false,
          reason: 'INVALID_MFA',
          attemptedAt: ts,
        });
        throw new AppError(401, 'Invalid authenticator verification code');
      }
    }

    const rawSessionToken = generateRandomToken(32);
    const sessionTokenHash = hashToken(rawSessionToken);
    const ttlMs = env.sessionTtlHours * 3600 * 1000;
    const expiresAt = new Date(Date.now() + ttlMs);

    await db.insert(schema.userSessions).values({
      sessionTokenHash,
      userId: user.id,
      ipAddress: ip,
      userAgent: String(req.headers['user-agent'] || '').slice(0, 290),
      expiresAt: expiresAt as unknown as string,
      createdAt: ts,
    });

    await db.update(schema.users).set({ lastLoginAt: ts, updatedAt: ts }).where(eq(schema.users.id, user.id));
    await db.insert(schema.loginAttempts).values({
      email,
      ipAddress: ip,
      success: true,
      attemptedAt: ts,
    });

    const profileRows = await db
      .select()
      .from(schema.userProfiles)
      .where(eq(schema.userProfiles.userId, user.id))
      .limit(1);
    const profile = profileRows[0];

    const csrfToken = setAuthCookies(res, rawSessionToken, ttlMs);
    await writeAuditLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'AUTH_LOGIN_SUCCESS',
      resourceType: 'user',
      resourceId: user.id,
      ipAddress: ip,
    });

    return res.json({
      success: true,
      message: 'Signed in successfully',
      data: {
        mfaRequired: false,
        csrfToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          displayName: profile?.displayName || user.email,
          region: profile?.region || null,
          status: user.status,
          emailVerified: Boolean(user.emailVerified),
          mfaEnabled: Boolean(user.mfaEnabled),
        },
      },
    });
  }),
);

router.post(
  '/register',
  authLimiter,
  asyncHandler(async (_req, _res) => {
    throw new AppError(410, 'Public coordinator registration is disabled. Accounts are created only by the Platform Administrator.');
  }),
);

router.post(
  '/logout',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (req.sessionId) {
      await db
        .update(schema.userSessions)
        .set({ revokedAt: nowUtc() })
        .where(eq(schema.userSessions.id, req.sessionId));
    }
    clearAuthCookies(res);
    return res.json({ success: true, message: 'Signed out cleanly', data: null });
  }),
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    const permissions = ROLE_PERMISSIONS[user.role] || [];
    const profileRows = await db
      .select()
      .from(schema.userProfiles)
      .where(eq(schema.userProfiles.userId, user.id))
      .limit(1);

    return res.json({
      success: true,
      message: 'Session verified',
      data: {
        user: {
          ...user,
          organization: profileRows[0]?.organization || null,
          bio: profileRows[0]?.bio || null,
          preferredLanguage: profileRows[0]?.preferredLanguage || 'en',
        },
        permissions,
      },
    });
  }),
);

router.post(
  '/forgot-password',
  authLimiter,
  asyncHandler(async (req, res) => {
    const parsed = forgotPasswordSchema.parse(req.body);
    const email = parsed.email.toLowerCase();
    const rows = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    const user = rows[0];

    let devToken: string | undefined;
    if (user) {
      const token = generateRandomToken(24);
      devToken = token;
      await db.insert(schema.passwordResetTokens).values({
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 3600 * 1000) as unknown as string,
        createdAt: nowUtc(),
      });
      await writeAuditLog({
        actorUserId: user.id,
        actorRole: user.role,
        action: 'AUTH_PASSWORD_RESET_REQUESTED',
        resourceType: 'user',
        resourceId: user.id,
        ipAddress: req.ip,
      });
    }

    return res.json({
      success: true,
      message: 'If an account matches that email, password reset instructions have been issued.',
      data: env.isProduction ? null : { devResetToken: devToken },
    });
  }),
);

router.post(
  '/reset-password',
  authLimiter,
  asyncHandler(async (req, res) => {
    const parsed = resetPasswordSchema.parse(req.body);
    const tokenHash = hashToken(parsed.token);
    const ts = nowUtc();

    const rows = await db
      .select()
      .from(schema.passwordResetTokens)
      .where(and(eq(schema.passwordResetTokens.tokenHash, tokenHash), isNull(schema.passwordResetTokens.usedAt)))
      .limit(1);
    const record = rows[0];
    if (!record || record.expiresAt <= ts) {
      throw new AppError(400, 'Reset token is invalid or expired');
    }

    await db.transaction(async (tx) => {
      await tx
        .update(schema.users)
        .set({ passwordHash: hashPasswordArgon2id(parsed.password), updatedAt: ts })
        .where(eq(schema.users.id, record.userId));
      await tx
        .update(schema.passwordResetTokens)
        .set({ usedAt: ts })
        .where(eq(schema.passwordResetTokens.id, record.id));
      await tx
        .update(schema.userSessions)
        .set({ revokedAt: ts })
        .where(eq(schema.userSessions.userId, record.userId));
    });

    await writeAuditLog({
      actorUserId: record.userId,
      action: 'AUTH_PASSWORD_RESET_COMPLETED',
      resourceType: 'user',
      resourceId: record.userId,
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'Password updated. Please sign in with your new credentials.', data: null });
  }),
);

router.post(
  '/verify-email',
  asyncHandler(async (req, res) => {
    const token = String(req.body?.token || '').trim();
    if (!token) throw new AppError(400, 'Verification token is required');
    const tokenHash = hashToken(token);
    const ts = nowUtc();

    const rows = await db
      .select()
      .from(schema.emailVerificationTokens)
      .where(
        and(eq(schema.emailVerificationTokens.tokenHash, tokenHash), isNull(schema.emailVerificationTokens.verifiedAt)),
      )
      .limit(1);
    const record = rows[0];
    if (!record || record.expiresAt <= ts) {
      throw new AppError(400, 'Email verification token is invalid or expired');
    }

    await db.transaction(async (tx) => {
      await tx
        .update(schema.users)
        .set({ emailVerified: true, updatedAt: ts })
        .where(eq(schema.users.id, record.userId));
      await tx
        .update(schema.emailVerificationTokens)
        .set({ verifiedAt: ts })
        .where(eq(schema.emailVerificationTokens.id, record.id));
    });

    return res.json({ success: true, message: 'Email verified successfully', data: null });
  }),
);

router.patch(
  '/profile',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const displayName = String(req.body?.displayName || '').trim();
    const region = String(req.body?.region || '').trim();
    const organization = String(req.body?.organization || '').trim();
    const bio = String(req.body?.bio || '').trim();

    if (displayName.length < 2) {
      throw new AppError(400, 'Display name must be at least 2 characters');
    }

    await db
      .update(schema.userProfiles)
      .set({
        displayName,
        region: region || null,
        organization: organization || null,
        bio: bio || null,
        updatedAt: nowUtc(),
      })
      .where(eq(schema.userProfiles.userId, req.user!.id));

    return res.json({ success: true, message: 'Profile updated', data: null });
  }),
);

router.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    const confirmPassword = String(req.body?.confirmPassword || '');
    if (newPassword !== confirmPassword) {
      throw new AppError(400, 'Password confirmation does not match');
    }
    const minimumLength = req.user?.role === DASHBOARD_ROLES.PLATFORM_ADMIN ? 12 : 10;
    if (newPassword.length < minimumLength) {
      throw new AppError(400, `New password must be at least ${minimumLength} characters`);
    }

    const rows = await db.select().from(schema.users).where(eq(schema.users.id, req.user!.id)).limit(1);
    const user = rows[0];
    if (!user || !verifyPasswordArgon2id(currentPassword, user.passwordHash)) {
      throw new AppError(401, 'Current password is incorrect');
    }

    await db
      .update(schema.users)
      .set({ passwordHash: hashPasswordArgon2id(newPassword), updatedAt: nowUtc() })
      .where(eq(schema.users.id, user.id));

    await writeAuditLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'AUTH_PASSWORD_CHANGED',
      resourceType: 'user',
      resourceId: user.id,
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'Password updated cleanly', data: null });
  }),
);

router.get(
  '/sessions',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const sessions = await db
      .select({
        id: schema.userSessions.id,
        ipAddress: schema.userSessions.ipAddress,
        userAgent: schema.userSessions.userAgent,
        expiresAt: schema.userSessions.expiresAt,
        revokedAt: schema.userSessions.revokedAt,
        createdAt: schema.userSessions.createdAt,
      })
      .from(schema.userSessions)
      .where(eq(schema.userSessions.userId, req.user!.id))
      .orderBy(desc(schema.userSessions.createdAt))
      .limit(15);

    return res.json({
      success: true,
      message: 'Active and recent sessions',
      data: sessions.map((s) => ({ ...s, isCurrent: s.id === req.sessionId })),
    });
  }),
);

router.delete(
  '/sessions/:id',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const sessionId = Number(req.params.id);
    await db
      .update(schema.userSessions)
      .set({ revokedAt: nowUtc() })
      .where(and(eq(schema.userSessions.id, sessionId), eq(schema.userSessions.userId, req.user!.id)));

    return res.json({ success: true, message: 'Session revoked', data: null });
  }),
);

router.post(
  '/mfa/setup',
  requireAuth,
  sensitiveActionLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const password = String(req.body?.password || '');
    const currentCode = String(req.body?.currentCode || '');
    const userRows = await db.select().from(schema.users).where(eq(schema.users.id, req.user!.id)).limit(1);
    const user = userRows[0];
    if (!user || !verifyPasswordArgon2id(password, user.passwordHash)) {
      throw new AppError(401, 'Current password verification failed');
    }

    const existing = await db.select().from(schema.mfaSettings)
      .where(eq(schema.mfaSettings.userId, req.user!.id)).limit(1);
    if (existing[0]?.enabled) {
      if (!currentCode || !verifyTotpCode(decryptMfaSecret(existing[0].totpSecret), currentCode)) {
        throw new AppError(401, 'Current authenticator verification is required before replacing MFA');
      }
    }

    const secret = generateTotpSecret();
    const encryptedSecret = encryptMfaSecret(secret);
    const ts = nowUtc();

    if (existing.length > 0) {
      await db.update(schema.mfaSettings)
        .set({ totpSecret: encryptedSecret, enabled: false, updatedAt: ts })
        .where(eq(schema.mfaSettings.userId, req.user!.id));
    } else {
      await db.insert(schema.mfaSettings).values({
        userId: req.user!.id,
        totpSecret: encryptedSecret,
        enabled: false,
        updatedAt: ts,
      });
    }

    const otpauthUri = `otpauth://totp/HumanityBridge:${encodeURIComponent(req.user!.email)}?secret=${secret}&issuer=HumanityBridge`;
    return res.json({
      success: true,
      message: 'MFA secret generated. Verify a 6-digit code from your authenticator app to enable.',
      data: { secret, otpauthUri },
    });
  }),
);

router.post(
  '/mfa/enable',
  requireAuth,
  sensitiveActionLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const code = String(req.body?.code || '');
    const rows = await db
      .select()
      .from(schema.mfaSettings)
      .where(eq(schema.mfaSettings.userId, req.user!.id))
      .limit(1);
    const mfa = rows[0];
    if (!mfa) throw new AppError(400, 'Initialize MFA setup first');
    if (!verifyTotpCode(decryptMfaSecret(mfa.totpSecret), code)) {
      throw new AppError(400, 'Invalid 6-digit verification code');
    }

    const ts = nowUtc();
    await db.transaction(async (tx) => {
      await tx.update(schema.mfaSettings).set({ enabled: true, updatedAt: ts }).where(eq(schema.mfaSettings.id, mfa.id));
      await tx.update(schema.users).set({ mfaEnabled: true, updatedAt: ts }).where(eq(schema.users.id, req.user!.id));
    });

    await writeAuditLog({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'AUTH_MFA_ENABLED',
      resourceType: 'user',
      resourceId: req.user!.id,
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'Two-factor authentication enabled', data: null });
  }),
);

router.post(
  '/mfa/disable',
  requireAuth,
  sensitiveActionLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const password = String(req.body?.password || '');
    const code = String(req.body?.code || '');
    const userRows = await db.select().from(schema.users).where(eq(schema.users.id, req.user!.id)).limit(1);
    const user = userRows[0];
    if (!user || !verifyPasswordArgon2id(password, user.passwordHash)) {
      throw new AppError(401, 'Current password verification failed');
    }

    const mfaRows = await db.select().from(schema.mfaSettings)
      .where(eq(schema.mfaSettings.userId, user.id)).limit(1);
    const mfa = mfaRows[0];
    if (!mfa || !mfa.enabled || !verifyTotpCode(decryptMfaSecret(mfa.totpSecret), code)) {
      throw new AppError(401, 'A valid current authenticator code is required');
    }

    const ts = nowUtc();
    await db.transaction(async (tx) => {
      await tx.update(schema.mfaSettings).set({ enabled: false, updatedAt: ts })
        .where(eq(schema.mfaSettings.userId, user.id));
      await tx.update(schema.users).set({ mfaEnabled: false, updatedAt: ts })
        .where(eq(schema.users.id, user.id));
      await tx.update(schema.userSessions).set({ revokedAt: ts })
        .where(eq(schema.userSessions.userId, user.id));
    });

    clearAuthCookies(res);
    await writeAuditLog({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'AUTH_MFA_DISABLED',
      resourceType: 'user',
      resourceId: user.id,
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'MFA disabled. Please sign in again.', data: null });
  }),
);

export default router;
