import { Router } from 'express';
import { constants as fsConstants } from 'node:fs';
import { access } from 'node:fs/promises';
import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { db, schema, nowUtc, getDbDiagnostics, checkDatabaseConnection } from '../../db/index';
import { createCampaignSchema, createStorySchema } from '../../../packages/shared/validation';
import {
  ARTICLE_STATUSES,
  CAMPAIGN_STATUSES,
  ALL_DASHBOARD_ROLES,
  DASHBOARD_ROLES,
  hasPermission,
  ROLE_DISPLAY_NAMES,
  type ArticleStatus,
  type CampaignStatus,
  type DashboardRole,
} from '../../../packages/shared/types';
import { type AuthenticatedRequest, requirePermission, requireRole } from '../middleware/auth';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { generateReferenceCode, hashPasswordArgon2id } from '../utils/crypto';
import { createNotification, writeAuditLog } from '../services/auditService';
import { generateTranslationDraft, type SupportedLocale } from '../services/translationService';
import { env } from '../config/env';
import { checkPublicMediaStorage } from '../services/mediaStorage';
import { validateStoryImageUrl } from '../services/storyMediaValidation';
import { invalidateImpactSummaryCache } from '../services/impactReporting';

const router = Router();

const ADMIN_CONSOLE_ROLES = ALL_DASHBOARD_ROLES.filter(
  (role) => role !== DASHBOARD_ROLES.COMMUNITY_COORDINATOR,
);

function getAdminPermission(req: AuthenticatedRequest): string | undefined {
  const { method, path } = req;
  if (path === '/dashboard' || path === '/notifications' || path.startsWith('/notifications/')) {
    return 'admin:dashboard:read';
  }
  if (path.startsWith('/documents')) return 'admin:documents:manage';
  if (path === '/coordinators') {
    return hasPermission(req.user!.role, 'admin:cases:assign')
      ? 'admin:cases:assign'
      : 'admin:campaigns:assign';
  }
  if (path === '/users/staff' || path.endsWith('/role')) return 'admin:users:roles';
  if (path === '/users' || /^\/users\/\d+$/.test(path) || path.endsWith('/status') || path.endsWith('/profile')) {
    return 'admin:users:manage';
  }
  if (path === '/users/coordinators') return 'admin:coordinators:manage';
  if (path.startsWith('/cases')) {
    if (path.endsWith('/assign-coordinator')) return 'admin:cases:assign';
    if (path.endsWith('/verify')) return 'admin:cases:verify';
    return 'admin:cases:review';
  }
  if (path.startsWith('/stories')) {
    if (path.endsWith('/review') &&
      ['PUBLISHED', 'UNPUBLISHED'].includes(String(req.body?.decision || '').toUpperCase())) {
      return 'admin:stories:publish';
    }
    return 'admin:stories:moderate';
  }
  if (path.startsWith('/campaigns')) {
    if (path.endsWith('/assign-coordinator')) return 'admin:campaigns:assign';
    if (method === 'PATCH' && path !== '/campaigns') {
      const status = String(req.body?.status || '').toUpperCase();
      if (status === 'APPROVED' || status === 'REJECTED') return 'admin:campaigns:approve';
      if (status === 'ACTIVE') return 'admin:campaigns:publish';
    }
    return 'admin:campaigns:manage';
  }
  if (path.startsWith('/announcements') && method !== 'GET') return 'admin:announcements:manage';
  if (path.startsWith('/field-reports') || path.startsWith('/announcements')) {
    return 'admin:outreach:manage';
  }
  if (path.startsWith('/articles') || path === '/article-categories') {
    if (path.startsWith('/articles/') && method === 'PATCH' &&
      String(req.body?.status || '').toUpperCase() === 'PUBLISHED') {
      return 'admin:news:publish';
    }
    return 'admin:news:manage';
  }
  if (path.startsWith('/volunteers') || path.startsWith('/partnerships')) return 'admin:outreach:manage';
  if (path.startsWith('/assistance-requests')) return 'admin:assistance:manage';
  if (path.startsWith('/donations') || path.startsWith('/bank-transfers') || path === '/distributions') {
    return 'admin:donations:reconcile';
  }
  if (path.startsWith('/safeguarding') || path.startsWith('/privacy-requests')) {
    return 'admin:safeguarding:manage';
  }
  if (path === '/settings') return 'admin:settings:manage';
  if (path === '/audit-logs') return 'admin:audit:read';
  return undefined;
}

router.use(requireRole(...ADMIN_CONSOLE_ROLES));
router.use((req: AuthenticatedRequest, _res, next) => {
  const permission = getAdminPermission(req);
  if (!permission) return next(new AppError(403, 'No permission is defined for this administrative resource'));
  return requirePermission(permission)(req, _res, next);
});

function slugify(title: string): string {
  return `${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function parseStoryMedia(input: unknown): Array<{ url: string; altText: string; caption: string | null }> {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.length > 12) {
    throw new AppError(400, 'A story can include up to 12 additional images');
  }
  return input.map((item) => {
    const altText = typeof item?.altText === 'string' ? item.altText.trim() : '';
    if (altText.length < 3 || altText.length > 255) {
      throw new AppError(400, 'Add descriptive alternative text (3–255 characters) for every story image');
    }
    const caption = typeof item?.caption === 'string' ? item.caption.trim() : '';
    if (caption.length > 500) throw new AppError(400, 'Image captions cannot exceed 500 characters');
    return { url: String(item?.url || ''), altText, caption: caption || null };
  });
}

async function checkDirectoryAccess(directory: string): Promise<'available' | 'unavailable'> {
  try {
    await access(directory, fsConstants.R_OK | fsConstants.W_OK);
    return 'available';
  } catch {
    return 'unavailable';
  }
}

function isRegionScopedRole(role: DashboardRole): boolean {
  return role === DASHBOARD_ROLES.REGIONAL_COORDINATOR ||
    role === DASHBOARD_ROLES.CASE_VERIFICATION_OFFICER ||
    role === DASHBOARD_ROLES.STORY_MODERATOR ||
    role === DASHBOARD_ROLES.OUTREACH_OFFICER ||
    role === DASHBOARD_ROLES.CAMPAIGN_MANAGER;
}

function hasRegionAccess(user: NonNullable<AuthenticatedRequest['user']>, region: string | null | undefined): boolean {
  if (!isRegionScopedRole(user.role)) return true;
  return Boolean(user.region && region && user.region.trim().toLocaleLowerCase() === region.trim().toLocaleLowerCase());
}

function regionsMatch(first: string | null | undefined, second: string | null | undefined): boolean {
  return Boolean(first && second && first.trim().toLocaleLowerCase() === second.trim().toLocaleLowerCase());
}

async function assertCaseRegionAccess(user: NonNullable<AuthenticatedRequest['user']>, caseId: number) {
  if (!isRegionScopedRole(user.role)) return;
  const [location] = await db.select({ regionName: schema.communityLocations.regionName })
    .from(schema.humanitarianCases)
    .innerJoin(schema.communityLocations, eq(schema.humanitarianCases.locationId, schema.communityLocations.id))
    .where(eq(schema.humanitarianCases.id, caseId))
    .limit(1);
  if (!hasRegionAccess(user, location?.regionName)) {
    throw new AppError(403, 'Case is outside your assigned region');
  }
}

async function assertStoryRegionAccess(user: NonNullable<AuthenticatedRequest['user']>, storyId: number) {
  if (!isRegionScopedRole(user.role)) return;
  const [story] = await db.select({ regionName: schema.stories.regionName })
    .from(schema.stories)
    .where(eq(schema.stories.id, storyId))
    .limit(1);
  if (!hasRegionAccess(user, story?.regionName)) {
    throw new AppError(403, 'Story is outside your assigned region');
  }
}

async function assertCampaignRegionAccess(user: NonNullable<AuthenticatedRequest['user']>, campaignId: number) {
  if (!isRegionScopedRole(user.role)) return;
  const [campaign] = await db.select({
    id: schema.campaigns.id,
    createdBy: schema.campaigns.createdBy,
  }).from(schema.campaigns)
    .where(eq(schema.campaigns.id, campaignId))
    .limit(1);
  if (!campaign) throw new AppError(404, 'Campaign not found');
  const regions = await db.select({ regionName: schema.communityLocations.regionName })
    .from(schema.campaignCases)
    .innerJoin(schema.humanitarianCases, eq(schema.campaignCases.caseId, schema.humanitarianCases.id))
    .innerJoin(schema.communityLocations, eq(schema.humanitarianCases.locationId, schema.communityLocations.id))
    .where(eq(schema.campaignCases.campaignId, campaignId));
  const allowed = regions.length > 0
    ? regions.every((row) => hasRegionAccess(user, row.regionName))
    : campaign.createdBy === user.id;
  if (!allowed) throw new AppError(403, 'Campaign is outside your assigned region');
}

router.get(
  '/dashboard',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const [usersTotal] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.users)
      .where(isNull(schema.users.deletedAt));
    const [activeUsers] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.users)
      .where(and(eq(schema.users.status, 'ACTIVE'), isNull(schema.users.deletedAt)));
    const [administratorUsers] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.users)
      .where(and(eq(schema.users.role, DASHBOARD_ROLES.PLATFORM_ADMIN), isNull(schema.users.deletedAt)));
    const [failedLoginAttempts] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.loginAttempts)
      .where(and(
        eq(schema.loginAttempts.success, false),
        sql`${schema.loginAttempts.attemptedAt} >= ${new Date(Date.now() - 24 * 60 * 60 * 1000)}`,
      ));
    const [activeCoordinators] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.users)
      .where(and(
        eq(schema.users.role, DASHBOARD_ROLES.COMMUNITY_COORDINATOR),
        eq(schema.users.status, 'ACTIVE'),
        isNull(schema.users.deletedAt),
      ));
    const regionScoped = isRegionScopedRole(req.user!.role);
    const caseRegionFilter = regionScoped
      ? eq(schema.communityLocations.regionName, req.user!.region || '')
      : undefined;
    const [verifiedCases] = await db
      .select({ count: sql<number>`count(distinct ${schema.humanitarianCases.id})` })
      .from(schema.humanitarianCases)
      .innerJoin(schema.communityLocations, eq(schema.humanitarianCases.locationId, schema.communityLocations.id))
      .where(and(
        eq(schema.humanitarianCases.status, 'VERIFIED'),
        isNull(schema.humanitarianCases.deletedAt),
        caseRegionFilter,
      ));
    const [pendingCases] = await db
      .select({ count: sql<number>`count(distinct ${schema.humanitarianCases.id})` })
      .from(schema.humanitarianCases)
      .innerJoin(schema.communityLocations, eq(schema.humanitarianCases.locationId, schema.communityLocations.id))
      .where(and(
        sql`${schema.humanitarianCases.status} IN ('SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED')`,
        isNull(schema.humanitarianCases.deletedAt),
        caseRegionFilter,
      ));
    const dashboardCampaignRows = hasPermission(req.user!.role, 'admin:campaigns:manage')
      ? await db.select({
          id: schema.campaigns.id,
          title: schema.campaigns.title,
          targetAmount: schema.campaigns.targetAmount,
          raisedAmount: schema.campaigns.raisedAmount,
          status: schema.campaigns.status,
          createdBy: schema.campaigns.createdBy,
        }).from(schema.campaigns)
          .where(isNull(schema.campaigns.deletedAt))
      : [];
    const dashboardCampaignRegions = regionScoped && dashboardCampaignRows.length
      ? await db.select({
          campaignId: schema.campaignCases.campaignId,
          regionName: schema.communityLocations.regionName,
        }).from(schema.campaignCases)
          .innerJoin(schema.humanitarianCases, eq(schema.campaignCases.caseId, schema.humanitarianCases.id))
          .innerJoin(schema.communityLocations, eq(schema.humanitarianCases.locationId, schema.communityLocations.id))
          .where(inArray(schema.campaignCases.campaignId, dashboardCampaignRows.map((row) => row.id)))
      : [];
    const visibleDashboardCampaigns = regionScoped
      ? dashboardCampaignRows.filter((campaign) => {
          const regions = dashboardCampaignRegions.filter((item) => item.campaignId === campaign.id);
          return regions.length
            ? regions.every((item) => hasRegionAccess(req.user!, item.regionName))
            : campaign.createdBy === req.user!.id;
        })
      : dashboardCampaignRows;
    const activeCampaigns = { count: visibleDashboardCampaigns.filter((campaign) => campaign.status === 'ACTIVE').length };
    const completedCampaigns = { count: visibleDashboardCampaigns.filter((campaign) => campaign.status === 'COMPLETED').length };
    const [confirmedDonations] = await db
      .select({
        count: sql<number>`count(*)`,
        totalUsd: sql<number>`coalesce(sum(${schema.donations.amount}), 0)`,
      })
      .from(schema.donations)
      .where(eq(schema.donations.status, 'CONFIRMED'));
    const [distributedFunds] = await db
      .select({ totalUsd: sql<number>`coalesce(sum(${schema.assistanceDistributions.amountUsd}), 0)` })
      .from(schema.assistanceDistributions);
    const [outstandingRequests] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.assistanceRequests)
      .where(sql`${schema.assistanceRequests.status} IN ('SUBMITTED', 'UNDER_REVIEW')`);
    const [storiesAwaitingModeration] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.stories)
      .where(and(
        sql`${schema.stories.status} IN ('SUBMITTED', 'UNDER_REVIEW')`,
        isNull(schema.stories.deletedAt),
        req.user!.role === DASHBOARD_ROLES.STORY_MODERATOR
          ? eq(schema.stories.regionName, req.user!.region || '')
          : undefined,
      ));
    const [pendingBankTransfers] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.bankTransferRecords)
      .where(eq(schema.bankTransferRecords.status, 'PENDING_REVIEW'));
    const [openSafeguarding] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.safeguardingReports)
      .where(sql`${schema.safeguardingReports.status} IN ('OPEN', 'IN_REVIEW')`);

    const recentAudit = hasPermission(req.user!.role, 'admin:audit:read') ? await db
      .select({
        id: schema.auditLogs.id,
        action: schema.auditLogs.action,
        resourceType: schema.auditLogs.resourceType,
        resourceId: schema.auditLogs.resourceId,
        actorRole: schema.auditLogs.actorRole,
        createdAt: schema.auditLogs.createdAt,
      })
      .from(schema.auditLogs)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(10) : [];

    const campaignPerformance = visibleDashboardCampaigns.slice(0, 6);

    const caseStatusBreakdown = hasPermission(req.user!.role, 'admin:cases:review') ? await db
      .select({
        status: schema.humanitarianCases.status,
        count: sql<number>`count(*)`,
      })
      .from(schema.humanitarianCases)
      .innerJoin(schema.communityLocations, eq(schema.humanitarianCases.locationId, schema.communityLocations.id))
      .where(and(isNull(schema.humanitarianCases.deletedAt), caseRegionFilter))
      .groupBy(schema.humanitarianCases.status) : [];

    const canViewSystemHealth = hasPermission(req.user!.role, 'admin:settings:manage');
    let systemHealth: {
      api: string;
      database: string;
      status: string;
      databaseStatus: string;
      privateStorageStatus: 'available' | 'unavailable';
      publicMediaStatus: 'available' | 'unavailable';
      checkedAt: string;
    } | null = null;
    if (canViewSystemHealth) {
      await checkDatabaseConnection();
      const database = getDbDiagnostics();
      const [privateStorageStatus, publicMediaStatus] = await Promise.all([
        checkDirectoryAccess(env.privateStorageDir),
        env.mediaStorageProvider === 's3'
          ? checkPublicMediaStorage()
          : checkDirectoryAccess(env.publicMediaDir),
      ]);
      systemHealth = {
        api: 'available',
        database: database.dialect,
        status: 'connected',
        databaseStatus: 'connected',
        privateStorageStatus,
        publicMediaStatus,
        checkedAt: new Date().toISOString(),
      };
    }
    const canManageUsers = hasPermission(req.user!.role, 'admin:users:manage');
    const canReviewCases = hasPermission(req.user!.role, 'admin:cases:review');
    const canManageCampaigns = hasPermission(req.user!.role, 'admin:campaigns:manage');
    const canModerateStories = hasPermission(req.user!.role, 'admin:stories:moderate');
    const canReconcileDonations = hasPermission(req.user!.role, 'admin:donations:reconcile');
    const canManageAssistance = hasPermission(req.user!.role, 'admin:assistance:manage');
    const canManageSafeguarding = hasPermission(req.user!.role, 'admin:safeguarding:manage');
    return res.json({
      success: true,
      message: 'Executive dashboard loaded',
      data: {
        metrics: {
          totalUsers: canManageUsers ? Number(usersTotal?.count || 0) : 0,
          activeUsers: canManageUsers ? Number(activeUsers?.count || 0) : 0,
          inactiveUsers: canManageUsers
            ? Math.max(0, Number(usersTotal?.count || 0) - Number(activeUsers?.count || 0))
            : 0,
          administratorUsers: canManageUsers ? Number(administratorUsers?.count || 0) : 0,
          failedLoginAttempts24h: canViewSystemHealth ? Number(failedLoginAttempts?.count || 0) : 0,
          activeCoordinators: canManageUsers ? Number(activeCoordinators?.count || 0) : 0,
          verifiedCases: canReviewCases ? Number(verifiedCases?.count || 0) : 0,
          pendingCases: canReviewCases ? Number(pendingCases?.count || 0) : 0,
          storiesAwaitingModeration: canModerateStories ? Number(storiesAwaitingModeration?.count || 0) : 0,
          pendingBankTransfers: canReconcileDonations ? Number(pendingBankTransfers?.count || 0) : 0,
          activeCampaigns: canManageCampaigns ? Number(activeCampaigns?.count || 0) : 0,
          completedCampaigns: canManageCampaigns ? Number(completedCampaigns?.count || 0) : 0,
          confirmedDonationsCount: canReconcileDonations ? Number(confirmedDonations?.count || 0) : 0,
          confirmedDonationsUsd: canReconcileDonations ? Number(confirmedDonations?.totalUsd || 0) : 0,
          totalFundsDistributedUsd: canReconcileDonations ? Number(distributedFunds?.totalUsd || 0) : 0,
          outstandingAssistanceRequests: canManageAssistance ? Number(outstandingRequests?.count || 0) : 0,
          openSafeguardingAlerts: canManageSafeguarding ? Number(openSafeguarding?.count || 0) : 0,
        },
        systemHealth,
        campaignPerformance: campaignPerformance.map((campaign) => ({
          ...campaign,
          targetAmount: Number(campaign.targetAmount),
          raisedAmount: Number(campaign.raisedAmount),
        })),
        caseStatusBreakdown: caseStatusBreakdown.map((status) => ({
          ...status,
          count: Number(status.count),
        })),
        recentAudit,
      },
    });
  }),
);

// Users & Community Coordinators
router.get(
  '/users',
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        role: schema.users.role,
        status: schema.users.status,
        emailVerified: schema.users.emailVerified,
        mfaEnabled: schema.users.mfaEnabled,
        lastLoginAt: schema.users.lastLoginAt,
        createdAt: schema.users.createdAt,
        displayName: schema.userProfiles.displayName,
        region: schema.userProfiles.region,
        organization: schema.userProfiles.organization,
      })
      .from(schema.users)
      .leftJoin(schema.userProfiles, eq(schema.users.id, schema.userProfiles.userId))
      .where(isNull(schema.users.deletedAt))
      .orderBy(desc(schema.users.createdAt));

    return res.json({ success: true, message: 'Users loaded', data: rows });
  }),
);

router.get('/coordinators', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const rows = await db.select({
    id: schema.users.id,
    displayName: schema.userProfiles.displayName,
    role: schema.users.role,
    status: schema.users.status,
    region: schema.userProfiles.region,
  }).from(schema.users)
    .innerJoin(schema.userProfiles, eq(schema.users.id, schema.userProfiles.userId))
    .where(and(
      eq(schema.users.role, DASHBOARD_ROLES.COMMUNITY_COORDINATOR),
      eq(schema.users.status, 'ACTIVE'),
      isNull(schema.users.deletedAt),
      ...(isRegionScopedRole(req.user!.role)
        ? [eq(schema.userProfiles.region, req.user!.region || '')]
        : []),
    ))
    .orderBy(schema.userProfiles.displayName);
  return res.json({ success: true, message: 'Eligible coordinators loaded', data: rows });
}));

router.get('/users/:id', asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isSafeInteger(userId) || userId < 1) throw new AppError(400, 'Invalid user ID');
  const [user] = await db.select({
    id: schema.users.id,
    email: schema.users.email,
    role: schema.users.role,
    status: schema.users.status,
    emailVerified: schema.users.emailVerified,
    mfaEnabled: schema.users.mfaEnabled,
    lastLoginAt: schema.users.lastLoginAt,
    createdAt: schema.users.createdAt,
    displayName: schema.userProfiles.displayName,
    region: schema.userProfiles.region,
    organization: schema.userProfiles.organization,
    bio: schema.userProfiles.bio,
    preferredLanguage: schema.userProfiles.preferredLanguage,
  })
    .from(schema.users)
    .leftJoin(schema.userProfiles, eq(schema.users.id, schema.userProfiles.userId))
    .where(and(eq(schema.users.id, userId), isNull(schema.users.deletedAt)))
    .limit(1);
  if (!user) throw new AppError(404, 'User not found');

  const [cases, stories, campaigns, activity, sessions] = await Promise.all([
    db.select({
      id: schema.humanitarianCases.id,
      referenceCode: schema.humanitarianCases.referenceCode,
      title: schema.humanitarianCases.title,
      status: schema.humanitarianCases.status,
      createdAt: schema.humanitarianCases.createdAt,
    }).from(schema.humanitarianCases)
      .where(and(eq(schema.humanitarianCases.coordinatorId, userId), isNull(schema.humanitarianCases.deletedAt)))
      .orderBy(desc(schema.humanitarianCases.createdAt)).limit(50),
    db.select({
      id: schema.stories.id,
      title: schema.stories.title,
      status: schema.stories.status,
      createdAt: schema.stories.createdAt,
    }).from(schema.stories)
      .where(and(eq(schema.stories.authorId, userId), isNull(schema.stories.deletedAt)))
      .orderBy(desc(schema.stories.createdAt)).limit(50),
    db.select({
      id: schema.campaigns.id,
      title: schema.campaigns.title,
      status: schema.campaigns.status,
      createdAt: schema.campaigns.createdAt,
    }).from(schema.campaigns)
      .where(and(eq(schema.campaigns.createdBy, userId), isNull(schema.campaigns.deletedAt)))
      .orderBy(desc(schema.campaigns.createdAt)).limit(50),
    db.select({
      id: schema.auditLogs.id,
      action: schema.auditLogs.action,
      resourceType: schema.auditLogs.resourceType,
      resourceId: schema.auditLogs.resourceId,
      createdAt: schema.auditLogs.createdAt,
    }).from(schema.auditLogs)
      .where(or(
        eq(schema.auditLogs.actorUserId, userId),
        and(eq(schema.auditLogs.resourceType, 'user'), eq(schema.auditLogs.resourceId, String(userId))),
      ))
      .orderBy(desc(schema.auditLogs.createdAt)).limit(50),
    db.select({
      createdAt: schema.userSessions.createdAt,
      expiresAt: schema.userSessions.expiresAt,
      revokedAt: schema.userSessions.revokedAt,
    }).from(schema.userSessions).where(eq(schema.userSessions.userId, userId))
      .orderBy(desc(schema.userSessions.createdAt)).limit(20),
  ]);
  return res.json({
    success: true,
    message: 'User profile and activity loaded',
    data: { user, cases, stories, campaigns, activity, sessions },
  });
}));

router.post(
  '/users/coordinators',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const displayName = String(req.body?.displayName || '').trim();
    const region = String(req.body?.region || '').trim();
    const organization = String(req.body?.organization || '').trim();
    const password = String(req.body?.password || '');

    if (
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      displayName.length < 2 ||
      displayName.length > 120 ||
      region.length < 2 ||
      region.length > 120 ||
      password.length < 10 ||
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password)
    ) {
      throw new AppError(400, 'Valid email, name, region, and a 10+ character password containing an uppercase letter and number are required');
    }

    const existing = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    if (existing.length > 0) throw new AppError(409, 'Email is already registered');

    const ts = nowUtc();
    let createdUserId: number | undefined;
    await db.transaction(async (tx) => {
      await tx.insert(schema.users).values([{
        email,
        passwordHash: hashPasswordArgon2id(password),
        role: DASHBOARD_ROLES.COMMUNITY_COORDINATOR,
        status: 'ACTIVE',
        emailVerified: true,
        mfaEnabled: false,
        createdAt: ts,
        updatedAt: ts,
      }]);
      const [created] = await tx.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1);
      if (!created) throw new AppError(500, 'Coordinator account was not created');
      createdUserId = created.id;
      await tx.insert(schema.userProfiles).values([{
        userId: created.id,
        displayName,
        region,
        organization: organization || null,
        preferredLanguage: 'en',
        createdAt: ts,
        updatedAt: ts,
      }]);
    });
    if (!createdUserId) throw new AppError(500, 'Coordinator account was not created');

    await writeAuditLog({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'ADMIN_COORDINATOR_CREATED',
      resourceType: 'user',
      resourceId: createdUserId,
      details: { email, region },
      ipAddress: req.ip,
    });

    return res.status(201).json({
      success: true,
      message: 'Community Coordinator account created and activated',
      data: { id: createdUserId, email },
    });
  }),
);

router.post('/users/staff', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const displayName = String(req.body?.displayName || '').trim();
  const region = String(req.body?.region || '').trim();
  const organization = String(req.body?.organization || '').trim();
  const password = String(req.body?.password || '');
  const role = String(req.body?.role || '');
  const creatableRoles = ALL_DASHBOARD_ROLES.filter((item) => item !== DASHBOARD_ROLES.PLATFORM_ADMIN);

  if (
    !email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    displayName.length < 2 ||
    displayName.length > 120 ||
    region.length < 2 ||
    region.length > 120 ||
    password.length < 10 ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !creatableRoles.includes(role as (typeof creatableRoles)[number])
  ) {
    throw new AppError(400, 'Provide a valid email, name, region, operational role, and a 10+ character password containing an uppercase letter and number');
  }
  const [existing] = await db.select({ id: schema.users.id })
    .from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (existing) throw new AppError(409, 'Email is already registered');

  const ts = nowUtc();
  let createdUserId: number | undefined;
  await db.transaction(async (tx) => {
    await tx.insert(schema.users).values([{
      email,
      passwordHash: hashPasswordArgon2id(password),
      role,
      status: 'ACTIVE',
      emailVerified: true,
      mfaEnabled: false,
      createdAt: ts,
      updatedAt: ts,
    }]);
    const [created] = await tx.select({ id: schema.users.id })
      .from(schema.users).where(eq(schema.users.email, email)).limit(1);
    if (!created) throw new AppError(500, 'Staff account was not created');
    createdUserId = created.id;
    await tx.insert(schema.userProfiles).values([{
      userId: created.id,
      displayName,
      region,
      organization: organization || null,
      preferredLanguage: 'en',
      createdAt: ts,
      updatedAt: ts,
    }]);
  });
  if (!createdUserId) throw new AppError(500, 'Staff account was not created');

  await writeAuditLog({
    actorUserId: req.user!.id,
    actorRole: req.user!.role,
    action: 'ADMIN_STAFF_CREATED',
    resourceType: 'user',
    resourceId: createdUserId,
    details: { email, role, region },
    ipAddress: req.ip,
  });
  return res.status(201).json({
    success: true,
    message: `${ROLE_DISPLAY_NAMES[role as keyof typeof ROLE_DISPLAY_NAMES]} account created`,
    data: { id: createdUserId, email, role },
  });
}));

router.patch(
  '/users/:id/status',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = Number(req.params.id);
    const status = String(req.body?.status || '').toUpperCase();
    if (!Number.isSafeInteger(userId) || userId < 1) throw new AppError(400, 'Invalid user ID');
    if (!['ACTIVE', 'SUSPENDED', 'PENDING_APPROVAL'].includes(status)) {
      throw new AppError(400, 'Invalid account status');
    }
    if (userId === req.user!.id && status !== 'ACTIVE') {
      throw new AppError(400, 'Administrators cannot suspend their own active session');
    }

    const [existing] = await db.select({
      id: schema.users.id,
      role: schema.users.role,
      status: schema.users.status,
    }).from(schema.users)
      .where(and(eq(schema.users.id, userId), isNull(schema.users.deletedAt)))
      .limit(1);
    if (!existing) throw new AppError(404, 'User not found');
    if (existing.role === DASHBOARD_ROLES.PLATFORM_ADMIN && userId !== req.user!.id) {
      throw new AppError(403, 'Platform administrator accounts cannot be changed through this workflow');
    }
    if (existing.status === status) throw new AppError(409, `User is already ${status}`);

    const ts = nowUtc();
    await db.transaction(async (tx) => {
      await tx.update(schema.users).set({ status, updatedAt: ts }).where(eq(schema.users.id, userId));
      if (status === 'SUSPENDED') {
        await tx.update(schema.userSessions).set({ revokedAt: ts }).where(eq(schema.userSessions.userId, userId));
      }
    });

    await createNotification({
      userId,
      eventType: 'ACCOUNT_STATUS_CHANGED',
      title: `Account Status: ${status}`,
      message: `Your HumanityBridge account status was updated to ${status} by Platform Administration.`,
    });

    await writeAuditLog({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'ADMIN_USER_STATUS_UPDATED',
      resourceType: 'user',
      resourceId: userId,
      details: { previousStatus: existing.status, status },
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: `User status updated to ${status}`, data: null });
  }),
);

router.patch('/users/:id/role', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = Number(req.params.id);
  const role = String(req.body?.role || '');
  const assignableRoles = ALL_DASHBOARD_ROLES.filter((item) => item !== DASHBOARD_ROLES.PLATFORM_ADMIN);
  if (!Number.isSafeInteger(userId) || userId < 1 ||
    !assignableRoles.includes(role as (typeof assignableRoles)[number])) {
    throw new AppError(400, 'Select a valid non-platform-administrator role');
  }
  if (userId === req.user!.id) throw new AppError(400, 'Administrators cannot change their own role');
  const [existing] = await db.select({
    id: schema.users.id,
    role: schema.users.role,
  }).from(schema.users)
    .where(and(eq(schema.users.id, userId), isNull(schema.users.deletedAt)))
    .limit(1);
  if (!existing) throw new AppError(404, 'User not found');
  if (existing.role === DASHBOARD_ROLES.PLATFORM_ADMIN) {
    throw new AppError(403, 'Platform administrator roles cannot be changed through this workflow');
  }
  if (existing.role === role) throw new AppError(409, 'User already has this role');

  const ts = nowUtc();
  await db.transaction(async (tx) => {
    await tx.update(schema.users).set({ role, updatedAt: ts }).where(eq(schema.users.id, userId));
    await tx.update(schema.userSessions).set({ revokedAt: ts }).where(eq(schema.userSessions.userId, userId));
  });
  await createNotification({
    userId,
    eventType: 'ACCOUNT_ROLE_CHANGED',
    title: 'Your HumanityBridge role has changed',
    message: `Your account role is now ${ROLE_DISPLAY_NAMES[role as keyof typeof ROLE_DISPLAY_NAMES]}. Sign in again to continue.`,
  });
  await writeAuditLog({
    actorUserId: req.user!.id,
    actorRole: req.user!.role,
    action: 'ADMIN_USER_ROLE_UPDATED',
    resourceType: 'user',
    resourceId: userId,
    details: { previousRole: existing.role, role },
    ipAddress: req.ip,
  });
  return res.json({
    success: true,
    message: `User role updated to ${ROLE_DISPLAY_NAMES[role as keyof typeof ROLE_DISPLAY_NAMES]}`,
    data: { id: userId, role },
  });
}));

router.patch('/users/:id/profile', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = Number(req.params.id);
  const displayName = String(req.body?.displayName || '').trim();
  const region = String(req.body?.region || '').trim();
  const organization = String(req.body?.organization || '').trim();
  const bio = String(req.body?.bio || '').trim();
  if (!Number.isSafeInteger(userId) || userId < 1) throw new AppError(400, 'Invalid user ID');
  if (displayName.length < 2 || displayName.length > 120 || region.length > 120 ||
    organization.length > 160 || bio.length > 2000) {
    throw new AppError(400, 'Profile values are invalid or exceed the allowed length');
  }
  const [user] = await db.select({ id: schema.users.id })
    .from(schema.users).where(and(eq(schema.users.id, userId), isNull(schema.users.deletedAt))).limit(1);
  if (!user) throw new AppError(404, 'User not found');
  const ts = nowUtc();
  await db.transaction(async (tx) => {
    const [profile] = await tx.select({ id: schema.userProfiles.id })
      .from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).limit(1);
    const values = {
      displayName,
      region: region || null,
      organization: organization || null,
      bio: bio || null,
      updatedAt: ts,
    };
    if (profile) {
      await tx.update(schema.userProfiles).set(values).where(eq(schema.userProfiles.userId, userId));
    } else {
      await tx.insert(schema.userProfiles).values([{
        userId,
        ...values,
        preferredLanguage: 'en',
        createdAt: ts,
      }]);
    }
  });
  await writeAuditLog({
    actorUserId: req.user!.id,
    actorRole: req.user!.role,
    action: 'ADMIN_USER_PROFILE_UPDATED',
    resourceType: 'user',
    resourceId: userId,
    details: { displayName, region: region || null, organization: organization || null },
    ipAddress: req.ip,
  });
  return res.json({ success: true, message: 'User profile updated', data: null });
}));

// Humanitarian Case Review & Verification
router.get(
  '/cases',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const regionFilter = isRegionScopedRole(req.user!.role)
      ? eq(schema.communityLocations.regionName, req.user!.region || '')
      : undefined;
    const rows = await db
      .select({
        id: schema.humanitarianCases.id,
        referenceCode: schema.humanitarianCases.referenceCode,
        title: schema.humanitarianCases.title,
        publicSummary: schema.humanitarianCases.publicSummary,
        assistanceNeeded: schema.humanitarianCases.assistanceNeeded,
        affectedCount: schema.humanitarianCases.affectedCount,
        urgencyLevel: schema.humanitarianCases.urgencyLevel,
        estimatedCostUsd: schema.humanitarianCases.estimatedCostUsd,
        status: schema.humanitarianCases.status,
        isPublic: schema.humanitarianCases.isPublic,
        isChildRelated: schema.humanitarianCases.isChildRelated,
        guardianConsentObtained: schema.humanitarianCases.guardianConsentObtained,
        beneficiaryConsentObtained: schema.humanitarianCases.beneficiaryConsentObtained,
        privateContactName: schema.humanitarianCases.privateContactName,
        beneficiaryFullName: schema.humanitarianCases.beneficiaryFullName,
        beneficiaryAgeBand: schema.humanitarianCases.beneficiaryAgeBand,
        beneficiaryGender: schema.humanitarianCases.beneficiaryGender,
        householdSize: schema.humanitarianCases.householdSize,
        beneficiaryPreferredLanguage: schema.humanitarianCases.beneficiaryPreferredLanguage,
        beneficiaryNeedsNotes: schema.humanitarianCases.beneficiaryNeedsNotes,
        privateContactPhone: schema.humanitarianCases.privateContactPhone,
        privateLocationNotes: schema.humanitarianCases.privateLocationNotes,
        internalAdminNotes: schema.humanitarianCases.internalAdminNotes,
        createdAt: schema.humanitarianCases.createdAt,
        verifiedAt: schema.humanitarianCases.verifiedAt,
        categoryName: schema.caseCategories.name,
        regionName: schema.communityLocations.regionName,
        coordinatorId: schema.humanitarianCases.coordinatorId,
        coordinatorName: schema.userProfiles.displayName,
      })
      .from(schema.humanitarianCases)
      .innerJoin(schema.caseCategories, eq(schema.humanitarianCases.categoryId, schema.caseCategories.id))
      .innerJoin(schema.communityLocations, eq(schema.humanitarianCases.locationId, schema.communityLocations.id))
      .leftJoin(schema.userProfiles, eq(schema.humanitarianCases.coordinatorId, schema.userProfiles.userId))
      .where(regionFilter
        ? and(isNull(schema.humanitarianCases.deletedAt), regionFilter)
        : isNull(schema.humanitarianCases.deletedAt))
      .orderBy(desc(schema.humanitarianCases.updatedAt));

    const [documents, statusHistory] = rows.length
      ? await Promise.all([
        db.select({
          caseId: schema.caseDocuments.caseId,
          id: schema.caseDocuments.id,
          mediaId: schema.mediaFiles.id,
          documentType: schema.caseDocuments.documentType,
          originalFilename: schema.caseDocuments.originalFilename,
          isConfidential: schema.caseDocuments.isConfidential,
          createdAt: schema.caseDocuments.createdAt,
        }).from(schema.caseDocuments)
          .leftJoin(schema.mediaFiles, eq(schema.caseDocuments.storageKey, schema.mediaFiles.safeFilename))
          .where(inArray(schema.caseDocuments.caseId, rows.map((record) => record.id))),
        db.select({
          caseId: schema.caseStatusHistory.caseId,
          previousStatus: schema.caseStatusHistory.previousStatus,
          newStatus: schema.caseStatusHistory.newStatus,
          reason: schema.caseStatusHistory.reason,
          changedAt: schema.caseStatusHistory.changedAt,
          changedByName: schema.userProfiles.displayName,
        }).from(schema.caseStatusHistory)
          .leftJoin(schema.userProfiles, eq(schema.caseStatusHistory.changedBy, schema.userProfiles.userId))
          .where(inArray(schema.caseStatusHistory.caseId, rows.map((record) => record.id)))
          .orderBy(desc(schema.caseStatusHistory.changedAt)),
      ])
      : [[], []];
    return res.json({
      success: true,
      message: 'All humanitarian cases loaded',
      data: rows.map((record) => ({
        ...record,
        privateContactName: hasPermission(req.user!.role, 'admin:cases:confidential') ? record.privateContactName : null,
        beneficiaryFullName: hasPermission(req.user!.role, 'admin:cases:confidential') ? record.beneficiaryFullName : null,
        beneficiaryAgeBand: hasPermission(req.user!.role, 'admin:cases:confidential') ? record.beneficiaryAgeBand : null,
        beneficiaryGender: hasPermission(req.user!.role, 'admin:cases:confidential') ? record.beneficiaryGender : null,
        householdSize: hasPermission(req.user!.role, 'admin:cases:confidential') ? record.householdSize : null,
        beneficiaryPreferredLanguage: hasPermission(req.user!.role, 'admin:cases:confidential') ? record.beneficiaryPreferredLanguage : null,
        beneficiaryNeedsNotes: hasPermission(req.user!.role, 'admin:cases:confidential') ? record.beneficiaryNeedsNotes : null,
        privateContactPhone: hasPermission(req.user!.role, 'admin:cases:confidential') ? record.privateContactPhone : null,
        privateLocationNotes: hasPermission(req.user!.role, 'admin:cases:confidential') ? record.privateLocationNotes : null,
        internalAdminNotes: hasPermission(req.user!.role, 'admin:cases:confidential') ? record.internalAdminNotes : null,
        documents: hasPermission(req.user!.role, 'admin:cases:confidential')
          ? documents.filter((document) => document.caseId === record.id)
          : [],
        statusHistory: statusHistory
          .filter((history) => history.caseId === record.id)
          .map((history) => ({
            ...history,
            reason: hasPermission(req.user!.role, 'admin:cases:confidential') ? history.reason : null,
          })),
      })),
    });
  }),
);

router.patch('/cases/:id/assign-coordinator', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const caseId = Number(req.params.id);
  const coordinatorId = Number(req.body?.coordinatorId);
  const reason = String(req.body?.reason || '').trim();
  if (!Number.isSafeInteger(caseId) || caseId < 1 || !Number.isSafeInteger(coordinatorId) || coordinatorId < 1) {
    throw new AppError(400, 'Select a valid case and coordinator');
  }
  if (reason.length < 8 || reason.length > 1500) throw new AppError(400, 'Provide a reason for coordinator assignment');
  const [record] = await db.select({
    id: schema.humanitarianCases.id,
    status: schema.humanitarianCases.status,
    coordinatorId: schema.humanitarianCases.coordinatorId,
    referenceCode: schema.humanitarianCases.referenceCode,
  }).from(schema.humanitarianCases)
    .where(and(eq(schema.humanitarianCases.id, caseId), isNull(schema.humanitarianCases.deletedAt)))
    .limit(1);
  if (!record) throw new AppError(404, 'Case not found');
  const [caseLocation] = await db.select({ regionName: schema.communityLocations.regionName })
    .from(schema.humanitarianCases)
    .innerJoin(schema.communityLocations, eq(schema.humanitarianCases.locationId, schema.communityLocations.id))
    .where(eq(schema.humanitarianCases.id, caseId)).limit(1);
  await assertCaseRegionAccess(req.user!, caseId);
  if (record.status === 'CLOSED') throw new AppError(409, 'Closed cases cannot be reassigned');
  const [coordinator] = await db.select({
    id: schema.users.id,
    displayName: schema.userProfiles.displayName,
    region: schema.userProfiles.region,
  }).from(schema.users)
    .innerJoin(schema.userProfiles, eq(schema.users.id, schema.userProfiles.userId))
    .where(and(
      eq(schema.users.id, coordinatorId),
      eq(schema.users.role, DASHBOARD_ROLES.COMMUNITY_COORDINATOR),
      eq(schema.users.status, 'ACTIVE'),
      isNull(schema.users.deletedAt),
    ))
    .limit(1);
  if (!coordinator) throw new AppError(400, 'Select an active Community Coordinator account');
  if (isRegionScopedRole(req.user!.role) && !regionsMatch(caseLocation?.regionName, coordinator.region)) {
    throw new AppError(403, 'The coordinator must belong to the case region');
  }
  if (record.coordinatorId === coordinatorId) throw new AppError(409, 'This coordinator is already assigned to the case');

  await db.update(schema.humanitarianCases)
    .set({ coordinatorId, updatedAt: nowUtc() })
    .where(eq(schema.humanitarianCases.id, caseId));
  await createNotification({
    userId: coordinatorId,
    eventType: 'CASE_ASSIGNED',
    title: `Case assignment: ${record.referenceCode}`,
    message: `You have been assigned to ${record.referenceCode}. ${reason}`,
  });
  await writeAuditLog({
    actorUserId: req.user!.id,
    actorRole: req.user!.role,
    action: 'ADMIN_CASE_COORDINATOR_ASSIGNED',
    resourceType: 'humanitarian_case',
    resourceId: record.referenceCode,
    details: { previousCoordinatorId: record.coordinatorId, coordinatorId, reason },
    ipAddress: req.ip,
  });
  return res.json({
    success: true,
    message: `Case assigned to ${coordinator.displayName || 'coordinator'}`,
    data: { id: caseId, coordinatorId },
  });
}));

router.patch(
  '/cases/:id/verify',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const caseId = Number(req.params.id);
    const decision = String(req.body?.decision || '').toUpperCase();
    const notes = String(req.body?.notes || '').trim();
    const publishPublicly = Boolean(req.body?.publishPublicly);

    if (!['VERIFIED', 'REJECTED', 'INFO_REQUESTED', 'UNDER_REVIEW', 'CLOSED'].includes(decision)) {
      throw new AppError(400, 'Invalid case verification decision');
    }
    if (!notes) {
      throw new AppError(400, 'Verification decision notes are required for audit accountability');
    }
    if (notes.length > 1500) throw new AppError(400, 'Verification notes must be 1,500 characters or fewer');

    if (!Number.isSafeInteger(caseId) || caseId < 1) throw new AppError(400, 'Invalid case ID');
    const rows = await db
      .select()
      .from(schema.humanitarianCases)
      .where(and(eq(schema.humanitarianCases.id, caseId), isNull(schema.humanitarianCases.deletedAt)))
      .limit(1);
    const existing = rows[0];
    if (!existing) throw new AppError(404, 'Case not found');
    await assertCaseRegionAccess(req.user!, caseId);

    const allowedDecisions: Record<string, string[]> = {
      SUBMITTED: ['UNDER_REVIEW', 'INFO_REQUESTED'],
      UNDER_REVIEW: ['INFO_REQUESTED', 'VERIFIED', 'REJECTED'],
      INFO_REQUESTED: [],
      VERIFIED: ['CLOSED'],
      REJECTED: [],
      CLOSED: [],
      DRAFT: [],
    };
    if (!allowedDecisions[existing.status]?.includes(decision)) {
      throw new AppError(409, `A case in ${existing.status} cannot transition to ${decision}`);
    }

    if (decision === 'VERIFIED' && existing.isChildRelated && !existing.guardianConsentObtained) {
      throw new AppError(400, 'Cannot verify child-related case without documented guardian consent');
    }
    if (decision === 'VERIFIED' && publishPublicly && !existing.beneficiaryConsentObtained) {
      throw new AppError(400, 'Beneficiary consent is required before publishing a case publicly');
    }

    const ts = nowUtc();
    const isPublic = decision === 'VERIFIED' ? publishPublicly : false;

    await db.transaction(async (tx) => {
      await tx
        .update(schema.humanitarianCases)
        .set({
          status: decision,
          isPublic,
          internalAdminNotes: notes,
          verifiedBy: decision === 'VERIFIED' ? req.user!.id : existing.verifiedBy,
          verifiedAt: decision === 'VERIFIED' ? ts : existing.verifiedAt,
          updatedAt: ts,
        })
        .where(eq(schema.humanitarianCases.id, caseId));

      await tx.insert(schema.caseVerifications).values({
        caseId,
        reviewerId: req.user!.id,
        decision,
        notes,
        publishPublicly: isPublic,
        decidedAt: ts,
      });

      await tx.insert(schema.caseStatusHistory).values({
        caseId,
        previousStatus: existing.status,
        newStatus: decision,
        changedBy: req.user!.id,
        reason: notes,
        changedAt: ts,
      });
    });
    invalidateImpactSummaryCache();

    await createNotification({
      userId: existing.coordinatorId,
      eventType: `CASE_${decision}`,
      title: `Case ${existing.referenceCode}: ${decision}`,
      message: notes,
    });

    await writeAuditLog({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: `ADMIN_CASE_${decision}`,
      resourceType: 'humanitarian_case',
      resourceId: existing.referenceCode,
      details: { publishPublicly: isPublic, notes },
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      message: `Case ${existing.referenceCode} updated to ${decision}`,
      data: { id: caseId, status: decision, isPublic },
    });
  }),
);

// Story Moderation & Publishing
router.post(
  '/stories',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = createStorySchema.parse(req.body);
    const [category] = await db.select({ id: schema.storyCategories.id })
      .from(schema.storyCategories).where(eq(schema.storyCategories.id, parsed.categoryId)).limit(1);
    if (!category) throw new AppError(400, 'Select an existing story category');
    if (!hasRegionAccess(req.user!, parsed.regionName)) {
      throw new AppError(403, 'Stories must be assigned to your authorised region');
    }
    const mediaInput = parseStoryMedia(req.body?.media);
    const coverImageUrl = parsed.coverImageUrl
      ? await validateStoryImageUrl(parsed.coverImageUrl)
      : null;
    const coverAltText = String(parsed.coverAltText || '').trim();
    if (coverImageUrl && (coverAltText.length < 3 || coverAltText.length > 255)) {
      throw new AppError(400, 'Add descriptive alternative text for the featured image');
    }
    const media = await Promise.all(mediaInput.map(async (image) => ({
      url: await validateStoryImageUrl(image.url),
      altText: image.altText,
      caption: image.caption,
    })));

    if (parsed.isMinorSubject && !parsed.guardianConsentRecorded) {
      throw new AppError(400, 'Minor-related stories require documented guardian consent');
    }

    const ts = nowUtc();
    const slug = parsed.slug ? parsed.slug : slugify(parsed.title);
    const existingSlug = await db.select({ id: schema.stories.id })
      .from(schema.stories).where(eq(schema.stories.slug, slug)).limit(1);
    if (existingSlug[0]) throw new AppError(409, 'This story URL slug is already in use');
    const status = parsed.saveAsDraft ? 'DRAFT' : 'SUBMITTED';
    const storyId = await db.transaction(async (tx) => {
      await tx.insert(schema.stories).values({
        slug,
        title: parsed.title,
        categoryId: parsed.categoryId,
        authorId: req.user!.id,
        regionName: parsed.regionName,
        countryName: parsed.countryName || null,
        stateRegionName: parsed.stateRegionName || null,
        communityName: parsed.communityName || null,
        tagsJson: parsed.tags ? JSON.stringify(parsed.tags) : null,
        isFeatured: parsed.isFeatured,
        internalEditorialNotes: parsed.internalEditorialNotes || null,
        excerpt: parsed.excerpt,
        body: parsed.body,
        coverImageUrl,
        coverAltText: coverImageUrl ? coverAltText : null,
        anonymousPublication: parsed.anonymousPublication || parsed.isMinorSubject,
        isMinorSubject: parsed.isMinorSubject,
        status,
        languageCode: 'en',
        createdAt: ts,
        updatedAt: ts,
      });
      const [story] = await tx.select({ id: schema.stories.id })
        .from(schema.stories).where(eq(schema.stories.slug, slug)).limit(1);
      if (!story) throw new Error('Story record could not be confirmed after creation');

      await tx.insert(schema.storyConsents).values({
        storyId: story.id,
        consentStory: parsed.consentStory,
        consentMedia: parsed.consentMedia,
        consentIdentity: parsed.anonymousPublication ? false : parsed.consentIdentity,
        guardianConsentRecorded: parsed.guardianConsentRecorded,
        consentReference: parsed.consentReference || null,
        consentExpiresAt: parsed.consentExpiresAt ? parsed.consentExpiresAt : null,
        recordedAt: ts,
      });
      await tx.insert(schema.consentRecords).values({
        subjectType: 'STORY',
        subjectId: story.id,
        consentScope: 'STORY_PUBLICATION',
        granted: parsed.consentStory,
        recordedBy: req.user!.id,
        recordedAt: ts,
      });
      if (media.length) {
        await tx.insert(schema.storyMedia).values(media.map((image, position) => ({
          storyId: story.id,
          mediaType: 'IMAGE',
          url: image.url,
          altText: image.altText,
          caption: image.caption,
          position,
          createdAt: ts,
        })));
      }
      return story.id;
    });

    await writeAuditLog({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: status === 'DRAFT' ? 'ADMIN_STORY_DRAFT_CREATED' : 'ADMIN_STORY_SUBMITTED',
      resourceType: 'story',
      resourceId: storyId,
      details: { status, slug, mediaCount: media.length + (coverImageUrl ? 1 : 0) },
      ipAddress: req.ip,
    });

    return res.status(201).json({
      success: true,
      message: status === 'DRAFT' ? 'Story draft saved' : 'Story submitted for editorial review',
      data: { id: storyId, slug, status },
    });
  }),
);

router.patch(
  '/stories/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const storyId = Number(req.params.id);
    if (!Number.isSafeInteger(storyId) || storyId < 1) throw new AppError(400, 'Invalid story identifier');
    await assertStoryRegionAccess(req.user!, storyId);
    const [story] = await db.select().from(schema.stories)
      .where(and(eq(schema.stories.id, storyId), isNull(schema.stories.deletedAt))).limit(1);
    if (!story) throw new AppError(404, 'Story not found');
    if (['REJECTED', 'ARCHIVED'].includes(story.status)) {
      throw new AppError(409, 'Rejected or archived stories cannot be edited');
    }

    const parsed = createStorySchema.parse(req.body);
    const [category] = await db.select({ id: schema.storyCategories.id })
      .from(schema.storyCategories).where(eq(schema.storyCategories.id, parsed.categoryId)).limit(1);
    if (!category) throw new AppError(400, 'Select an existing story category');
    if (!hasRegionAccess(req.user!, parsed.regionName)) {
      throw new AppError(403, 'Stories must be assigned to your authorised region');
    }
    const mediaInput = parseStoryMedia(req.body?.media);
    const coverImageUrl = parsed.coverImageUrl
      ? await validateStoryImageUrl(parsed.coverImageUrl)
      : null;
    const coverAltText = String(parsed.coverAltText || '').trim();
    if (coverImageUrl && (coverAltText.length < 3 || coverAltText.length > 255)) {
      throw new AppError(400, 'Add descriptive alternative text for the featured image');
    }
    const media = await Promise.all(mediaInput.map(async (image) => ({
      url: await validateStoryImageUrl(image.url),
      altText: image.altText,
      caption: image.caption,
    })));
    if (parsed.isMinorSubject && !parsed.guardianConsentRecorded) {
      throw new AppError(400, 'Minor-related stories require documented guardian consent');
    }

    const ts = nowUtc();
    const nextSlug = parsed.slug && parsed.slug !== story.slug ? parsed.slug : story.slug;
    if (nextSlug !== story.slug) {
      const [slugOwner] = await db.select({ id: schema.stories.id })
        .from(schema.stories).where(eq(schema.stories.slug, nextSlug)).limit(1);
      if (slugOwner) throw new AppError(409, 'This story URL slug is already in use');
    }
    const nextStatus = story.status === 'PUBLISHED'
      ? 'SUBMITTED'
      : parsed.saveAsDraft ? 'DRAFT' : 'SUBMITTED';
    await db.transaction(async (tx) => {
      const [latestVersion] = await tx.select({ versionNumber: schema.storyVersions.versionNumber })
        .from(schema.storyVersions)
        .where(eq(schema.storyVersions.storyId, storyId))
        .orderBy(desc(schema.storyVersions.versionNumber))
        .limit(1);
      const currentMedia = await tx.select().from(schema.storyMedia)
        .where(eq(schema.storyMedia.storyId, storyId));
      const [currentConsent] = await tx.select().from(schema.storyConsents)
        .where(eq(schema.storyConsents.storyId, storyId)).limit(1);
      await tx.insert(schema.storyVersions).values({
        storyId,
        versionNumber: Number(latestVersion?.versionNumber || 0) + 1,
        snapshotJson: JSON.stringify({ story, media: currentMedia, consent: currentConsent || null }),
        changedBy: req.user!.id,
        createdAt: ts,
      });
      await tx.update(schema.stories).set({
        slug: nextSlug,
        title: parsed.title,
        categoryId: parsed.categoryId,
        regionName: parsed.regionName,
        countryName: parsed.countryName || null,
        stateRegionName: parsed.stateRegionName || null,
        communityName: parsed.communityName || null,
        tagsJson: parsed.tags ? JSON.stringify(parsed.tags) : null,
        isFeatured: parsed.isFeatured,
        internalEditorialNotes: parsed.internalEditorialNotes || null,
        excerpt: parsed.excerpt,
        body: parsed.body,
        coverImageUrl,
        coverAltText: coverImageUrl ? coverAltText : null,
        anonymousPublication: parsed.anonymousPublication || parsed.isMinorSubject,
        isMinorSubject: parsed.isMinorSubject,
        status: nextStatus,
        publishedAt: story.status === 'PUBLISHED' ? null : story.publishedAt,
        updatedAt: ts,
      }).where(eq(schema.stories.id, storyId));
      await tx.delete(schema.storyMedia).where(eq(schema.storyMedia.storyId, storyId));
      if (media.length) {
        await tx.insert(schema.storyMedia).values(media.map((image, position) => ({
          storyId,
          mediaType: 'IMAGE',
          url: image.url,
          altText: image.altText,
          caption: image.caption,
          position,
          createdAt: ts,
        })));
      }
      if (currentConsent) {
        await tx.update(schema.storyConsents).set({
          consentStory: parsed.consentStory,
          consentMedia: parsed.consentMedia,
          consentIdentity: parsed.anonymousPublication ? false : parsed.consentIdentity,
          guardianConsentRecorded: parsed.guardianConsentRecorded,
          consentReference: parsed.consentReference || null,
          consentExpiresAt: parsed.consentExpiresAt ? parsed.consentExpiresAt : null,
          withdrawnAt: null,
          recordedAt: ts,
        }).where(eq(schema.storyConsents.id, currentConsent.id));
      } else {
        await tx.insert(schema.storyConsents).values({
          storyId,
          consentStory: parsed.consentStory,
          consentMedia: parsed.consentMedia,
          consentIdentity: parsed.anonymousPublication ? false : parsed.consentIdentity,
          guardianConsentRecorded: parsed.guardianConsentRecorded,
          consentReference: parsed.consentReference || null,
          consentExpiresAt: parsed.consentExpiresAt ? parsed.consentExpiresAt : null,
          recordedAt: ts,
        });
      }
      await tx.insert(schema.consentRecords).values({
        subjectType: 'STORY',
        subjectId: storyId,
        consentScope: 'STORY_PUBLICATION',
        granted: parsed.consentStory,
        recordedBy: req.user!.id,
        recordedAt: ts,
      });
    });

    await writeAuditLog({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'ADMIN_STORY_EDITED',
      resourceType: 'story',
      resourceId: storyId,
      details: { previousStatus: story.status, newStatus: nextStatus },
      ipAddress: req.ip,
    });
    return res.json({
      success: true,
      message: story.status === 'PUBLISHED'
        ? 'Published story updated and withdrawn from public view pending a new review'
        : nextStatus === 'DRAFT' ? 'Story draft updated' : 'Story updated and submitted for review',
      data: { id: storyId, slug: story.slug, status: nextStatus },
    });
  }),
);

router.get(
  '/stories',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const rows = await db
      .select({
        id: schema.stories.id,
        slug: schema.stories.slug,
        title: schema.stories.title,
        regionName: schema.stories.regionName,
        excerpt: schema.stories.excerpt,
        body: schema.stories.body,
        coverImageUrl: schema.stories.coverImageUrl,
        coverAltText: schema.stories.coverAltText,
        categoryId: schema.stories.categoryId,
        countryName: schema.stories.countryName,
        stateRegionName: schema.stories.stateRegionName,
        communityName: schema.stories.communityName,
        tagsJson: schema.stories.tagsJson,
        isFeatured: schema.stories.isFeatured,
        internalEditorialNotes: schema.stories.internalEditorialNotes,
        anonymousPublication: schema.stories.anonymousPublication,
        isMinorSubject: schema.stories.isMinorSubject,
        status: schema.stories.status,
        publishedAt: schema.stories.publishedAt,
        createdAt: schema.stories.createdAt,
        categoryName: schema.storyCategories.name,
        authorName: schema.userProfiles.displayName,
        consentStory: schema.storyConsents.consentStory,
        consentMedia: schema.storyConsents.consentMedia,
        consentIdentity: schema.storyConsents.consentIdentity,
        guardianConsentRecorded: schema.storyConsents.guardianConsentRecorded,
        consentReference: schema.storyConsents.consentReference,
        consentVerifiedBy: schema.storyConsents.consentVerifiedBy,
        consentVerifiedAt: schema.storyConsents.consentVerifiedAt,
        consentExpiresAt: schema.storyConsents.consentExpiresAt,
        withdrawnAt: schema.storyConsents.withdrawnAt,
      })
      .from(schema.stories)
      .innerJoin(schema.storyCategories, eq(schema.stories.categoryId, schema.storyCategories.id))
      .leftJoin(schema.userProfiles, eq(schema.stories.authorId, schema.userProfiles.userId))
      .leftJoin(schema.storyConsents, eq(schema.stories.id, schema.storyConsents.storyId))
      .where(isRegionScopedRole(req.user!.role)
        ? and(isNull(schema.stories.deletedAt), eq(schema.stories.regionName, req.user!.region || ''))
        : isNull(schema.stories.deletedAt))
      .orderBy(desc(schema.stories.updatedAt));

    const reviews = rows.length
      ? await db.select({
          storyId: schema.storyReviews.storyId,
          decision: schema.storyReviews.decision,
          editorialNotes: schema.storyReviews.editorialNotes,
          reviewedAt: schema.storyReviews.reviewedAt,
          reviewerName: schema.userProfiles.displayName,
        }).from(schema.storyReviews)
          .leftJoin(schema.userProfiles, eq(schema.storyReviews.reviewerId, schema.userProfiles.userId))
          .where(inArray(schema.storyReviews.storyId, rows.map((story) => story.id)))
          .orderBy(desc(schema.storyReviews.reviewedAt))
      : [];
    const storyIds = rows.map((story) => story.id);
    const [mediaRows, versionRows, assignmentRows, commentRows] = storyIds.length
      ? await Promise.all([
          db.select({
            storyId: schema.storyMedia.storyId,
            url: schema.storyMedia.url,
            altText: schema.storyMedia.altText,
            caption: schema.storyMedia.caption,
          }).from(schema.storyMedia).where(inArray(schema.storyMedia.storyId, storyIds)),
          db.select({
            storyId: schema.storyVersions.storyId,
            versionNumber: schema.storyVersions.versionNumber,
          }).from(schema.storyVersions).where(inArray(schema.storyVersions.storyId, storyIds)),
          db.select({
            storyId: schema.storyAssignments.storyId,
            reviewerId: schema.storyAssignments.reviewerId,
            assignmentReason: schema.storyAssignments.assignmentReason,
            assignedAt: schema.storyAssignments.assignedAt,
            endedAt: schema.storyAssignments.endedAt,
            reviewerName: schema.userProfiles.displayName,
          }).from(schema.storyAssignments)
            .leftJoin(schema.userProfiles, eq(schema.storyAssignments.reviewerId, schema.userProfiles.userId))
            .where(and(inArray(schema.storyAssignments.storyId, storyIds), isNull(schema.storyAssignments.endedAt)))
            .orderBy(desc(schema.storyAssignments.assignedAt)),
          db.select({
            storyId: schema.storyComments.storyId,
            authorId: schema.storyComments.authorId,
            commentBody: schema.storyComments.commentBody,
            resolvedAt: schema.storyComments.resolvedAt,
            createdAt: schema.storyComments.createdAt,
            authorName: schema.userProfiles.displayName,
          }).from(schema.storyComments)
            .leftJoin(schema.userProfiles, eq(schema.storyComments.authorId, schema.userProfiles.userId))
            .where(inArray(schema.storyComments.storyId, storyIds))
            .orderBy(desc(schema.storyComments.createdAt)),
        ])
      : [[], [], [], []];
    return res.json({
      success: true,
      message: 'Stories loaded for moderation',
      data: rows.map((story) => ({
        ...story,
        reviewHistory: reviews.filter((review) => review.storyId === story.id),
        media: mediaRows.filter((item) => item.storyId === story.id),
        versionCount: versionRows.filter((version) => version.storyId === story.id).length,
        assignments: assignmentRows.filter((item) => item.storyId === story.id),
        comments: commentRows.filter((item) => item.storyId === story.id),
        tags: story.tagsJson ? (() => {
          try { return JSON.parse(story.tagsJson) as string[]; } catch { return []; }
        })() : [],
      })),
    });
  }),
);

router.patch(
  '/stories/:id/review',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const storyId = Number(req.params.id);
    const decision = String(req.body?.decision || '').toUpperCase();
    const editorialNotes = String(req.body?.editorialNotes || '').trim();
    const editedTitle = req.body?.title ? String(req.body.title).trim() : undefined;
    const editedBody = req.body?.body ? String(req.body.body).trim() : undefined;

    if (!Number.isSafeInteger(storyId) || storyId < 1 ||
      !['APPROVED', 'SCHEDULED', 'PUBLISHED', 'UNPUBLISHED', 'SUBMITTED', 'RESUBMITTED', 'REJECTED', 'ARCHIVED', 'WITHDRAWN', 'UNDER_REVIEW', 'REVISION_REQUESTED'].includes(decision)) {
      throw new AppError(400, 'Invalid story moderation decision');
    }
    await assertStoryRegionAccess(req.user!, storyId);

    const rows = await db.select().from(schema.stories)
      .where(and(eq(schema.stories.id, storyId), isNull(schema.stories.deletedAt))).limit(1);
    const story = rows[0];
    if (!story) throw new AppError(404, 'Story not found');
    if (
      ['SCHEDULED', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED', 'WITHDRAWN'].includes(decision) &&
      !hasPermission(req.user!.role, 'admin:stories:publish')
    ) {
      throw new AppError(403, 'Your account does not have permission to change this publication state');
    }

    const consentRows = await db
      .select()
      .from(schema.storyConsents)
      .where(eq(schema.storyConsents.storyId, storyId))
      .limit(1);
    const consent = consentRows[0];
    const allowedDecisions: Record<string, string[]> = {
      DRAFT: ['SUBMITTED'],
      SUBMITTED: ['UNDER_REVIEW', 'REVISION_REQUESTED', 'REJECTED'],
      UNDER_REVIEW: ['APPROVED', 'REJECTED', 'REVISION_REQUESTED'],
      REVISION_REQUESTED: ['RESUBMITTED'],
      RESUBMITTED: ['UNDER_REVIEW', 'REVISION_REQUESTED', 'REJECTED'],
      APPROVED: ['SCHEDULED', 'PUBLISHED', 'REJECTED', 'ARCHIVED'],
      SCHEDULED: ['PUBLISHED', 'UNPUBLISHED', 'ARCHIVED'],
      PUBLISHED: ['UNPUBLISHED', 'ARCHIVED', 'WITHDRAWN'],
      UNPUBLISHED: ['RESUBMITTED', 'ARCHIVED'],
      REJECTED: [],
      ARCHIVED: [],
      WITHDRAWN: ['ARCHIVED'],
    };
    if (!allowedDecisions[story.status]?.includes(decision)) {
      throw new AppError(409, `A story in ${story.status} cannot transition to ${decision}`);
    }
    if (
      ['APPROVED', 'SCHEDULED', 'PUBLISHED'].includes(decision) &&
      story.authorId === req.user!.id &&
      req.user!.role !== DASHBOARD_ROLES.PLATFORM_ADMIN
    ) {
      throw new AppError(403, 'A story author cannot independently approve or publish their own submission');
    }

    if (decision === 'PUBLISHED') {
      if (!consent || !consent.consentStory || consent.withdrawnAt) {
        throw new AppError(400, 'Cannot publish a story without active narrative consent');
      }
      if (consent.consentExpiresAt) {
        const expiresAt = new Date(String(consent.consentExpiresAt));
        if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
          throw new AppError(400, 'Cannot publish a story with missing or expired consent');
        }
      }
      if (story.isMinorSubject && !consent.guardianConsentRecorded) {
        throw new AppError(400, 'Cannot publish a minor-related story without guardian consent');
      }
      const [media] = await db.select({ id: schema.storyMedia.id })
        .from(schema.storyMedia).where(eq(schema.storyMedia.storyId, storyId)).limit(1);
      if ((story.coverImageUrl || media) && !consent.consentMedia) {
        throw new AppError(400, 'Media consent is required before publishing a story with a cover image');
      }
      if (!story.anonymousPublication && !consent.consentIdentity) {
        throw new AppError(400, 'Identity consent is required before publishing a named story');
      }
    }
    if (editorialNotes.length < 8 || editorialNotes.length > 2000) {
      throw new AppError(400, 'Provide between 8 and 2,000 characters of editorial notes');
    }
    if (editedTitle !== undefined && (editedTitle.length < 6 || editedTitle.length > 200)) {
      throw new AppError(400, 'Story title must be between 6 and 200 characters');
    }
    if (editedBody !== undefined && (editedBody.length < 80 || editedBody.length > 12000)) {
      throw new AppError(400, 'Story body must be between 80 and 12,000 characters');
    }

    const ts = nowUtc();
    const scheduledFor = decision === 'SCHEDULED'
      ? String(req.body?.scheduledFor || '').trim()
      : '';
    if (decision === 'SCHEDULED') {
      const scheduledDate = new Date(scheduledFor);
      if (!scheduledFor || !Number.isFinite(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) {
        throw new AppError(400, 'A future publication date and time is required');
      }
    }
    await db.transaction(async (tx) => {
      await tx
        .update(schema.stories)
        .set({
          status: decision,
          title: editedTitle || story.title,
          body: editedBody || story.body,
          publishedAt: decision === 'PUBLISHED'
            ? ts
            : decision === 'SCHEDULED'
              ? scheduledFor
              : story.publishedAt,
          updatedAt: ts,
        })
        .where(eq(schema.stories.id, storyId));

      await tx.insert(schema.storyReviews).values({
        storyId,
        reviewerId: req.user!.id,
        decision,
        editorialNotes: editorialNotes || null,
        reviewedAt: ts,
      });

      if (decision === 'PUBLISHED') {
        await tx.insert(schema.storyPublications).values({
          storyId,
          publishedBy: req.user!.id,
          scheduledFor: null,
          publishedAt: ts,
        });
      }
      if (decision === 'SCHEDULED') {
        await tx.insert(schema.storyPublications).values({
          storyId,
          publishedBy: req.user!.id,
          scheduledFor,
          publishedAt: scheduledFor,
        });
      }
    });

    await createNotification({
      userId: story.authorId,
      eventType: `STORY_${decision}`,
      title: `Story "${story.title}" ${decision}`,
      message: editorialNotes || `Editorial review completed with status ${decision}.`,
    });

    await writeAuditLog({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: `ADMIN_STORY_${decision}`,
      resourceType: 'story',
      resourceId: storyId,
      details: { previousStatus: story.status, newStatus: decision, editorialNotes },
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: `Story updated to ${decision}`, data: null });
  }),
);

router.patch(
  '/stories/:id/assign',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!hasPermission(req.user!.role, 'admin:stories:moderate')) {
      throw new AppError(403, 'Your account cannot assign editorial reviewers');
    }
    const storyId = Number(req.params.id);
    const reviewerId = Number(req.body?.reviewerId);
    const assignmentReason = String(req.body?.assignmentReason || '').trim();
    if (!Number.isSafeInteger(storyId) || storyId < 1 ||
      !Number.isSafeInteger(reviewerId) || reviewerId < 1 ||
      assignmentReason.length < 8) {
      throw new AppError(400, 'Select a valid reviewer and provide an assignment reason');
    }
    await assertStoryRegionAccess(req.user!, storyId);
    const [story] = await db.select({ authorId: schema.stories.authorId })
      .from(schema.stories).where(and(eq(schema.stories.id, storyId), isNull(schema.stories.deletedAt))).limit(1);
    if (!story) throw new AppError(404, 'Story not found');
    if (story.authorId === reviewerId) throw new AppError(409, 'The story author cannot be assigned as an independent reviewer');
    const [reviewer] = await db.select({ id: schema.users.id, role: schema.users.role, status: schema.users.status })
      .from(schema.users).where(eq(schema.users.id, reviewerId)).limit(1);
    if (!reviewer || reviewer.status !== 'ACTIVE' ||
      !['STORY_MODERATOR', 'EDITOR', 'REVIEWER', 'SAFEGUARDING_OFFICER', 'PLATFORM_ADMIN'].includes(reviewer.role)) {
      throw new AppError(400, 'Select an active editorial reviewer');
    }
    const ts = nowUtc();
    await db.transaction(async (tx) => {
      await tx.update(schema.storyAssignments)
        .set({ endedAt: ts })
        .where(and(eq(schema.storyAssignments.storyId, storyId), isNull(schema.storyAssignments.endedAt)));
      await tx.insert(schema.storyAssignments).values({
        storyId,
        reviewerId,
        assignedBy: req.user!.id,
        assignmentReason,
        assignedAt: ts,
      });
    });
    await createNotification({
      userId: reviewerId,
      eventType: 'STORY_REVIEW_ASSIGNED',
      title: 'Story review assigned',
      message: assignmentReason,
    });
    await writeAuditLog({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'ADMIN_STORY_REVIEW_ASSIGNED',
      resourceType: 'story',
      resourceId: storyId,
      details: { reviewerId, assignmentReason },
      ipAddress: req.ip,
    });
    return res.json({ success: true, message: 'Reviewer assigned', data: { storyId, reviewerId } });
  }),
);

router.patch(
  '/stories/:id/consent/withdraw',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!hasPermission(req.user!.role, 'admin:stories:publish') &&
      !hasPermission(req.user!.role, 'admin:stories:moderate')) {
      throw new AppError(403, 'Your account cannot withdraw story consent');
    }
    const storyId = Number(req.params.id);
    const reason = String(req.body?.reason || '').trim();
    if (!Number.isSafeInteger(storyId) || storyId < 1 || reason.length < 8) {
      throw new AppError(400, 'Provide a reason for consent withdrawal');
    }
    await assertStoryRegionAccess(req.user!, storyId);
    const ts = nowUtc();
    await db.transaction(async (tx) => {
      await tx.update(schema.storyConsents)
        .set({ withdrawnAt: ts })
        .where(eq(schema.storyConsents.storyId, storyId));
      await tx.update(schema.stories)
        .set({ status: 'WITHDRAWN', updatedAt: ts, publishedAt: null })
        .where(eq(schema.stories.id, storyId));
      await tx.insert(schema.consentRecords).values({
        subjectType: 'STORY',
        subjectId: storyId,
        consentScope: 'STORY_PUBLICATION',
        granted: false,
        recordedBy: req.user!.id,
        recordedAt: ts,
      });
    });
    await writeAuditLog({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'ADMIN_STORY_CONSENT_WITHDRAWN',
      resourceType: 'story',
      resourceId: storyId,
      details: { reason },
      ipAddress: req.ip,
    });
    return res.json({ success: true, message: 'Consent withdrawn; the story is no longer public', data: null });
  }),
);

router.post(
  '/stories/:id/comments',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!hasPermission(req.user!.role, 'admin:stories:moderate')) {
      throw new AppError(403, 'Your account cannot add editorial comments');
    }
    const storyId = Number(req.params.id);
    const commentBody = String(req.body?.commentBody || '').trim();
    if (!Number.isSafeInteger(storyId) || storyId < 1 ||
      commentBody.length < 3 || commentBody.length > 2000) {
      throw new AppError(400, 'Enter a 3 to 2,000 character internal comment');
    }
    await assertStoryRegionAccess(req.user!, storyId);
    const ts = nowUtc();
    await db.insert(schema.storyComments).values({
      storyId,
      authorId: req.user!.id,
      commentBody,
      createdAt: ts,
    });
    await writeAuditLog({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'ADMIN_STORY_COMMENT_ADDED',
      resourceType: 'story',
      resourceId: storyId,
      details: { commentLength: commentBody.length },
      ipAddress: req.ip,
    });
    return res.status(201).json({ success: true, message: 'Internal editorial comment added', data: null });
  }),
);

router.post(
  '/stories/:id/translate-draft',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const storyId = Number(req.params.id);
    const targetLocale = String(req.body?.targetLocale || 'ar') as SupportedLocale;
    if (!['nus', 'ar', 'am', 'en'].includes(targetLocale)) {
      throw new AppError(400, 'Unsupported translation target language');
    }
    await assertStoryRegionAccess(req.user!, storyId);
    const rows = await db.select().from(schema.stories).where(eq(schema.stories.id, storyId)).limit(1);
    const story = rows[0];
    if (!story) throw new AppError(404, 'Story not found');

    const draft = await generateTranslationDraft({
      title: story.title,
      excerpt: story.excerpt,
      body: story.body,
      targetLocale,
    });

    return res.json({
      success: true,
      message: 'Translation draft prepared for human editorial review',
      data: draft,
    });
  }),
);

// Campaign Management
router.get(
  '/campaigns',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const [rows, assignments] = await Promise.all([
      db.select().from(schema.campaigns)
        .where(isNull(schema.campaigns.deletedAt))
        .orderBy(desc(schema.campaigns.createdAt)),
      db.select({
        campaignId: schema.campaignAssignments.campaignId,
        coordinatorId: schema.campaignAssignments.coordinatorId,
        coordinatorName: schema.userProfiles.displayName,
        assignedAt: schema.campaignAssignments.assignedAt,
      }).from(schema.campaignAssignments)
        .leftJoin(schema.userProfiles, eq(schema.campaignAssignments.coordinatorId, schema.userProfiles.userId))
        .where(isNull(schema.campaignAssignments.endedAt))
        .orderBy(desc(schema.campaignAssignments.assignedAt)),
    ]);
    let visibleRows = rows;
    if (isRegionScopedRole(req.user!.role)) {
      const relatedCases = rows.length
        ? await db.select({
            campaignId: schema.campaignCases.campaignId,
            regionName: schema.communityLocations.regionName,
          }).from(schema.campaignCases)
            .innerJoin(schema.humanitarianCases, eq(schema.campaignCases.caseId, schema.humanitarianCases.id))
            .innerJoin(schema.communityLocations, eq(schema.humanitarianCases.locationId, schema.communityLocations.id))
            .where(inArray(schema.campaignCases.campaignId, rows.map((row) => row.id)))
        : [];
      visibleRows = rows.filter((campaign) => {
        const regions = relatedCases.filter((item) => item.campaignId === campaign.id);
        if (!regions.length) {
          return campaign.createdBy === req.user!.id;
        }
        return regions.every((item) => hasRegionAccess(req.user!, item.regionName));
      });
    }
    const currentAssignments = new Map<number, (typeof assignments)[number]>();
    for (const assignment of assignments) {
      if (!currentAssignments.has(assignment.campaignId)) currentAssignments.set(assignment.campaignId, assignment);
    }
    return res.json({
      success: true,
      message: 'Campaigns loaded',
      data: visibleRows.map((campaign) => ({
        ...campaign,
        ...(currentAssignments.get(campaign.id) || { coordinatorId: null, coordinatorName: null, assignedAt: null }),
      })),
    });
  }),
);

router.post(
  '/campaigns',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = createCampaignSchema.parse(req.body);
    const ts = nowUtc();
    const slug = slugify(parsed.title);
    const linkedCaseIds = [...new Set(parsed.linkedCaseIds || [])];
    let coordinator: { id: number; displayName: string | null } | undefined;
    if (parsed.coordinatorId) {
      const [activeCoordinator] = await db.select({
        id: schema.users.id,
        displayName: schema.userProfiles.displayName,
        region: schema.userProfiles.region,
      }).from(schema.users)
        .leftJoin(schema.userProfiles, eq(schema.users.id, schema.userProfiles.userId))
        .where(and(
          eq(schema.users.id, parsed.coordinatorId),
          eq(schema.users.role, DASHBOARD_ROLES.COMMUNITY_COORDINATOR),
          eq(schema.users.status, 'ACTIVE'),
          isNull(schema.users.deletedAt),
        ))
        .limit(1);
      if (!activeCoordinator) throw new AppError(400, 'Select an active Community Coordinator account');
      if (isRegionScopedRole(req.user!.role) && !regionsMatch(req.user!.region, activeCoordinator.region)) {
        throw new AppError(403, 'The coordinator must belong to your assigned region');
      }
      coordinator = activeCoordinator;
    }
    if (linkedCaseIds.length) {
      const eligibleCases = await db
        .select({
          id: schema.humanitarianCases.id,
          regionName: schema.communityLocations.regionName,
        })
        .from(schema.humanitarianCases)
        .innerJoin(schema.communityLocations, eq(schema.humanitarianCases.locationId, schema.communityLocations.id))
        .where(and(
          sql`${schema.humanitarianCases.id} IN (${sql.join(linkedCaseIds.map((id) => sql`${id}`), sql`, `)})`,
          eq(schema.humanitarianCases.status, 'VERIFIED'),
          isNull(schema.humanitarianCases.deletedAt),
        ));
      if (eligibleCases.length !== linkedCaseIds.length) {
        throw new AppError(400, 'Campaigns can only link to existing, verified cases');
      }
      if (isRegionScopedRole(req.user!.role) &&
        eligibleCases.some((record) => !hasRegionAccess(req.user!, record.regionName))) {
        throw new AppError(403, 'Campaigns may only link cases from your assigned region');
      }
    }

    let campaign: typeof schema.campaigns.$inferSelect | undefined;
    await db.transaction(async (tx) => {
      await tx.insert(schema.campaigns).values([{
        slug,
        title: parsed.title,
        summary: parsed.summary,
        description: parsed.description,
        targetAmount: parsed.targetAmount,
        raisedAmount: 0,
        currency: parsed.currency.toUpperCase(),
        coverImageUrl: parsed.coverImageUrl || null,
        status: 'DRAFT',
        startDate: new Date(parsed.startDate).toISOString(),
        endDate: new Date(parsed.endDate).toISOString(),
        createdBy: req.user!.id,
        createdAt: ts,
        updatedAt: ts,
      }]);

      const createdRows = await tx.select().from(schema.campaigns).where(eq(schema.campaigns.slug, slug)).limit(1);
      campaign = createdRows[0];
      if (!campaign) throw new AppError(500, 'Campaign was not created');

      if (linkedCaseIds.length) {
        await tx.insert(schema.campaignCases).values(
          linkedCaseIds.map((caseId) => ({ campaignId: campaign!.id, caseId })),
        );
      }
      if (coordinator) {
        await tx.insert(schema.campaignAssignments).values([{
          campaignId: campaign.id,
          coordinatorId: coordinator.id,
          assignedBy: req.user!.id,
          assignmentReason: parsed.assignmentReason!,
          assignedAt: ts,
          endedAt: null,
        }]);
        await tx.insert(schema.notifications).values([{
          userId: coordinator.id,
          eventType: 'CAMPAIGN_ASSIGNED',
          title: `Campaign assignment: ${campaign.title}`,
          message: parsed.assignmentReason!,
          isRead: false,
          createdAt: ts,
        }]);
      }
    });
    if (!campaign) throw new AppError(500, 'Campaign was not created');

    await writeAuditLog({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'ADMIN_CAMPAIGN_CREATED',
      resourceType: 'campaign',
      resourceId: campaign.id,
      details: {
        title: parsed.title,
        targetAmount: parsed.targetAmount,
        status: 'DRAFT',
        coordinatorId: coordinator?.id,
      },
      ipAddress: req.ip,
    });

    return res.status(201).json({ success: true, message: 'Campaign created', data: campaign });
  }),
);

router.patch('/campaigns/:id/assign-coordinator', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const campaignId = Number(req.params.id);
  const coordinatorId = Number(req.body?.coordinatorId);
  const assignmentReason = String(req.body?.assignmentReason || '').trim();
  if (!Number.isSafeInteger(campaignId) || campaignId < 1 ||
    !Number.isSafeInteger(coordinatorId) || coordinatorId < 1) {
    throw new AppError(400, 'Select a valid campaign and coordinator');
  }
  if (assignmentReason.length < 8 || assignmentReason.length > 1500) {
    throw new AppError(400, 'Provide between 8 and 1,500 characters explaining the assignment');
  }
  const [campaign] = await db.select({
    id: schema.campaigns.id,
    title: schema.campaigns.title,
    status: schema.campaigns.status,
  }).from(schema.campaigns)
    .where(and(eq(schema.campaigns.id, campaignId), isNull(schema.campaigns.deletedAt)))
    .limit(1);
  if (!campaign) throw new AppError(404, 'Campaign not found');
  await assertCampaignRegionAccess(req.user!, campaignId);
  const [coordinator] = await db.select({
    id: schema.users.id,
    displayName: schema.userProfiles.displayName,
    region: schema.userProfiles.region,
  }).from(schema.users)
    .leftJoin(schema.userProfiles, eq(schema.users.id, schema.userProfiles.userId))
    .where(and(
      eq(schema.users.id, coordinatorId),
      eq(schema.users.role, DASHBOARD_ROLES.COMMUNITY_COORDINATOR),
      eq(schema.users.status, 'ACTIVE'),
      isNull(schema.users.deletedAt),
    ))
    .limit(1);
  if (!coordinator) throw new AppError(400, 'Select an active Community Coordinator account');
  if (isRegionScopedRole(req.user!.role) && !regionsMatch(req.user!.region, coordinator.region)) {
    throw new AppError(403, 'The coordinator must belong to your assigned region');
  }
  const [currentAssignment] = await db.select({ coordinatorId: schema.campaignAssignments.coordinatorId })
    .from(schema.campaignAssignments)
    .where(and(
      eq(schema.campaignAssignments.campaignId, campaignId),
      isNull(schema.campaignAssignments.endedAt),
    ))
    .orderBy(desc(schema.campaignAssignments.assignedAt))
    .limit(1);
  if (currentAssignment?.coordinatorId === coordinatorId) {
    throw new AppError(409, 'This coordinator is already assigned to the campaign');
  }
  const ts = nowUtc();
  await db.transaction(async (tx) => {
    await tx.update(schema.campaignAssignments)
      .set({ endedAt: ts })
      .where(and(
        eq(schema.campaignAssignments.campaignId, campaignId),
        isNull(schema.campaignAssignments.endedAt),
      ));
    await tx.insert(schema.campaignAssignments).values([{
      campaignId,
      coordinatorId,
      assignedBy: req.user!.id,
      assignmentReason,
      assignedAt: ts,
      endedAt: null,
    }]);
    await tx.insert(schema.notifications).values([{
      userId: coordinatorId,
      eventType: 'CAMPAIGN_ASSIGNED',
      title: `Campaign assignment: ${campaign.title}`,
      message: assignmentReason,
      isRead: false,
      createdAt: ts,
    }]);
  });
  await writeAuditLog({
    actorUserId: req.user!.id,
    actorRole: req.user!.role,
    action: 'ADMIN_CAMPAIGN_COORDINATOR_ASSIGNED',
    resourceType: 'campaign',
    resourceId: campaignId,
    details: {
      previousCoordinatorId: currentAssignment?.coordinatorId || null,
      coordinatorId,
      assignmentReason,
    },
    ipAddress: req.ip,
  });
  return res.json({
    success: true,
    message: `Campaign assigned to ${coordinator.displayName || 'coordinator'}`,
    data: { campaignId, coordinatorId },
  });
}));

router.patch(
  '/campaigns/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const campaignId = Number(req.params.id);
    const status = req.body?.status ? String(req.body.status).toUpperCase() : undefined;
    const targetAmount = req.body?.targetAmount !== undefined ? Number(req.body.targetAmount) : undefined;
    if (!Number.isSafeInteger(campaignId) || campaignId < 1) throw new AppError(400, 'Invalid campaign ID');
    if (status && !CAMPAIGN_STATUSES.includes(status as CampaignStatus)) {
      throw new AppError(400, 'Invalid campaign status');
    }
    if (targetAmount !== undefined && (!Number.isFinite(targetAmount) || targetAmount <= 0 || targetAmount > 999999999999.99)) {
      throw new AppError(400, 'Campaign target must be a positive valid amount');
    }
    if (!status && targetAmount === undefined) throw new AppError(400, 'Provide a campaign status or target amount');

    const [existing] = await db.select().from(schema.campaigns)
      .where(and(eq(schema.campaigns.id, campaignId), isNull(schema.campaigns.deletedAt))).limit(1);
    if (!existing) throw new AppError(404, 'Campaign not found');
    await assertCampaignRegionAccess(req.user!, campaignId);

    if (status) {
      const allowedTransitions: Record<string, string[]> = {
        DRAFT: ['PENDING_APPROVAL'],
        PENDING_APPROVAL: ['APPROVED', 'REJECTED'],
        APPROVED: ['ACTIVE', 'ARCHIVED'],
        ACTIVE: ['PAUSED', 'COMPLETED', 'CANCELLED'],
        PAUSED: ['ACTIVE', 'COMPLETED', 'CANCELLED'],
        COMPLETED: ['ARCHIVED'],
        CANCELLED: ['ARCHIVED'],
        REJECTED: ['DRAFT'],
        ARCHIVED: [],
        CLOSED: ['ARCHIVED'],
      };
      if (!allowedTransitions[existing.status]?.includes(status)) {
        throw new AppError(409, `A campaign in ${existing.status} cannot transition to ${status}`);
      }
    }

    const ts = nowUtc();
    const updates: Record<string, unknown> = { updatedAt: ts };
    if (status) updates.status = status;
    if (targetAmount !== undefined) updates.targetAmount = targetAmount;

    await db.transaction(async (tx) => {
      await tx.update(schema.campaigns).set(updates).where(eq(schema.campaigns.id, campaignId));
      if (status === 'ACTIVE' && existing.status === 'APPROVED') {
        await tx.insert(schema.campaignPublications).values({
          campaignId,
          publishedBy: req.user!.id,
          publishedAt: ts,
        });
      }
    });
    if (status) invalidateImpactSummaryCache();

    await writeAuditLog({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'ADMIN_CAMPAIGN_UPDATED',
      resourceType: 'campaign',
      resourceId: campaignId,
      details: { previousStatus: existing.status, newStatus: status || existing.status, targetAmount },
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'Campaign updated', data: { id: campaignId, status: status || existing.status } });
  }),
);

router.get('/field-reports', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const [reports, activities] = await Promise.all([
    db.select({
      id: schema.fieldReports.id,
      coordinatorId: schema.fieldReports.coordinatorId,
      coordinatorName: schema.userProfiles.displayName,
      visitDate: schema.fieldReports.visitDate,
      summary: schema.fieldReports.summary,
      assistanceDelivered: schema.fieldReports.assistanceDelivered,
      peopleReached: schema.fieldReports.peopleReached,
      regionName: schema.communityLocations.regionName,
      caseReference: schema.humanitarianCases.referenceCode,
      caseTitle: schema.humanitarianCases.title,
      createdAt: schema.fieldReports.createdAt,
    })
      .from(schema.fieldReports)
      .innerJoin(schema.communityLocations, eq(schema.fieldReports.locationId, schema.communityLocations.id))
      .leftJoin(schema.userProfiles, eq(schema.fieldReports.coordinatorId, schema.userProfiles.userId))
      .leftJoin(schema.humanitarianCases, eq(schema.fieldReports.caseId, schema.humanitarianCases.id))
      .where(isRegionScopedRole(req.user!.role)
        ? eq(schema.communityLocations.regionName, req.user!.region || '')
        : undefined)
      .orderBy(desc(schema.fieldReports.visitDate)),
    db.select({
      reportId: schema.fieldActivities.reportId,
      activityTitle: schema.fieldActivities.activityTitle,
      notes: schema.fieldActivities.notes,
    }).from(schema.fieldActivities),
  ]);
  return res.json({
    success: true,
    message: 'Field outreach reports loaded',
    data: reports.map((report) => ({
      ...report,
      activities: activities.filter((activity) => activity.reportId === report.id),
    })),
  });
}));

router.get('/announcements', asyncHandler(async (_req, res) => {
  const rows = await db.select({
    id: schema.announcements.id,
    title: schema.announcements.title,
    body: schema.announcements.body,
    targetRole: schema.announcements.targetRole,
    publishedAt: schema.announcements.publishedAt,
    createdByName: schema.userProfiles.displayName,
  })
    .from(schema.announcements)
    .leftJoin(schema.userProfiles, eq(schema.announcements.createdBy, schema.userProfiles.userId))
    .orderBy(desc(schema.announcements.publishedAt))
    .limit(100);
  return res.json({ success: true, message: 'Announcements loaded', data: rows });
}));

router.post('/announcements', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const title = String(req.body?.title || '').trim();
  const body = String(req.body?.body || '').trim();
  const targetRole = String(req.body?.targetRole || 'ALL').toUpperCase();
  if (title.length < 5 || title.length > 180 || body.length < 20 || body.length > 4000) {
    throw new AppError(400, 'Announcement title or message is outside the allowed length');
  }
  if (!['ALL', 'COMMUNITY_COORDINATOR'].includes(targetRole)) {
    throw new AppError(400, 'Select a supported announcement audience');
  }
  const audience = await db.select({ id: schema.users.id })
    .from(schema.users)
    .where(and(
      eq(schema.users.status, 'ACTIVE'),
      isNull(schema.users.deletedAt),
      ...(targetRole === 'ALL' ? [] : [eq(schema.users.role, DASHBOARD_ROLES.COMMUNITY_COORDINATOR)]),
    ));
  const ts = nowUtc();
  let announcementId = 0;
  await db.transaction(async (tx) => {
    await tx.insert(schema.announcements).values([{
      title,
      body,
      targetRole,
      createdBy: req.user!.id,
      publishedAt: ts,
    }]);
    const [announcement] = await tx.select({ id: schema.announcements.id })
      .from(schema.announcements)
      .where(and(eq(schema.announcements.title, title), eq(schema.announcements.createdBy, req.user!.id)))
      .orderBy(desc(schema.announcements.id))
      .limit(1);
    if (!announcement) throw new AppError(500, 'Announcement was not saved');
    announcementId = announcement.id;
    if (audience.length) {
      await tx.insert(schema.notifications).values(audience.map(({ id }) => ({
        userId: id,
        eventType: 'ANNOUNCEMENT_PUBLISHED',
        title,
        message: body,
        isRead: false,
        createdAt: ts,
      })));
    }
  });
  await writeAuditLog({
    actorUserId: req.user!.id,
    actorRole: req.user!.role,
    action: 'ADMIN_ANNOUNCEMENT_PUBLISHED',
    resourceType: 'announcement',
    resourceId: announcementId,
    details: { targetRole, recipients: audience.length },
    ipAddress: req.ip,
  });
  return res.status(201).json({
    success: true,
    message: `Announcement published to ${audience.length} active account(s)`,
    data: { id: announcementId, recipientCount: audience.length },
  });
}));

router.get('/article-categories', asyncHandler(async (_req, res) => {
  const rows = await db.select().from(schema.articleCategories).orderBy(schema.articleCategories.name);
  return res.json({ success: true, message: 'News categories loaded', data: rows });
}));

router.get('/articles', asyncHandler(async (_req, res) => {
  const rows = await db
    .select({
      id: schema.articles.id,
      slug: schema.articles.slug,
      title: schema.articles.title,
      summary: schema.articles.summary,
      body: schema.articles.body,
      coverImageUrl: schema.articles.coverImageUrl,
      status: schema.articles.status,
      publishedAt: schema.articles.publishedAt,
      categoryId: schema.articles.categoryId,
      categoryName: schema.articleCategories.name,
      authorName: schema.userProfiles.displayName,
    })
    .from(schema.articles)
    .innerJoin(schema.articleCategories, eq(schema.articles.categoryId, schema.articleCategories.id))
    .leftJoin(schema.userProfiles, eq(schema.articles.authorId, schema.userProfiles.userId))
    .orderBy(desc(schema.articles.publishedAt));
  return res.json({ success: true, message: 'News articles loaded', data: rows });
}));

router.patch('/articles/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const articleId = Number(req.params.id);
  if (!Number.isSafeInteger(articleId) || articleId < 1) throw new AppError(400, 'Invalid article ID');
  const [article] = await db.select().from(schema.articles).where(eq(schema.articles.id, articleId)).limit(1);
  if (!article) throw new AppError(404, 'Article not found');

  const status = req.body?.status === undefined ? undefined : String(req.body.status).toUpperCase();
  if (status && !ARTICLE_STATUSES.includes(status as ArticleStatus)) throw new AppError(400, 'Invalid article status');

  const hasContentEdits = ['title', 'summary', 'body', 'categoryId', 'coverImageUrl']
    .some((key) => req.body?.[key] !== undefined);
  if (hasContentEdits && !['DRAFT', 'REVISION_REQUESTED'].includes(article.status)) {
    throw new AppError(409, 'Only draft or revision-requested articles can be edited');
  }

  const updates: Record<string, unknown> = {};
  if (hasContentEdits) {
    const title = req.body?.title === undefined ? article.title : String(req.body.title).trim();
    const summary = req.body?.summary === undefined ? article.summary : String(req.body.summary).trim();
    const body = req.body?.body === undefined ? article.body : String(req.body.body).trim();
    const categoryId = req.body?.categoryId === undefined ? article.categoryId : Number(req.body.categoryId);
    const coverImageUrl = req.body?.coverImageUrl === undefined
      ? article.coverImageUrl
      : String(req.body.coverImageUrl).trim() || null;
    if (title.length < 5 || title.length > 200 || summary.length < 15 || summary.length > 2000 ||
      body.length < 40 || body.length > 20000 || !Number.isSafeInteger(categoryId) || categoryId < 1 ||
      (coverImageUrl !== null && coverImageUrl.length > 500)) {
      throw new AppError(400, 'Article content is invalid or outside the allowed length');
    }
    const [category] = await db.select({ id: schema.articleCategories.id })
      .from(schema.articleCategories).where(eq(schema.articleCategories.id, categoryId)).limit(1);
    if (!category) throw new AppError(400, 'Select an existing news category');
    Object.assign(updates, {
      title,
      slug: title === article.title ? article.slug : slugify(title),
      summary,
      body,
      categoryId,
      coverImageUrl,
    });
  }

  if (status) {
    const allowedTransitions: Record<string, string[]> = {
      DRAFT: ['SUBMITTED'],
      SUBMITTED: ['APPROVED', 'REVISION_REQUESTED', 'REJECTED'],
      APPROVED: ['PUBLISHED'],
      REVISION_REQUESTED: ['DRAFT'],
      REJECTED: ['ARCHIVED'],
      PUBLISHED: ['ARCHIVED'],
      ARCHIVED: [],
    };
    if (!allowedTransitions[article.status]?.includes(status)) {
      throw new AppError(409, `An article in ${article.status} cannot transition to ${status}`);
    }
    const notes = String(req.body?.notes || '').trim();
    if (['APPROVED', 'PUBLISHED', 'REVISION_REQUESTED', 'REJECTED'].includes(status) &&
      (notes.length < 8 || notes.length > 2000)) {
      throw new AppError(400, 'Provide between 8 and 2,000 characters explaining the editorial decision');
    }
    updates.status = status;
    if (status === 'PUBLISHED') updates.publishedAt = nowUtc();
  }
  if (!Object.keys(updates).length) throw new AppError(400, 'Provide article content changes or a valid status transition');

  await db.update(schema.articles).set(updates).where(eq(schema.articles.id, articleId));
  await writeAuditLog({
    actorUserId: req.user!.id,
    actorRole: req.user!.role,
    action: status ? `ADMIN_ARTICLE_${status}` : 'ADMIN_ARTICLE_EDITED',
    resourceType: 'article',
    resourceId: articleId,
    details: {
      previousStatus: article.status,
      newStatus: status || article.status,
      notes: req.body?.notes ? String(req.body.notes).trim() : undefined,
      editedFields: Object.keys(updates).filter((key) => key !== 'status'),
    },
    ipAddress: req.ip,
  });
  return res.json({
    success: true,
    message: status ? `Article moved to ${status}` : 'Article saved',
    data: { id: articleId, status: status || article.status },
  });
}));

// Financial & Donation Administration
router.get(
  '/donations',
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({
        id: schema.donations.id,
        donationReference: schema.donations.donationReference,
        campaignId: schema.donations.campaignId,
        campaignTitle: schema.campaigns.title,
        amount: schema.donations.amount,
        currency: schema.donations.currency,
        donorName: schema.donations.donorName,
        donorEmail: schema.donations.donorEmail,
        isAnonymous: schema.donations.isAnonymous,
        status: schema.donations.status,
        paymentChannel: schema.donations.paymentChannel,
        confirmedAt: schema.donations.confirmedAt,
        createdAt: schema.donations.createdAt,
      })
      .from(schema.donations)
      .leftJoin(schema.campaigns, eq(schema.donations.campaignId, schema.campaigns.id))
      .orderBy(desc(schema.donations.createdAt));

    const distributions = await db
      .select({
        id: schema.assistanceDistributions.id,
        caseReference: schema.humanitarianCases.referenceCode,
        caseTitle: schema.humanitarianCases.title,
        amountUsd: schema.assistanceDistributions.amountUsd,
        distributionNotes: schema.assistanceDistributions.distributionNotes,
        distributedAt: schema.assistanceDistributions.distributedAt,
      })
      .from(schema.assistanceDistributions)
      .innerJoin(schema.humanitarianCases, eq(schema.assistanceDistributions.caseId, schema.humanitarianCases.id))
      .orderBy(desc(schema.assistanceDistributions.distributedAt));

    return res.json({ success: true, message: 'Financial ledger loaded', data: { donations: rows, distributions } });
  }),
);

// Requires documented external ledger reference + reconciliation audit trail.
// NEVER permits marking an unverified donation confirmed without provider settlement or formal reconciliation record.
router.post(
  '/donations/:id/reconcile',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const donationId = Number(req.params.id);
    const externalLedgerRef = String(req.body?.externalLedgerRef || '').trim();
    const reconciliationNote = String(req.body?.reconciliationNote || '').trim();
    if (!externalLedgerRef || !reconciliationNote) {
      throw new AppError(400, 'External settlement reference and reconciliation note are mandatory');
    }

    const rows = await db.select().from(schema.donations).where(eq(schema.donations.id, donationId)).limit(1);
    const donation = rows[0];
    if (!donation) throw new AppError(404, 'Donation not found');
    if (donation.status !== 'CONFIRMED') {
      throw new AppError(
        400,
        'Unverified payments cannot be confirmed manually without verified gateway settlement callback',
      );
    }

    const ts = nowUtc();
    await db.insert(schema.financialReconciliations).values({
      donationId,
      reconciledBy: req.user!.id,
      externalLedgerRef,
      reconciliationNote,
      reconciledAt: ts,
    });

    await writeAuditLog({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'ADMIN_DONATION_RECONCILED',
      resourceType: 'donation',
      resourceId: donation.donationReference,
      details: { externalLedgerRef, reconciliationNote },
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'Donation reconciled with audit record', data: null });
  }),
);

router.post('/donations/:id/refund', asyncHandler(async () => {
  throw new AppError(503, 'Online payment refunds are disabled. HumanityBridge records external bank transfers only.');
}));


router.post('/distributions', asyncHandler(async () => {
  throw new AppError(410, 'Direct distribution recording is retired. Submit external bank-transfer evidence through the coordinator workflow and verify it here before issuing a receipt.');
}));

router.get('/bank-transfers', asyncHandler(async (_req, res) => {
  const rows = await db.select({
    id: schema.bankTransferRecords.id, caseId: schema.bankTransferRecords.caseId,
    caseReference: schema.humanitarianCases.referenceCode, caseTitle: schema.humanitarianCases.title,
    beneficiaryName: schema.bankTransferRecords.beneficiaryName, bankName: schema.bankTransferRecords.bankName,
    bankReference: schema.bankTransferRecords.bankReference, amount: schema.bankTransferRecords.amount,
    currency: schema.bankTransferRecords.currency, transferDate: schema.bankTransferRecords.transferDate,
    recipientAccountLast4: schema.bankTransferRecords.recipientAccountLast4, purpose: schema.bankTransferRecords.purpose,
    notes: schema.bankTransferRecords.notes, status: schema.bankTransferRecords.status,
    verificationNotes: schema.bankTransferRecords.verificationNotes, receiptNumber: schema.bankTransferRecords.receiptNumber,
    evidenceMediaId: schema.bankTransferRecords.evidenceMediaId, recordedByName: schema.userProfiles.displayName,
    createdAt: schema.bankTransferRecords.createdAt,
  }).from(schema.bankTransferRecords)
    .innerJoin(schema.humanitarianCases, eq(schema.bankTransferRecords.caseId, schema.humanitarianCases.id))
    .leftJoin(schema.userProfiles, eq(schema.bankTransferRecords.recordedBy, schema.userProfiles.userId))
    .orderBy(desc(schema.bankTransferRecords.createdAt));
  return res.json({ success: true, message: 'External bank transfers loaded', data: rows });
}));

router.patch('/bank-transfers/:id/review', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const transferId = Number(req.params.id);
  const decision = String(req.body?.decision || '').toUpperCase();
  const verificationNotes = String(req.body?.verificationNotes || '').trim();
  if (!Number.isSafeInteger(transferId) || transferId < 1 || !['VERIFIED', 'REJECTED'].includes(decision) ||
      verificationNotes.length < 8 || verificationNotes.length > 1500) {
    throw new AppError(400, 'A valid review decision and detailed verification notes are required.');
  }
  const rows = await db.select().from(schema.bankTransferRecords).where(eq(schema.bankTransferRecords.id, transferId)).limit(1);
  const transfer = rows[0];
  if (!transfer) throw new AppError(404, 'Bank transfer record not found.');
  if (transfer.status !== 'PENDING_REVIEW') throw new AppError(409, 'Only pending transfers can be reviewed.');
  if (transfer.recordedBy === req.user!.id) throw new AppError(403, 'The person who submitted transfer evidence cannot independently verify it.');

  const ts = nowUtc();
  const receiptNumber = decision === 'VERIFIED' ? generateReferenceCode('HB-RCT') : null;
  await db.transaction(async (tx) => {
    const updateResult = await tx.update(schema.bankTransferRecords).set({
      status: decision, verifiedBy: req.user!.id, verificationNotes, verifiedAt: ts,
      receiptNumber, receiptIssuedAt: decision === 'VERIFIED' ? ts : null, updatedAt: ts,
    }).where(and(eq(schema.bankTransferRecords.id, transferId), eq(schema.bankTransferRecords.status, 'PENDING_REVIEW')));
    const affectedRows = (updateResult as unknown as { affectedRows?: number; changes?: number }).affectedRows
      ?? (updateResult as unknown as { affectedRows?: number; changes?: number }).changes;
    if (affectedRows === 0) throw new AppError(409, 'This transfer has already been reviewed by another administrator.');
    if (decision === 'VERIFIED') {
      await tx.insert(schema.financialRecords).values({
        entryType: 'DISBURSEMENT', referenceCode: receiptNumber!, amount: transfer.amount,
        currency: transfer.currency, caseId: transfer.caseId,
        description: `External bank transfer verified: ${transfer.purpose}. ${verificationNotes}`, recordedAt: ts,
      });
      if (transfer.currency === 'USD') {
        await tx.insert(schema.assistanceDistributions).values({
          caseId: transfer.caseId, amountUsd: transfer.amount, currency: 'USD',
          approvedBy: req.user!.id, distributionNotes: `Bank transfer ${transfer.bankReference}: ${transfer.purpose}`, distributedAt: ts,
        });
      }
    }
  });
  if (decision === 'VERIFIED') invalidateImpactSummaryCache();
  const caseRows = await db.select({ coordinatorId: schema.humanitarianCases.coordinatorId, referenceCode: schema.humanitarianCases.referenceCode })
    .from(schema.humanitarianCases).where(eq(schema.humanitarianCases.id, transfer.caseId)).limit(1);
  if (caseRows[0]) await createNotification({
    userId: caseRows[0].coordinatorId, eventType: `BANK_TRANSFER_${decision}`,
    title: `Bank transfer ${decision.toLowerCase()}`,
    message: decision === 'VERIFIED'
      ? `Transfer evidence for ${caseRows[0].referenceCode} was verified. Receipt ${receiptNumber} is now available.`
      : `Transfer evidence for ${caseRows[0].referenceCode} was rejected. Review the feedback and resubmit corrected evidence if required.`,
  });
  await writeAuditLog({
    actorUserId: req.user!.id, actorRole: req.user!.role, action: `ADMIN_BANK_TRANSFER_${decision}`,
    resourceType: 'bank_transfer', resourceId: transfer.bankReference,
    details: { transferId, receiptNumber, amount: transfer.amount, currency: transfer.currency, verificationNotes }, ipAddress: req.ip,
  });
  return res.json({
    success: true,
    message: decision === 'VERIFIED' ? `Transfer verified. Receipt ${receiptNumber} issued.` : 'Transfer evidence rejected with review notes.',
    data: { id: transferId, status: decision, receiptNumber },
  });
}));

router.get('/bank-transfers/:id/receipt', asyncHandler(async (req, res) => {
  const transferId = Number(req.params.id);
  const rows = await db.select({
    id: schema.bankTransferRecords.id, receiptNumber: schema.bankTransferRecords.receiptNumber,
    beneficiaryName: schema.bankTransferRecords.beneficiaryName, bankName: schema.bankTransferRecords.bankName,
    bankReference: schema.bankTransferRecords.bankReference, amount: schema.bankTransferRecords.amount,
    currency: schema.bankTransferRecords.currency, transferDate: schema.bankTransferRecords.transferDate,
    recipientAccountLast4: schema.bankTransferRecords.recipientAccountLast4, purpose: schema.bankTransferRecords.purpose,
    notes: schema.bankTransferRecords.notes, verificationNotes: schema.bankTransferRecords.verificationNotes,
    verifiedAt: schema.bankTransferRecords.verifiedAt, receiptIssuedAt: schema.bankTransferRecords.receiptIssuedAt,
    caseReference: schema.humanitarianCases.referenceCode, caseTitle: schema.humanitarianCases.title,
  }).from(schema.bankTransferRecords)
    .innerJoin(schema.humanitarianCases, eq(schema.bankTransferRecords.caseId, schema.humanitarianCases.id))
    .where(and(eq(schema.bankTransferRecords.id, transferId), eq(schema.bankTransferRecords.status, 'VERIFIED')))
    .limit(1);
  if (!rows[0] || !rows[0].receiptNumber) throw new AppError(404, 'Verified transfer receipt not found.');
  return res.json({ success: true, message: 'Verified transfer receipt loaded', data: rows[0] });
}));

// Volunteers, Partnerships & Assistance Requests
router.get(
  '/volunteers',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const [applications, activeVolunteers] = await Promise.all([
      isRegionScopedRole(req.user!.role)
        ? db.select().from(schema.volunteerApplications)
            .where(eq(schema.volunteerApplications.region, req.user!.region || ''))
            .orderBy(desc(schema.volunteerApplications.createdAt))
        : db.select().from(schema.volunteerApplications).orderBy(desc(schema.volunteerApplications.createdAt)),
      isRegionScopedRole(req.user!.role)
        ? db.select().from(schema.volunteers)
            .where(eq(schema.volunteers.region, req.user!.region || ''))
            .orderBy(desc(schema.volunteers.joinedAt))
        : db.select().from(schema.volunteers).orderBy(desc(schema.volunteers.joinedAt)),
    ]);
    return res.json({ success: true, message: 'Volunteers loaded', data: { applications, activeVolunteers } });
  }),
);

router.patch(
  '/volunteers/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = Number(req.params.id);
    const status = String(req.body?.status || '').toUpperCase();
    if (!Number.isSafeInteger(id) || id < 1) throw new AppError(400, 'Invalid volunteer application ID');
    if (!['APPROVED', 'REJECTED'].includes(status)) throw new AppError(400, 'Invalid volunteer status');

    const rows = await db
      .select()
      .from(schema.volunteerApplications)
      .where(eq(schema.volunteerApplications.id, id))
      .limit(1);
    const app = rows[0];
    if (!app) throw new AppError(404, 'Volunteer application not found');
    if (!hasRegionAccess(req.user!, app.region)) throw new AppError(403, 'Volunteer application is outside your assigned region');
    if (app.status !== 'PENDING') throw new AppError(409, 'Only pending volunteer applications can be reviewed');

    const ts = nowUtc();
    await db.transaction(async (tx) => {
      await tx
        .update(schema.volunteerApplications)
        .set({ status, reviewedBy: req.user!.id })
        .where(eq(schema.volunteerApplications.id, id));
      if (status === 'APPROVED') {
        const existingVol = await tx
          .select()
          .from(schema.volunteers)
          .where(eq(schema.volunteers.email, app.email))
          .limit(1);
        if (existingVol.length === 0) {
          await tx.insert(schema.volunteers).values({
            applicationId: app.id,
            fullName: app.fullName,
            email: app.email,
            region: app.region,
            specialty: app.skills,
            status: 'ACTIVE',
            joinedAt: ts,
          });
        }
      }
    });

    await writeAuditLog({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: `ADMIN_VOLUNTEER_${status}`,
      resourceType: 'volunteer_application',
      resourceId: id,
      details: { previousStatus: app.status, newStatus: status, applicantEmail: app.email },
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: `Volunteer application ${status}`, data: null });
  }),
);

router.get(
  '/partnerships',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const [enquiries, partners] = await Promise.all([
      isRegionScopedRole(req.user!.role)
        ? db.select().from(schema.partnershipEnquiries)
            .where(eq(schema.partnershipEnquiries.region, req.user!.region || ''))
            .orderBy(desc(schema.partnershipEnquiries.createdAt))
        : db.select().from(schema.partnershipEnquiries).orderBy(desc(schema.partnershipEnquiries.createdAt)),
      isRegionScopedRole(req.user!.role)
        ? db.select().from(schema.partnerships)
            .where(eq(schema.partnerships.region, req.user!.region || ''))
            .orderBy(desc(schema.partnerships.createdAt))
        : db.select().from(schema.partnerships).orderBy(desc(schema.partnerships.createdAt)),
    ]);
    return res.json({ success: true, message: 'Partnerships loaded', data: { enquiries, partners } });
  }),
);

router.patch(
  '/partnerships/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = Number(req.params.id);
    const status = String(req.body?.status || '').toUpperCase();
    if (!Number.isSafeInteger(id) || id < 1) throw new AppError(400, 'Invalid partnership enquiry ID');
    if (!['APPROVED', 'REJECTED'].includes(status)) throw new AppError(400, 'Invalid partnership decision');

    const rows = await db
      .select()
      .from(schema.partnershipEnquiries)
      .where(eq(schema.partnershipEnquiries.id, id))
      .limit(1);
    const enq = rows[0];
    if (!enq) throw new AppError(404, 'Partnership enquiry not found');
    if (!hasRegionAccess(req.user!, enq.region)) throw new AppError(403, 'Partnership enquiry is outside your assigned region');
    if (enq.status !== 'PENDING') throw new AppError(409, 'Only pending partnership enquiries can be reviewed');

    const ts = nowUtc();
    await db.transaction(async (tx) => {
      await tx.update(schema.partnershipEnquiries).set({ status }).where(eq(schema.partnershipEnquiries.id, id));
      if (status === 'APPROVED') {
        await tx.insert(schema.partnerships).values({
          enquiryId: enq.id,
          organizationName: enq.organizationName,
          organizationType: enq.organizationType,
          region: enq.region,
          focusArea: enq.proposalSummary.slice(0, 160),
          status: 'ACTIVE',
          createdAt: ts,
        });
      }
    });

    await writeAuditLog({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: `ADMIN_PARTNERSHIP_${status}`,
      resourceType: 'partnership_enquiry',
      resourceId: id,
      details: { previousStatus: enq.status, newStatus: status, organizationName: enq.organizationName },
      ipAddress: req.ip,
    });
    return res.json({ success: true, message: `Partnership ${status}`, data: null });
  }),
);

router.get(
  '/assistance-requests',
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({
        id: schema.assistanceRequests.id,
        caseId: schema.assistanceRequests.caseId,
        caseReference: schema.humanitarianCases.referenceCode,
        caseTitle: schema.humanitarianCases.title,
        coordinatorName: schema.userProfiles.displayName,
        supportType: schema.assistanceRequests.supportType,
        requestedAmountUsd: schema.assistanceRequests.requestedAmountUsd,
        justification: schema.assistanceRequests.justification,
        status: schema.assistanceRequests.status,
        adminFeedback: schema.assistanceRequests.adminFeedback,
        createdAt: schema.assistanceRequests.createdAt,
      })
      .from(schema.assistanceRequests)
      .innerJoin(schema.humanitarianCases, eq(schema.assistanceRequests.caseId, schema.humanitarianCases.id))
      .leftJoin(schema.userProfiles, eq(schema.assistanceRequests.coordinatorId, schema.userProfiles.userId))
      .orderBy(desc(schema.assistanceRequests.createdAt));

    return res.json({ success: true, message: 'Assistance requests loaded', data: rows });
  }),
);

router.patch(
  '/assistance-requests/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = Number(req.params.id);
    const status = String(req.body?.status || '').toUpperCase();
    const adminFeedback = String(req.body?.adminFeedback || '').trim();
    if (!Number.isSafeInteger(id) || id < 1) throw new AppError(400, 'Invalid assistance request ID');
    if (!['APPROVED', 'DISBURSED', 'REJECTED', 'UNDER_REVIEW'].includes(status)) {
      throw new AppError(400, 'Invalid assistance request status');
    }
    if (adminFeedback.length < 8 || adminFeedback.length > 2000) {
      throw new AppError(400, 'Provide between 8 and 2,000 characters of decision feedback');
    }

    const rows = await db
      .select()
      .from(schema.assistanceRequests)
      .where(eq(schema.assistanceRequests.id, id))
      .limit(1);
    const existing = rows[0];
    if (!existing) throw new AppError(404, 'Assistance request not found');

    const allowedTransitions: Record<string, string[]> = {
      SUBMITTED: ['UNDER_REVIEW', 'APPROVED', 'REJECTED'],
      UNDER_REVIEW: ['APPROVED', 'REJECTED'],
      APPROVED: ['DISBURSED'],
      DISBURSED: [],
      REJECTED: [],
    };
    if (!allowedTransitions[existing.status]?.includes(status)) {
      throw new AppError(409, `An assistance request in ${existing.status} cannot transition to ${status}`);
    }
    if (status === 'DISBURSED') {
      const [distribution] = await db.select({ id: schema.assistanceDistributions.id })
        .from(schema.assistanceDistributions)
        .where(eq(schema.assistanceDistributions.requestId, id))
        .limit(1);
      if (!distribution) throw new AppError(409, 'Record and verify an assistance distribution before marking this request disbursed');
    }

    await db
      .update(schema.assistanceRequests)
      .set({ status, adminFeedback, updatedAt: nowUtc() })
      .where(eq(schema.assistanceRequests.id, id));

    await createNotification({
      userId: existing.coordinatorId,
      eventType: `ASSISTANCE_${status}`,
      title: `Assistance Request ${status}`,
      message: adminFeedback,
    });

    await writeAuditLog({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: `ADMIN_ASSISTANCE_${status}`,
      resourceType: 'assistance_request',
      resourceId: id,
      details: { previousStatus: existing.status, newStatus: status, adminFeedback },
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: `Assistance request updated to ${status}`, data: null });
  }),
);

// Safeguarding, Privacy & Publications
router.get(
  '/safeguarding',
  asyncHandler(async (_req, res) => {
    const [reports, privacyRequests, consents] = await Promise.all([
      db.select().from(schema.safeguardingReports).orderBy(desc(schema.safeguardingReports.createdAt)),
      db.select().from(schema.privacyRequests).orderBy(desc(schema.privacyRequests.createdAt)),
      db.select().from(schema.consentRecords).orderBy(desc(schema.consentRecords.recordedAt)).limit(30),
    ]);
    return res.json({
      success: true,
      message: 'Safeguarding & Privacy Centre loaded',
      data: { reports, privacyRequests, consents },
    });
  }),
);

router.patch(
  '/safeguarding/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = Number(req.params.id);
    const status = String(req.body?.status || '').toUpperCase();
    const resolutionNotes = String(req.body?.resolutionNotes || '').trim();
    if (!Number.isSafeInteger(id) || id < 1) {
      throw new AppError(400, 'Invalid safeguarding report ID');
    }
    if (!['IN_REVIEW', 'RESOLVED', 'RESTRICTED'].includes(status)) {
      throw new AppError(400, 'Invalid safeguarding status');
    }

    const [existingReport] = await db
      .select({ id: schema.safeguardingReports.id })
      .from(schema.safeguardingReports)
      .where(eq(schema.safeguardingReports.id, id))
      .limit(1);
    if (!existingReport) throw new AppError(404, 'Safeguarding report not found');

    await db
      .update(schema.safeguardingReports)
      .set({
        status,
        assignedAdminId: req.user!.id,
        resolutionNotes: resolutionNotes || null,
      })
      .where(eq(schema.safeguardingReports.id, id));

    await db.insert(schema.moderationActions).values({
      targetType: 'SAFEGUARDING_REPORT',
      targetId: id,
      actionType: status,
      reason: resolutionNotes || 'Updated by Safeguarding Officer',
      moderatorId: req.user!.id,
      createdAt: nowUtc(),
    });

    await writeAuditLog({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: `ADMIN_SAFEGUARDING_${status}`,
      resourceType: 'safeguarding_report',
      resourceId: id,
      details: { resolutionNotes },
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'Safeguarding record updated', data: null });
  }),
);

router.patch(
  '/privacy-requests/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = Number(req.params.id);
    const status = String(req.body?.status || '').toUpperCase();
    if (!Number.isSafeInteger(id) || id < 1) {
      throw new AppError(400, 'Invalid privacy request ID');
    }
    if (!['IN_REVIEW', 'RESOLVED'].includes(status)) {
      throw new AppError(400, 'Invalid privacy request status');
    }

    const [existingRequest] = await db
      .select({ id: schema.privacyRequests.id })
      .from(schema.privacyRequests)
      .where(eq(schema.privacyRequests.id, id))
      .limit(1);
    if (!existingRequest) throw new AppError(404, 'Privacy request not found');

    await db
      .update(schema.privacyRequests)
      .set({ status, handledBy: req.user!.id })
      .where(eq(schema.privacyRequests.id, id));

    await writeAuditLog({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: `ADMIN_PRIVACY_REQUEST_${status}`,
      resourceType: 'privacy_request',
      resourceId: id,
      details: { status },
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: `Privacy request updated to ${status}`, data: null });
  }),
);

router.post(
  '/articles',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const title = String(req.body?.title || '').trim();
    const categoryId = Number(req.body?.categoryId);
    const summary = String(req.body?.summary || '').trim();
    const body = String(req.body?.body || '').trim();
    const coverImageUrl = String(req.body?.coverImageUrl || '').trim();
    if (title.length < 5 || title.length > 200 || summary.length < 15 || summary.length > 2000 ||
      body.length < 40 || body.length > 20000 || !Number.isSafeInteger(categoryId) || categoryId < 1 ||
      coverImageUrl.length > 500) {
      throw new AppError(400, 'Provide a valid title, existing category, summary, and full article text');
    }
    const [category] = await db.select({ id: schema.articleCategories.id })
      .from(schema.articleCategories).where(eq(schema.articleCategories.id, categoryId)).limit(1);
    if (!category) throw new AppError(400, 'Select an existing news category');

    const slug = slugify(title);
    const ts = nowUtc();
    await db.insert(schema.articles).values({
      slug,
      title,
      categoryId,
      authorId: req.user!.id,
      summary,
      body,
      coverImageUrl: coverImageUrl || null,
      status: 'DRAFT',
      publishedAt: ts,
    });

    const [article] = await db.select({ id: schema.articles.id })
      .from(schema.articles).where(eq(schema.articles.slug, slug)).limit(1);
    if (!article) throw new AppError(500, 'Article draft was not created');
    await writeAuditLog({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'ADMIN_ARTICLE_CREATED',
      resourceType: 'article',
      resourceId: article.id,
      details: { title, status: 'DRAFT' },
      ipAddress: req.ip,
    });
    return res.status(201).json({ success: true, message: 'Article draft saved', data: { id: article.id, slug } });
  }),
);

router.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    const [settings, backups, messages] = await Promise.all([
      db.select().from(schema.systemSettings),
      db.select().from(schema.backupRecords).orderBy(desc(schema.backupRecords.recordedAt)).limit(10),
      db.select().from(schema.contactMessages).orderBy(desc(schema.contactMessages.createdAt)).limit(20),
    ]);
    return res.json({ success: true, message: 'System settings loaded', data: { settings, backups, messages } });
  }),
);

router.put(
  '/settings',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const entries = req.body?.settings as Array<{ settingKey: string; settingValue: string }>;
    if (!Array.isArray(entries)) throw new AppError(400, 'Expected settings array');

    const ts = nowUtc();
    for (const item of entries) {
      await db
        .update(schema.systemSettings)
        .set({
          settingValue: String(item.settingValue || ''),
          updatedBy: req.user!.id,
          updatedAt: ts,
        })
        .where(eq(schema.systemSettings.settingKey, item.settingKey));
    }

    await writeAuditLog({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'ADMIN_SETTINGS_UPDATED',
      resourceType: 'system_settings',
      details: { keys: entries.map((e) => e.settingKey) },
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'Platform configuration saved', data: null });
  }),
);

router.get(
  '/notifications',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const rows = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, req.user!.id))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(50);
    return res.json({ success: true, message: 'Administrator notifications loaded', data: rows });
  }),
);

router.patch(
  '/notifications/read-all',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await db
      .update(schema.notifications)
      .set({ isRead: true })
      .where(eq(schema.notifications.userId, req.user!.id));
    await writeAuditLog({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'ADMIN_NOTIFICATIONS_MARKED_READ',
      resourceType: 'notification',
      details: { scope: 'own_notifications' },
      ipAddress: req.ip,
    });
    return res.json({ success: true, message: 'All notifications marked as read', data: null });
  }),
);

router.patch(
  '/notifications/:id/read',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const notificationId = Number(req.params.id);
    if (!Number.isSafeInteger(notificationId) || notificationId < 1) {
      throw new AppError(400, 'Invalid notification identifier');
    }
    await db
      .update(schema.notifications)
      .set({ isRead: true })
      .where(and(
        eq(schema.notifications.id, notificationId),
        eq(schema.notifications.userId, req.user!.id),
      ));
    return res.json({ success: true, message: 'Notification marked as read', data: null });
  }),
);

router.get(
  '/audit-logs',
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select()
      .from(schema.auditLogs)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(100);
    return res.json({ success: true, message: 'Audit trail loaded', data: rows });
  }),
);

export default router;
