import { Router } from 'express';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db, schema, nowUtc } from '../../db/index';
import {
  createAssistanceRequestSchema,
  createCaseSchema,
  createFieldReportSchema,
  createStorySchema,
} from '../../../packages/shared/validation';
import { DASHBOARD_ROLES } from '../../../packages/shared/types';
import { type AuthenticatedRequest, requireRole } from '../middleware/auth';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { generateReferenceCode } from '../utils/crypto';
import { writeAuditLog } from '../services/auditService';

const router = Router();

// Strictly enforce COMMUNITY_COORDINATOR role across all coordinator endpoints
router.use(requireRole(DASHBOARD_ROLES.COMMUNITY_COORDINATOR));

function slugifyTitle(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${base || 'story'}-${Date.now().toString(36)}`;
}

router.get(
  '/dashboard',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const uid = req.user!.id;

    const myCases = await db
      .select({
        id: schema.humanitarianCases.id,
        referenceCode: schema.humanitarianCases.referenceCode,
        title: schema.humanitarianCases.title,
        status: schema.humanitarianCases.status,
        urgencyLevel: schema.humanitarianCases.urgencyLevel,
        affectedCount: schema.humanitarianCases.affectedCount,
        updatedAt: schema.humanitarianCases.updatedAt,
      })
      .from(schema.humanitarianCases)
      .where(and(eq(schema.humanitarianCases.coordinatorId, uid), isNull(schema.humanitarianCases.deletedAt)))
      .orderBy(desc(schema.humanitarianCases.updatedAt));

    const myStories = await db
      .select({
        id: schema.stories.id,
        slug: schema.stories.slug,
        title: schema.stories.title,
        status: schema.stories.status,
        updatedAt: schema.stories.updatedAt,
      })
      .from(schema.stories)
      .where(and(eq(schema.stories.authorId, uid), isNull(schema.stories.deletedAt)))
      .orderBy(desc(schema.stories.updatedAt));

    const myNotifications = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, uid))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(10);

    const recentAnnouncements = await db
      .select()
      .from(schema.announcements)
      .orderBy(desc(schema.announcements.publishedAt))
      .limit(5);

    const summary = {
      totalSubmittedCases: myCases.length,
      pendingVerification: myCases.filter((c) => ['SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED'].includes(c.status)).length,
      approvedCases: myCases.filter((c) => c.status === 'VERIFIED').length,
      rejectedCases: myCases.filter((c) => c.status === 'REJECTED').length,
      draftCases: myCases.filter((c) => c.status === 'DRAFT').length,
      submittedStories: myStories.length,
      publishedStories: myStories.filter((s) => s.status === 'PUBLISHED').length,
      unreadNotifications: myNotifications.filter((n) => !n.isRead).length,
    };

    return res.json({
      success: true,
      message: 'Coordinator dashboard loaded',
      data: {
        summary,
        recentCases: myCases.slice(0, 6),
        recentStories: myStories.slice(0, 5),
        notifications: myNotifications,
        announcements: recentAnnouncements,
      },
    });
  }),
);

router.get(
  '/cases',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const uid = req.user!.id;
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
        createdAt: schema.humanitarianCases.createdAt,
        updatedAt: schema.humanitarianCases.updatedAt,
        categoryName: schema.caseCategories.name,
        regionName: schema.communityLocations.regionName,
      })
      .from(schema.humanitarianCases)
      .innerJoin(schema.caseCategories, eq(schema.humanitarianCases.categoryId, schema.caseCategories.id))
      .innerJoin(schema.communityLocations, eq(schema.humanitarianCases.locationId, schema.communityLocations.id))
      .where(and(eq(schema.humanitarianCases.coordinatorId, uid), isNull(schema.humanitarianCases.deletedAt)))
      .orderBy(desc(schema.humanitarianCases.updatedAt));

    return res.json({ success: true, message: 'Coordinator cases loaded', data: rows });
  }),
);

router.post(
  '/cases',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = createCaseSchema.parse(req.body);
    if (parsed.isChildRelated && !parsed.guardianConsentObtained) {
      throw new AppError(400, 'Child-related cases require explicit guardian consent confirmation');
    }

    const ts = nowUtc();
    const referenceCode = generateReferenceCode('HB-CASE');
    // Security invariant: coordinators can NEVER create already-verified or public cases
    const initialStatus = parsed.saveAsDraft ? 'DRAFT' : 'SUBMITTED';

    await db.insert(schema.humanitarianCases).values({
      referenceCode,
      title: parsed.title,
      categoryId: parsed.categoryId,
      locationId: parsed.locationId,
      coordinatorId: req.user!.id,
      publicSummary: parsed.publicSummary,
      assistanceNeeded: parsed.assistanceNeeded,
      affectedCount: parsed.affectedCount,
      urgencyLevel: parsed.urgencyLevel,
      estimatedCostUsd: parsed.estimatedCostUsd ?? 0,
      status: initialStatus,
      isPublic: false,
      isChildRelated: parsed.isChildRelated,
      guardianConsentObtained: parsed.guardianConsentObtained,
      beneficiaryConsentObtained: parsed.beneficiaryConsentObtained,
      privateContactName: parsed.privateContactName,
      privateContactPhone: parsed.privateContactPhone,
      privateLocationNotes: parsed.privateLocationNotes,
      createdAt: ts,
      updatedAt: ts,
    });

    const createdRows = await db
      .select()
      .from(schema.humanitarianCases)
      .where(eq(schema.humanitarianCases.referenceCode, referenceCode))
      .limit(1);
    const created = createdRows[0];

    await db.insert(schema.caseStatusHistory).values({
      caseId: created.id,
      previousStatus: null,
      newStatus: initialStatus,
      changedBy: req.user!.id,
      reason: parsed.saveAsDraft ? 'Saved as draft by Community Coordinator' : 'Submitted for administrative verification',
      changedAt: ts,
    });

    await writeAuditLog({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'COORDINATOR_CASE_CREATED',
      resourceType: 'humanitarian_case',
      resourceId: referenceCode,
      details: { status: initialStatus },
      ipAddress: req.ip,
    });

    return res.status(201).json({
      success: true,
      message: parsed.saveAsDraft
        ? 'Case saved to drafts'
        : 'Case submitted securely for Platform Administrator verification',
      data: { id: created.id, referenceCode, status: initialStatus },
    });
  }),
);

router.patch(
  '/cases/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const caseId = Number(req.params.id);
    const rows = await db
      .select()
      .from(schema.humanitarianCases)
      .where(and(eq(schema.humanitarianCases.id, caseId), isNull(schema.humanitarianCases.deletedAt)))
      .limit(1);
    const existing = rows[0];
    if (!existing) throw new AppError(404, 'Case not found');
    if (existing.coordinatorId !== req.user!.id) {
      throw new AppError(403, 'You may only update your own case submissions');
    }
    if (!['DRAFT', 'INFO_REQUESTED'].includes(existing.status)) {
      throw new AppError(400, 'Only draft or info-requested cases can be edited by coordinators');
    }

    const parsed = createCaseSchema.parse(req.body);
    const ts = nowUtc();
    // Coordinator cannot self-approve; submitting moves to SUBMITTED
    const nextStatus = parsed.saveAsDraft ? 'DRAFT' : 'SUBMITTED';

    await db
      .update(schema.humanitarianCases)
      .set({
        title: parsed.title,
        categoryId: parsed.categoryId,
        locationId: parsed.locationId,
        publicSummary: parsed.publicSummary,
        assistanceNeeded: parsed.assistanceNeeded,
        affectedCount: parsed.affectedCount,
        urgencyLevel: parsed.urgencyLevel,
        estimatedCostUsd: parsed.estimatedCostUsd ?? 0,
        status: nextStatus,
        isPublic: false,
        privateContactName: parsed.privateContactName,
        privateContactPhone: parsed.privateContactPhone,
        privateLocationNotes: parsed.privateLocationNotes,
        updatedAt: ts,
      })
      .where(eq(schema.humanitarianCases.id, caseId));

    await db.insert(schema.caseStatusHistory).values({
      caseId,
      previousStatus: existing.status,
      newStatus: nextStatus,
      changedBy: req.user!.id,
      reason: 'Updated by Community Coordinator',
      changedAt: ts,
    });

    return res.json({ success: true, message: 'Case submission updated', data: { id: caseId, status: nextStatus } });
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
        status: schema.stories.status,
        anonymousPublication: schema.stories.anonymousPublication,
        createdAt: schema.stories.createdAt,
        updatedAt: schema.stories.updatedAt,
        categoryName: schema.storyCategories.name,
      })
      .from(schema.stories)
      .innerJoin(schema.storyCategories, eq(schema.stories.categoryId, schema.storyCategories.id))
      .where(and(eq(schema.stories.authorId, req.user!.id), isNull(schema.stories.deletedAt)))
      .orderBy(desc(schema.stories.updatedAt));

    return res.json({ success: true, message: 'Coordinator stories loaded', data: rows });
  }),
);

router.post(
  '/stories',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = createStorySchema.parse(req.body);
    if (parsed.isMinorSubject && !parsed.guardianConsentRecorded) {
      throw new AppError(400, 'Minor-related stories require documented guardian consent');
    }

    const ts = nowUtc();
    const slug = slugifyTitle(parsed.title);
    // Security invariant: stories submitted by coordinators NEVER auto-publish
    const status = parsed.saveAsDraft ? 'DRAFT' : 'SUBMITTED';

    await db.insert(schema.stories).values({
      slug,
      title: parsed.title,
      categoryId: parsed.categoryId,
      authorId: req.user!.id,
      regionName: parsed.regionName,
      excerpt: parsed.excerpt,
      body: parsed.body,
      coverImageUrl: parsed.coverImageUrl || null,
      anonymousPublication: parsed.anonymousPublication || parsed.isMinorSubject,
      isMinorSubject: parsed.isMinorSubject,
      status,
      languageCode: 'en',
      createdAt: ts,
      updatedAt: ts,
    });

    const createdRows = await db.select().from(schema.stories).where(eq(schema.stories.slug, slug)).limit(1);
    const story = createdRows[0];

    await db.insert(schema.storyConsents).values({
      storyId: story.id,
      consentStory: parsed.consentStory,
      consentMedia: parsed.consentMedia,
      consentIdentity: parsed.anonymousPublication ? false : parsed.consentIdentity,
      guardianConsentRecorded: parsed.guardianConsentRecorded,
      recordedAt: ts,
    });

    await db.insert(schema.consentRecords).values({
      subjectType: 'STORY',
      subjectId: story.id,
      consentScope: 'STORY_PUBLICATION',
      granted: parsed.consentStory,
      recordedBy: req.user!.id,
      recordedAt: ts,
    });

    return res.status(201).json({
      success: true,
      message: parsed.saveAsDraft
        ? 'Story draft saved'
        : 'Story submitted for editorial & safeguarding approval before publication',
      data: { id: story.id, slug, status },
    });
  }),
);

router.get(
  '/assistance-requests',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const rows = await db
      .select({
        id: schema.assistanceRequests.id,
        caseId: schema.assistanceRequests.caseId,
        caseReference: schema.humanitarianCases.referenceCode,
        caseTitle: schema.humanitarianCases.title,
        supportType: schema.assistanceRequests.supportType,
        requestedAmountUsd: schema.assistanceRequests.requestedAmountUsd,
        justification: schema.assistanceRequests.justification,
        status: schema.assistanceRequests.status,
        adminFeedback: schema.assistanceRequests.adminFeedback,
        createdAt: schema.assistanceRequests.createdAt,
      })
      .from(schema.assistanceRequests)
      .innerJoin(schema.humanitarianCases, eq(schema.assistanceRequests.caseId, schema.humanitarianCases.id))
      .where(eq(schema.assistanceRequests.coordinatorId, req.user!.id))
      .orderBy(desc(schema.assistanceRequests.createdAt));

    return res.json({ success: true, message: 'Assistance requests loaded', data: rows });
  }),
);

router.post(
  '/assistance-requests',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = createAssistanceRequestSchema.parse(req.body);
    const caseRows = await db
      .select()
      .from(schema.humanitarianCases)
      .where(eq(schema.humanitarianCases.id, parsed.caseId))
      .limit(1);
    const targetCase = caseRows[0];
    if (!targetCase || targetCase.coordinatorId !== req.user!.id) {
      throw new AppError(403, 'You may only request assistance for your own assigned cases');
    }

    const ts = nowUtc();
    await db.insert(schema.assistanceRequests).values({
      caseId: parsed.caseId,
      coordinatorId: req.user!.id,
      supportType: parsed.supportType,
      requestedAmountUsd: parsed.requestedAmountUsd,
      justification: parsed.justification,
      status: 'SUBMITTED',
      createdAt: ts,
      updatedAt: ts,
    });

    return res.status(201).json({
      success: true,
      message: 'Assistance request submitted for administrative review',
      data: null,
    });
  }),
);

router.get(
  '/reports',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const rows = await db
      .select({
        id: schema.fieldReports.id,
        visitDate: schema.fieldReports.visitDate,
        summary: schema.fieldReports.summary,
        assistanceDelivered: schema.fieldReports.assistanceDelivered,
        peopleReached: schema.fieldReports.peopleReached,
        createdAt: schema.fieldReports.createdAt,
        regionName: schema.communityLocations.regionName,
        caseReference: schema.humanitarianCases.referenceCode,
      })
      .from(schema.fieldReports)
      .innerJoin(schema.communityLocations, eq(schema.fieldReports.locationId, schema.communityLocations.id))
      .leftJoin(schema.humanitarianCases, eq(schema.fieldReports.caseId, schema.humanitarianCases.id))
      .where(eq(schema.fieldReports.coordinatorId, req.user!.id))
      .orderBy(desc(schema.fieldReports.visitDate));

    return res.json({ success: true, message: 'Field reports loaded', data: rows });
  }),
);

router.post(
  '/reports',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = createFieldReportSchema.parse(req.body);
    if (parsed.caseId) {
      const caseRows = await db
        .select()
        .from(schema.humanitarianCases)
        .where(eq(schema.humanitarianCases.id, parsed.caseId))
        .limit(1);
      if (!caseRows[0] || caseRows[0].coordinatorId !== req.user!.id) {
        throw new AppError(403, 'You may only attach field reports to your own cases');
      }
    }

    await db.insert(schema.fieldReports).values({
      coordinatorId: req.user!.id,
      caseId: parsed.caseId ?? null,
      locationId: parsed.locationId,
      visitDate: parsed.visitDate,
      summary: parsed.summary,
      assistanceDelivered: parsed.assistanceDelivered || null,
      peopleReached: parsed.peopleReached,
      createdAt: nowUtc(),
    });

    return res.status(201).json({
      success: true,
      message: 'Field activity report recorded',
      data: null,
    });
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
      .limit(30);
    return res.json({ success: true, message: 'Notifications loaded', data: rows });
  }),
);

router.patch(
  '/notifications/:id/read',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await db
      .update(schema.notifications)
      .set({ isRead: true })
      .where(and(eq(schema.notifications.id, Number(req.params.id)), eq(schema.notifications.userId, req.user!.id)));
    return res.json({ success: true, message: 'Notification marked as read', data: null });
  }),
);

export default router;
