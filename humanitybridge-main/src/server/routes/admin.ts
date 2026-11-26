import { Router } from 'express';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db, schema, nowUtc, getDbDiagnostics } from '../../db/index';
import { createCampaignSchema } from '../../../packages/shared/validation';
import { DASHBOARD_ROLES } from '../../../packages/shared/types';
import { type AuthenticatedRequest, requireRole } from '../middleware/auth';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { generateReferenceCode, hashPasswordArgon2id } from '../utils/crypto';
import { createNotification, writeAuditLog } from '../services/auditService';
import { generateTranslationDraft, type SupportedLocale } from '../services/translationService';

const router = Router();

// Strictly enforce PLATFORM_ADMIN role across every administrative endpoint
router.use(requireRole(DASHBOARD_ROLES.PLATFORM_ADMIN));

function slugify(title: string): string {
  return `${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)}-${Date.now().toString(36)}`;
}

router.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const [usersTotal] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.users)
      .where(isNull(schema.users.deletedAt));
    const [activeCoordinators] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.users)
      .where(and(
        eq(schema.users.role, DASHBOARD_ROLES.COMMUNITY_COORDINATOR),
        eq(schema.users.status, 'ACTIVE'),
        isNull(schema.users.deletedAt),
      ));
    const [verifiedCases] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.humanitarianCases)
      .where(and(
        eq(schema.humanitarianCases.status, 'VERIFIED'),
        isNull(schema.humanitarianCases.deletedAt),
      ));
    const [pendingCases] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.humanitarianCases)
      .where(and(
        sql`${schema.humanitarianCases.status} IN ('SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED')`,
        isNull(schema.humanitarianCases.deletedAt),
      ));
    const [activeCampaigns] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.campaigns)
      .where(and(
        eq(schema.campaigns.status, 'ACTIVE'),
        isNull(schema.campaigns.deletedAt),
      ));
    const [completedCampaigns] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.campaigns)
      .where(and(
        eq(schema.campaigns.status, 'COMPLETED'),
        isNull(schema.campaigns.deletedAt),
      ));
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
      ));
    const [pendingBankTransfers] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.bankTransferRecords)
      .where(eq(schema.bankTransferRecords.status, 'PENDING_REVIEW'));
    const [openSafeguarding] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.safeguardingReports)
      .where(sql`${schema.safeguardingReports.status} IN ('OPEN', 'IN_REVIEW')`);

    const recentAudit = await db
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
      .limit(10);

    const campaignPerformance = await db
      .select({
        title: schema.campaigns.title,
        targetAmount: schema.campaigns.targetAmount,
        raisedAmount: schema.campaigns.raisedAmount,
        status: schema.campaigns.status,
      })
      .from(schema.campaigns)
      .where(isNull(schema.campaigns.deletedAt))
      .limit(6);

    const caseStatusBreakdown = await db
      .select({
        status: schema.humanitarianCases.status,
        count: sql<number>`count(*)`,
      })
      .from(schema.humanitarianCases)
      .where(isNull(schema.humanitarianCases.deletedAt))
      .groupBy(schema.humanitarianCases.status);

    const database = getDbDiagnostics();
    return res.json({
      success: true,
      message: 'Executive dashboard loaded',
      data: {
        metrics: {
          totalUsers: Number(usersTotal?.count || 0),
          activeCoordinators: Number(activeCoordinators?.count || 0),
          verifiedCases: Number(verifiedCases?.count || 0),
          pendingCases: Number(pendingCases?.count || 0),
          storiesAwaitingModeration: Number(storiesAwaitingModeration?.count || 0),
          pendingBankTransfers: Number(pendingBankTransfers?.count || 0),
          activeCampaigns: Number(activeCampaigns?.count || 0),
          completedCampaigns: Number(completedCampaigns?.count || 0),
          confirmedDonationsCount: Number(confirmedDonations?.count || 0),
          confirmedDonationsUsd: Number(confirmedDonations?.totalUsd || 0),
          totalFundsDistributedUsd: Number(distributedFunds?.totalUsd || 0),
          outstandingAssistanceRequests: Number(outstandingRequests?.count || 0),
          openSafeguardingAlerts: Number(openSafeguarding?.count || 0),
        },
        systemHealth: {
          database: database.dialect,
          status: 'connected',
          checkedAt: new Date().toISOString(),
        },
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
    await db.insert(schema.users).values({
      email,
      passwordHash: hashPasswordArgon2id(password),
      role: DASHBOARD_ROLES.COMMUNITY_COORDINATOR,
      status: 'ACTIVE',
      emailVerified: true,
      mfaEnabled: false,
      createdAt: ts,
      updatedAt: ts,
    });

    const createdRows = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    const created = createdRows[0];

    await db.insert(schema.userProfiles).values({
      userId: created.id,
      displayName,
      region,
      organization: organization || null,
      preferredLanguage: 'en',
      createdAt: ts,
      updatedAt: ts,
    });

    await writeAuditLog({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'ADMIN_COORDINATOR_CREATED',
      resourceType: 'user',
      resourceId: created.id,
      details: { email, region },
      ipAddress: req.ip,
    });

    return res.status(201).json({
      success: true,
      message: 'Community Coordinator account created and activated',
      data: { id: created.id, email },
    });
  }),
);

router.patch(
  '/users/:id/status',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = Number(req.params.id);
    const status = String(req.body?.status || '').toUpperCase();
    if (!['ACTIVE', 'SUSPENDED', 'PENDING_APPROVAL'].includes(status)) {
      throw new AppError(400, 'Invalid account status');
    }
    if (userId === req.user!.id && status !== 'ACTIVE') {
      throw new AppError(400, 'Administrators cannot suspend their own active session');
    }

    const ts = nowUtc();
    await db.update(schema.users).set({ status, updatedAt: ts }).where(eq(schema.users.id, userId));
    if (status === 'SUSPENDED') {
      await db.update(schema.userSessions).set({ revokedAt: ts }).where(eq(schema.userSessions.userId, userId));
    }

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
      details: { status },
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: `User status updated to ${status}`, data: null });
  }),
);

// Humanitarian Case Review & Verification
router.get(
  '/cases',
  asyncHandler(async (_req, res) => {
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
        coordinatorName: schema.userProfiles.displayName,
      })
      .from(schema.humanitarianCases)
      .innerJoin(schema.caseCategories, eq(schema.humanitarianCases.categoryId, schema.caseCategories.id))
      .innerJoin(schema.communityLocations, eq(schema.humanitarianCases.locationId, schema.communityLocations.id))
      .leftJoin(schema.userProfiles, eq(schema.humanitarianCases.coordinatorId, schema.userProfiles.userId))
      .where(isNull(schema.humanitarianCases.deletedAt))
      .orderBy(desc(schema.humanitarianCases.updatedAt));

    return res.json({ success: true, message: 'All humanitarian cases loaded', data: rows });
  }),
);

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

    const rows = await db
      .select()
      .from(schema.humanitarianCases)
      .where(eq(schema.humanitarianCases.id, caseId))
      .limit(1);
    const existing = rows[0];
    if (!existing) throw new AppError(404, 'Case not found');

    if (decision === 'VERIFIED' && existing.isChildRelated && !existing.guardianConsentObtained) {
      throw new AppError(400, 'Cannot verify child-related case without documented guardian consent');
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
router.get(
  '/stories',
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({
        id: schema.stories.id,
        slug: schema.stories.slug,
        title: schema.stories.title,
        regionName: schema.stories.regionName,
        excerpt: schema.stories.excerpt,
        body: schema.stories.body,
        coverImageUrl: schema.stories.coverImageUrl,
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
      })
      .from(schema.stories)
      .innerJoin(schema.storyCategories, eq(schema.stories.categoryId, schema.storyCategories.id))
      .leftJoin(schema.userProfiles, eq(schema.stories.authorId, schema.userProfiles.userId))
      .leftJoin(schema.storyConsents, eq(schema.stories.id, schema.storyConsents.storyId))
      .where(isNull(schema.stories.deletedAt))
      .orderBy(desc(schema.stories.updatedAt));

    return res.json({ success: true, message: 'Stories loaded for moderation', data: rows });
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

    if (!['APPROVED', 'PUBLISHED', 'REJECTED', 'ARCHIVED', 'UNDER_REVIEW'].includes(decision)) {
      throw new AppError(400, 'Invalid story moderation decision');
    }

    const rows = await db.select().from(schema.stories).where(eq(schema.stories.id, storyId)).limit(1);
    const story = rows[0];
    if (!story) throw new AppError(404, 'Story not found');

    const consentRows = await db
      .select()
      .from(schema.storyConsents)
      .where(eq(schema.storyConsents.storyId, storyId))
      .limit(1);
    const consent = consentRows[0];

    if (decision === 'PUBLISHED') {
      if (!consent || !consent.consentStory || consent.withdrawnAt) {
        throw new AppError(400, 'Cannot publish a story without active narrative consent');
      }
      if (story.isMinorSubject && !consent.guardianConsentRecorded) {
        throw new AppError(400, 'Cannot publish a minor-related story without guardian consent');
      }
    }

    const ts = nowUtc();
    await db.transaction(async (tx) => {
      await tx
        .update(schema.stories)
        .set({
          status: decision,
          title: editedTitle || story.title,
          body: editedBody || story.body,
          publishedAt: decision === 'PUBLISHED' ? ts : story.publishedAt,
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
          publishedAt: ts,
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
      details: { editorialNotes },
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: `Story updated to ${decision}`, data: null });
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
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select()
      .from(schema.campaigns)
      .where(isNull(schema.campaigns.deletedAt))
      .orderBy(desc(schema.campaigns.createdAt));
    return res.json({ success: true, message: 'Campaigns loaded', data: rows });
  }),
);

router.post(
  '/campaigns',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = createCampaignSchema.parse(req.body);
    const ts = nowUtc();
    const slug = slugify(parsed.title);

    await db.insert(schema.campaigns).values({
      slug,
      title: parsed.title,
      summary: parsed.summary,
      description: parsed.description,
      targetAmount: parsed.targetAmount,
      raisedAmount: 0,
      currency: parsed.currency,
      coverImageUrl: parsed.coverImageUrl || '/src/assets/images/campaign_clean_energy_1794840711620.jpg',
      status: parsed.status,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      createdBy: req.user!.id,
      createdAt: ts,
      updatedAt: ts,
    });

    const createdRows = await db.select().from(schema.campaigns).where(eq(schema.campaigns.slug, slug)).limit(1);
    const campaign = createdRows[0];

    if (parsed.linkedCaseIds?.length) {
      await db.insert(schema.campaignCases).values(
        parsed.linkedCaseIds.map((caseId) => ({
          campaignId: campaign.id,
          caseId,
        })),
      );
    }

    await writeAuditLog({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'ADMIN_CAMPAIGN_CREATED',
      resourceType: 'campaign',
      resourceId: campaign.id,
      details: { title: parsed.title, targetAmount: parsed.targetAmount },
      ipAddress: req.ip,
    });

    return res.status(201).json({ success: true, message: 'Campaign created', data: campaign });
  }),
);

router.patch(
  '/campaigns/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const campaignId = Number(req.params.id);
    const status = req.body?.status ? String(req.body.status).toUpperCase() : undefined;
    const targetAmount = req.body?.targetAmount !== undefined ? Number(req.body.targetAmount) : undefined;

    if (status && !['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CLOSED'].includes(status)) {
      throw new AppError(400, 'Invalid campaign status');
    }

    const updates: Record<string, unknown> = { updatedAt: nowUtc() };
    if (status) updates.status = status;
    if (targetAmount && targetAmount > 0) updates.targetAmount = targetAmount;

    await db.update(schema.campaigns).set(updates).where(eq(schema.campaigns.id, campaignId));

    await writeAuditLog({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'ADMIN_CAMPAIGN_UPDATED',
      resourceType: 'campaign',
      resourceId: campaignId,
      details: updates,
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'Campaign updated', data: null });
  }),
);

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
  asyncHandler(async (_req, res) => {
    const applications = await db
      .select()
      .from(schema.volunteerApplications)
      .orderBy(desc(schema.volunteerApplications.createdAt));
    const activeVolunteers = await db.select().from(schema.volunteers).orderBy(desc(schema.volunteers.joinedAt));
    return res.json({ success: true, message: 'Volunteers loaded', data: { applications, activeVolunteers } });
  }),
);

router.patch(
  '/volunteers/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = Number(req.params.id);
    const status = String(req.body?.status || '').toUpperCase();
    if (!['APPROVED', 'REJECTED'].includes(status)) throw new AppError(400, 'Invalid volunteer status');

    const rows = await db
      .select()
      .from(schema.volunteerApplications)
      .where(eq(schema.volunteerApplications.id, id))
      .limit(1);
    const app = rows[0];
    if (!app) throw new AppError(404, 'Volunteer application not found');

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
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: `Volunteer application ${status}`, data: null });
  }),
);

router.get(
  '/partnerships',
  asyncHandler(async (_req, res) => {
    const enquiries = await db
      .select()
      .from(schema.partnershipEnquiries)
      .orderBy(desc(schema.partnershipEnquiries.createdAt));
    const partners = await db.select().from(schema.partnerships).orderBy(desc(schema.partnerships.createdAt));
    return res.json({ success: true, message: 'Partnerships loaded', data: { enquiries, partners } });
  }),
);

router.patch(
  '/partnerships/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = Number(req.params.id);
    const status = String(req.body?.status || '').toUpperCase();
    if (!['APPROVED', 'REJECTED'].includes(status)) throw new AppError(400, 'Invalid partnership decision');

    const rows = await db
      .select()
      .from(schema.partnershipEnquiries)
      .where(eq(schema.partnershipEnquiries.id, id))
      .limit(1);
    const enq = rows[0];
    if (!enq) throw new AppError(404, 'Partnership enquiry not found');

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
    if (!['APPROVED', 'DISBURSED', 'REJECTED', 'UNDER_REVIEW'].includes(status)) {
      throw new AppError(400, 'Invalid assistance request status');
    }

    const rows = await db
      .select()
      .from(schema.assistanceRequests)
      .where(eq(schema.assistanceRequests.id, id))
      .limit(1);
    const existing = rows[0];
    if (!existing) throw new AppError(404, 'Assistance request not found');

    await db
      .update(schema.assistanceRequests)
      .set({ status, adminFeedback: adminFeedback || null, updatedAt: nowUtc() })
      .where(eq(schema.assistanceRequests.id, id));

    await createNotification({
      userId: existing.coordinatorId,
      eventType: `ASSISTANCE_${status}`,
      title: `Assistance Request ${status}`,
      message: adminFeedback || `Your assistance request (${existing.supportType}) is now ${status}.`,
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
    if (!['IN_REVIEW', 'RESOLVED', 'RESTRICTED'].includes(status)) {
      throw new AppError(400, 'Invalid safeguarding status');
    }

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

router.post(
  '/articles',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const title = String(req.body?.title || '').trim();
    const categoryId = Number(req.body?.categoryId || 1);
    const summary = String(req.body?.summary || '').trim();
    const body = String(req.body?.body || '').trim();
    const coverImageUrl = String(req.body?.coverImageUrl || '').trim();
    if (title.length < 5 || summary.length < 15 || body.length < 40) {
      throw new AppError(400, 'Provide title, summary, and full article text');
    }

    const slug = slugify(title);
    await db.insert(schema.articles).values({
      slug,
      title,
      categoryId,
      authorId: req.user!.id,
      summary,
      body,
      coverImageUrl: coverImageUrl || null,
      status: 'PUBLISHED',
      publishedAt: nowUtc(),
    });

    return res.status(201).json({ success: true, message: 'News publication published', data: { slug } });
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
