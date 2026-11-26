import type { Request, Response, NextFunction } from 'express';
import { and, eq, isNull } from 'drizzle-orm';
import { db, schema, nowUtc } from '../../db/index';
import { hashToken, generateRandomToken, signHmac, verifyHmac } from '../utils/crypto';
import { env } from '../config/env';
import { AppError } from './errorHandler';
import {
  DASHBOARD_ROLES,
  hasPermission,
  type AuthUser,
  type DashboardRole,
} from '../../../packages/shared/types';

export const SESSION_COOKIE_NAME = 'hb_session';
export const CSRF_COOKIE_NAME = 'hb_csrf';

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  sessionId?: number;
}

export function setAuthCookies(res: Response, rawSessionToken: string, maxAgeMs: number) {
  res.cookie(SESSION_COOKIE_NAME, rawSessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.cookieSecure,
    path: '/',
    maxAge: maxAgeMs,
  });
  const csrfRaw = generateRandomToken(16);
  const csrfSigned = `${csrfRaw}.${signHmac(csrfRaw, env.csrfSecret)}`;
  res.cookie(CSRF_COOKIE_NAME, csrfSigned, {
    httpOnly: false,
    sameSite: 'lax',
    secure: env.cookieSecure,
    path: '/',
    maxAge: maxAgeMs,
  });
  return csrfSigned;
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  res.clearCookie(CSRF_COOKIE_NAME, { path: '/' });
}

export async function attachSessionUser(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const rawToken = req.cookies?.[SESSION_COOKIE_NAME];
  if (!rawToken || typeof rawToken !== 'string') {
    return next();
  }

  try {
    const tokenHash = hashToken(rawToken);
    const rows = await db
      .select({
        sessionId: schema.userSessions.id,
        expiresAt: schema.userSessions.expiresAt,
        revokedAt: schema.userSessions.revokedAt,
        userId: schema.users.id,
        email: schema.users.email,
        role: schema.users.role,
        status: schema.users.status,
        emailVerified: schema.users.emailVerified,
        mfaEnabled: schema.users.mfaEnabled,
        displayName: schema.userProfiles.displayName,
        region: schema.userProfiles.region,
        avatarUrl: schema.userProfiles.avatarUrl,
      })
      .from(schema.userSessions)
      .innerJoin(schema.users, eq(schema.userSessions.userId, schema.users.id))
      .leftJoin(schema.userProfiles, eq(schema.users.id, schema.userProfiles.userId))
      .where(and(eq(schema.userSessions.sessionTokenHash, tokenHash), isNull(schema.userSessions.revokedAt)))
      .limit(1);

    const record = rows[0];
    if (!record) return next();
    const expiresAtValue = record.expiresAt as unknown as Date | string;
    const expiresAtMs =
      expiresAtValue instanceof Date
        ? expiresAtValue.getTime()
        : new Date(expiresAtValue).getTime();
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) return next();
    if (record.status !== 'ACTIVE') return next();
    if (!Object.values(DASHBOARD_ROLES).includes(record.role as DashboardRole)) {
      return next();
    }

    req.sessionId = record.sessionId;
    req.user = {
      id: record.userId,
      email: record.email,
      role: record.role as DashboardRole,
      displayName: record.displayName || record.email,
      region: record.region,
      status: record.status,
      emailVerified: Boolean(record.emailVerified),
      mfaEnabled: Boolean(record.mfaEnabled),
      avatarUrl: record.avatarUrl,
    };
  } catch {
    // Ignore invalid session lookup and proceed unauthenticated
  }
  return next();
}

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new AppError(401, 'Authentication required. Please sign in to continue.'));
  }
  return next();
}

export function requireRole(...allowedRoles: DashboardRole[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'Authentication required'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError(403, 'Insufficient permissions for this resource'));
    }
    return next();
  };
}

export function requirePermission(permissionKey: string) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'Authentication required'));
    }
    if (!hasPermission(req.user.role, permissionKey)) {
      return next(new AppError(403, `Missing required permission: ${permissionKey}`));
    }
    return next();
  };
}

export function verifyCsrfForMutations(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
  if (safeMethods.has(req.method)) return next();
  // Exempt public webhook callbacks & pre-session auth endpoints
  if (
    req.path.startsWith('/api/v1/donations/webhook') ||
    req.path === '/api/v1/auth/login' ||
    req.path === '/api/v1/auth/forgot-password' ||
    req.path === '/api/v1/auth/reset-password' ||
    req.path === '/api/v1/auth/verify-email'
  ) {
    return next();
  }
  // Only enforce CSRF when an authenticated session cookie is present
  if (!req.cookies?.[SESSION_COOKIE_NAME]) {
    return next();
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers['x-csrf-token'];
  if (!cookieToken || typeof headerToken !== 'string' || cookieToken !== headerToken) {
    return next(new AppError(403, 'Invalid or missing CSRF verification token'));
  }

  const [raw, sig] = cookieToken.split('.');
  if (!raw || !sig || !verifyHmac(raw, sig, env.csrfSecret)) {
    return next(new AppError(403, 'Invalid CSRF signature'));
  }
  return next();
}
