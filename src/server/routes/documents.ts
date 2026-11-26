import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { and, desc, eq, like, lte, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { allocateDocumentSequence, db, schema, nowUtc } from '../../db/index';
import { requireAuth, requirePermission, type AuthenticatedRequest } from '../middleware/auth';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { env } from '../config/env';
import { deletePrivateDocument, readPrivateDocument, storePrivateDocument } from '../services/mediaStorage';
import { generateDocumentPdf, sha256Document } from '../services/documentGenerator';

const authorisedDocumentUser = [requireAuth, requirePermission('admin:documents:manage')];
const documentVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const typeFieldsSchema = z.object({
  typeCode: z.string().trim().min(2).max(32).regex(/^[A-Za-z][A-Za-z0-9_]*$/).transform((value) => value.toUpperCase()),
  displayName: z.string().trim().min(2).max(120),
  referencePrefix: z.string().trim().min(2).max(24).regex(/^[A-Za-z0-9]+$/).transform((value) => value.toUpperCase()),
  isApproved: z.boolean().default(false),
  requiresApproval: z.boolean().default(true),
  publicVerification: z.boolean().default(false),
  publicRecipient: z.boolean().default(false),
});

const typeSchema = typeFieldsSchema.refine((value) => !value.publicRecipient || value.publicVerification, {
  message: 'Public recipient information requires public verification to be enabled.',
});

const templateConfigurationSchema = z.object({
  pageSize: z.enum(['A4', 'LETTER']).default('A4'),
  orientation: z.enum(['PORTRAIT', 'LANDSCAPE']).default('PORTRAIT'),
  title: z.string().trim().max(160).default(''),
  introduction: z.string().trim().max(2000).default(''),
  footerText: z.string().trim().max(500).default(''),
  signatoryId: z.number().int().positive().nullable().default(null),
  includeBarcode: z.boolean().default(true),
});

const templateSchema = z.object({
  documentTypeId: z.number().int().positive(),
  name: z.string().trim().min(2).max(120),
  isActive: z.boolean().default(false),
  configuration: templateConfigurationSchema,
});

const documentPayloadSchema = z.object({
  purpose: z.string().trim().max(6000).default(''),
  programme: z.string().trim().max(180).optional().default(''),
  startDate: z.string().trim().max(40).optional().default(''),
  endDate: z.string().trim().max(40).optional().default(''),
});

const editorContentSchema = z.object({
  type: z.literal('doc'),
  content: z.array(z.unknown()).optional(),
}).passthrough();

const editorPageSettingsSchema = z.object({
  orientation: z.enum(['PORTRAIT', 'LANDSCAPE']).default('PORTRAIT'),
  marginTop: z.number().int().min(10).max(40).default(22),
  marginRight: z.number().int().min(10).max(40).default(20),
  marginBottom: z.number().int().min(10).max(40).default(22),
  marginLeft: z.number().int().min(10).max(40).default(20),
  headerText: z.string().max(180).default(''),
  footerText: z.string().max(180).default(''),
  showPageNumbers: z.boolean().default(true),
});

const editorDraftSchema = z.object({
  title: z.string().trim().max(180).default('Untitled document'),
  content: editorContentSchema,
  pageSettings: editorPageSettingsSchema.default({
    orientation: 'PORTRAIT',
    marginTop: 22,
    marginRight: 20,
    marginBottom: 22,
    marginLeft: 20,
    headerText: '',
    footerText: '',
    showPageNumbers: true,
  }),
});

function parseEditorContent(value: unknown): z.infer<typeof editorContentSchema> {
  const root = editorContentSchema.parse(value);
  const stack = (root.content || []).map((node) => ({ node, depth: 1 }));
  let nodeCount = 0;
  while (stack.length) {
    const current = stack.pop()!;
    if (!current.node || typeof current.node !== 'object' || Array.isArray(current.node)) {
      throw new AppError(400, 'Document content contains an invalid node.');
    }
    const node = current.node as Record<string, unknown>;
    if (
      typeof node.type !== 'string' ||
      node.type.length > 80 ||
      (node.text !== undefined && typeof node.text !== 'string') ||
      (node.content !== undefined && !Array.isArray(node.content)) ||
      (node.attrs !== undefined && (!node.attrs || typeof node.attrs !== 'object' || Array.isArray(node.attrs))) ||
      (node.marks !== undefined && !Array.isArray(node.marks))
    ) {
      throw new AppError(400, 'Document content contains an invalid node.');
    }
    nodeCount += 1;
    if (nodeCount > 50_000 || current.depth > 50) {
      throw new AppError(400, 'Document content exceeds the supported structure limits.');
    }
    for (const child of (node.content || []) as unknown[]) {
      stack.push({ node: child, depth: current.depth + 1 });
    }
  }
  return root;
}

function parseEditorContentJson(value: string): z.infer<typeof editorContentSchema> {
  try {
    return parseEditorContent(JSON.parse(value));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, 'Document content must be valid JSON.');
  }
}

const draftSchema = z.object({
  documentTypeId: z.number().int().positive(),
  templateId: z.number().int().positive(),
  recipientName: z.string().trim().min(2).max(180),
  subject: z.string().trim().min(2).max(240),
  payload: documentPayloadSchema,
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
  publicRecipientName: z.string().trim().max(180).nullable().optional(),
  contentJson: z.string().max(6_000_000).nullable().optional(),
});

const profileSchema = z.object({
  officialName: z.string().trim().max(180).nullable(),
  registeredAddress: z.string().trim().max(500).nullable(),
  country: z.string().trim().max(120).nullable(),
  telephone: z.string().trim().max(80).nullable(),
  email: z.string().trim().email().max(255).nullable().or(z.literal('')),
  website: z.string().trim().url().max(255).nullable().or(z.literal('')),
  registrationInformation: z.string().trim().max(255).nullable(),
  approvedTagline: z.string().trim().max(255).nullable(),
  issuingDepartment: z.string().trim().max(160).nullable(),
  footerDisclaimer: z.string().trim().max(500).nullable(),
});

const signatorySchema = z.object({
  fullName: z.string().trim().min(2).max(180),
  position: z.string().trim().min(2).max(160),
  department: z.string().trim().max(160).nullable().optional(),
  authorisedTypeCodes: z.array(z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9_]*$/)).max(50),
  isAuthorised: z.boolean().default(false),
  validFrom: z.string().datetime({ offset: true }).nullable().optional(),
  validUntil: z.string().datetime({ offset: true }).nullable().optional(),
});

type TemplateConfiguration = z.infer<typeof templateConfigurationSchema>;
type DocumentPayload = z.infer<typeof documentPayloadSchema>;

function parseTemplateConfiguration(value: string): TemplateConfiguration {
  return templateConfigurationSchema.parse(JSON.parse(value));
}

function referenceId(value: string): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new AppError(400, 'Invalid document record identifier.');
  return id;
}

function cleanNullable(value: string | null | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

async function getTemplate(templateId: number) {
  const [template] = await db.select().from(schema.documentTemplates)
    .where(eq(schema.documentTemplates.id, templateId)).limit(1);
  if (!template) throw new AppError(404, 'Document template not found.');
  const [version] = await db.select().from(schema.documentTemplateVersions)
    .where(and(
      eq(schema.documentTemplateVersions.templateId, template.id),
      eq(schema.documentTemplateVersions.versionNumber, template.currentVersion),
    ))
    .limit(1);
  if (!version) throw new AppError(500, 'The current document template version is missing.');
  return { template, version, configuration: parseTemplateConfiguration(version.configurationJson) };
}

async function getDocumentType(typeId: number) {
  const [type] = await db.select().from(schema.documentTypes)
    .where(eq(schema.documentTypes.id, typeId)).limit(1);
  if (!type) throw new AppError(404, 'Document category not found.');
  return type;
}

async function getOrganisationProfile() {
  const [profile] = await db.select().from(schema.documentOrganisationProfiles)
    .where(eq(schema.documentOrganisationProfiles.id, 1)).limit(1);
  return profile || null;
}

async function getAuthorisedSignatory(
  config: TemplateConfiguration,
  typeCode: string,
  required = false,
) {
  if (!config.signatoryId) {
    if (required) throw new AppError(409, 'Configure an authorised signatory on the active template before issuing documents.');
    return null;
  }
  const [signatory] = await db.select().from(schema.documentSignatories)
    .where(eq(schema.documentSignatories.id, config.signatoryId)).limit(1);
  if (!signatory) throw new AppError(400, 'The template signatory is unavailable.');
  let allowedTypeCodes: unknown;
  try {
    allowedTypeCodes = JSON.parse(signatory.authorisedTypeCodesJson);
  } catch {
    throw new AppError(500, 'The signatory authorisation record is invalid.');
  }
  if (
    !signatory.isAuthorised ||
    !Array.isArray(allowedTypeCodes) ||
    !allowedTypeCodes.includes(typeCode)
  ) {
    throw new AppError(400, 'The selected signatory is not authorised for this document category.');
  }
  const now = Date.now();
  if (
    (signatory.validFrom && new Date(signatory.validFrom).getTime() > now) ||
    (signatory.validUntil && new Date(signatory.validUntil).getTime() < now)
  ) {
    throw new AppError(400, 'The selected signatory is outside the authorised validity period.');
  }
  return {
    fullName: signatory.fullName,
    position: signatory.position,
    department: signatory.department,
  };
}

function buildPdfInput(input: {
  referenceCode: string;
  verificationUrl: string | null;
  typeName: string;
  typeCode: string;
  recipientName: string;
  subject: string;
  payload: DocumentPayload;
  expiresAt?: string | Date | null;
  issueDate: string | Date;
  configuration: TemplateConfiguration;
  organisation: NonNullable<Awaited<ReturnType<typeof getOrganisationProfile>>>;
  signatory: Awaited<ReturnType<typeof getAuthorisedSignatory>>;
  contentJson?: string | null;
  preview?: boolean;
}) {
  const issueDate = input.issueDate instanceof Date ? input.issueDate.toISOString() : input.issueDate;
  const expiryDate = input.expiresAt instanceof Date ? input.expiresAt.toISOString() : input.expiresAt;
  const pageSettings = input.contentJson
    ? editorPageSettingsSchema.parse(JSON.parse(input.contentJson).pageSettings || {})
    : undefined;
  return {
    referenceCode: input.referenceCode,
    verificationUrl: input.verificationUrl,
    recipientName: input.recipientName,
    subject: input.subject,
    purpose: input.payload.purpose,
    programme: input.payload.programme,
    startDate: input.payload.startDate,
    endDate: input.payload.endDate,
    issueDate,
    expiresAt: expiryDate,
    pageSize: pageSettings ? 'A4' : input.configuration.pageSize,
    orientation: pageSettings?.orientation || input.configuration.orientation,
    title: input.configuration.title || input.typeName,
    introduction: input.configuration.introduction,
    footerText: input.configuration.footerText,
    includeBarcode: input.configuration.includeBarcode,
    organisation: input.organisation,
    signatory: input.signatory,
    contentJson: input.contentJson || undefined,
    pageSettings,
    preview: input.preview,
  };
}

function appendHistory(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  documentId: number,
  previousStatus: string | null,
  newStatus: string,
  changedBy: number,
  reason?: string | null,
) {
  return tx.insert(schema.documentStatusHistory).values({
    documentId,
    previousStatus,
    newStatus,
    reason: reason || null,
    changedBy,
    changedAt: nowUtc(),
  });
}

async function writeDocumentAudit(input: {
  actorUserId: number;
  actorRole: string;
  action: string;
  resourceId: number | string;
  resourceType?: string;
  details?: Record<string, unknown>;
}) {
  await db.insert(schema.auditLogs).values({
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    action: input.action,
    resourceType: input.resourceType || 'issued_document',
    resourceId: String(input.resourceId),
    detailsJson: input.details ? JSON.stringify(input.details) : null,
    ipAddress: null,
    createdAt: nowUtc(),
  });
}

async function createDraft(
  input: z.infer<typeof draftSchema>,
  user: NonNullable<AuthenticatedRequest['user']>,
) {
  const [type, template] = await Promise.all([
    getDocumentType(input.documentTypeId),
    getTemplate(input.templateId),
  ]);
  if (!type.isApproved) throw new AppError(400, 'This document category is not approved for issuance.');
  if (!template.template.isActive || template.template.documentTypeId !== type.id) {
    throw new AppError(400, 'Select an active template for the chosen document category.');
  }
  if (!input.publicRecipientName && input.publicRecipientName !== null) {
    input.publicRecipientName = null;
  }
  if (input.publicRecipientName && (!type.publicVerification || !type.publicRecipient)) {
    throw new AppError(400, 'This category does not permit public recipient disclosure.');
  }
  if (input.expiresAt && new Date(input.expiresAt).getTime() <= Date.now()) {
    throw new AppError(400, 'The expiry date must be in the future.');
  }
  const draftCode = `DRAFT-${crypto.randomUUID()}`;
  const payload = documentPayloadSchema.parse(input.payload);
  if (input.contentJson) parseEditorContentJson(input.contentJson);
  const createdAt = nowUtc();

  await db.transaction(async (tx) => {
    await tx.insert(schema.issuedDocuments).values({
      referenceCode: draftCode,
      documentTypeId: type.id,
      templateVersionId: template.version.id,
      status: 'DRAFT',
      recipientName: input.recipientName,
      subject: input.subject,
      payloadJson: JSON.stringify(payload),
      contentJson: input.contentJson || null,
      publicRecipientName: cleanNullable(input.publicRecipientName),
      createdBy: user.id,
      createdAt,
      expiresAt: input.expiresAt ? new Date(input.expiresAt).toISOString() : null,
    });
    const [record] = await tx.select({ id: schema.issuedDocuments.id })
      .from(schema.issuedDocuments)
      .where(eq(schema.issuedDocuments.referenceCode, draftCode))
      .limit(1);
    if (!record) throw new Error('Document draft could not be confirmed after insertion.');
    await appendHistory(tx, record.id, null, 'DRAFT', user.id);
    await tx.insert(schema.auditLogs).values({
      actorUserId: user.id,
      actorRole: user.role,
      action: 'DOCUMENT_DRAFT_CREATED',
      resourceType: 'issued_document',
      resourceId: String(record.id),
      detailsJson: JSON.stringify({ documentTypeId: type.id, templateVersionId: template.version.id }),
      ipAddress: null,
      createdAt,
    });
  });

  const [record] = await db.select({
    id: schema.issuedDocuments.id,
    status: schema.issuedDocuments.status,
  }).from(schema.issuedDocuments)
    .where(eq(schema.issuedDocuments.referenceCode, draftCode)).limit(1);
  if (!record) throw new Error('Created document draft was not found.');
  return record;
}

async function allocateReference(prefix: string, year: number): Promise<string> {
  const sequence = await allocateDocumentSequence(prefix, year);
  return `HB-${prefix}-${year}-${String(sequence).padStart(6, '0')}`;
}

async function issueDocument(
  documentId: number,
  user: NonNullable<AuthenticatedRequest['user']>,
  expectedStatus: 'DRAFT' | 'PENDING_APPROVAL',
) {
  let createdStorageKey: string | null = null;
  try {
    let result: { referenceCode: string; status: string };
    const [preflightRecord] = await db.select({
      documentTypeId: schema.issuedDocuments.documentTypeId,
      status: schema.issuedDocuments.status,
    }).from(schema.issuedDocuments)
      .where(eq(schema.issuedDocuments.id, documentId)).limit(1);
    if (!preflightRecord || preflightRecord.status !== expectedStatus) {
      throw new AppError(409, 'This document is no longer available for issuance.');
    }
    const preflightType = await getDocumentType(preflightRecord.documentTypeId);
    const year = new Date().getUTCFullYear();
    const referenceCode = await allocateReference(preflightType.referencePrefix, year);
    await db.transaction(async (tx) => {
      const [record] = await tx.select().from(schema.issuedDocuments)
        .where(eq(schema.issuedDocuments.id, documentId)).limit(1);
      if (!record || record.status !== expectedStatus) {
        throw new AppError(409, 'This document is no longer available for issuance.');
      }
      if (expectedStatus === 'PENDING_APPROVAL' && record.createdBy === user.id) {
        throw new AppError(403, 'A different authorised administrator must approve this document.');
      }

      const [type] = await tx.select().from(schema.documentTypes)
        .where(eq(schema.documentTypes.id, record.documentTypeId)).limit(1);
      if (!type?.isApproved) throw new AppError(400, 'This document category is not approved for issuance.');
      if (type.referencePrefix !== preflightType.referencePrefix) {
        throw new AppError(409, 'The document category changed during issuance. Please retry.');
      }
      const [version] = await tx.select().from(schema.documentTemplateVersions)
        .where(eq(schema.documentTemplateVersions.id, record.templateVersionId)).limit(1);
      if (!version) throw new AppError(500, 'The document template version is unavailable.');
      const [template] = await tx.select().from(schema.documentTemplates)
        .where(eq(schema.documentTemplates.id, version.templateId)).limit(1);
      if (!template?.isActive || template.documentTypeId !== type.id) {
        throw new AppError(409, 'The document needs an active template for its approved category before issuance.');
      }
      const [organisation] = await tx.select().from(schema.documentOrganisationProfiles)
        .where(eq(schema.documentOrganisationProfiles.id, 1)).limit(1);
      if (!organisation?.officialName?.trim()) {
        throw new AppError(409, 'Configure the approved organisation name before issuing documents.');
      }

      const configuration = parseTemplateConfiguration(version.configurationJson);
      const signatory = await getAuthorisedSignatory(configuration, type.typeCode, true);
      const payload = documentPayloadSchema.parse(JSON.parse(record.payloadJson));
      const currentTime = nowUtc();
      const verificationUrl = type.publicVerification
        ? new URL(`/verify/${encodeURIComponent(referenceCode)}`, env.appUrl).toString()
        : null;
      const pdf = await generateDocumentPdf(buildPdfInput({
        referenceCode,
        verificationUrl,
        typeName: type.displayName,
        typeCode: type.typeCode,
        recipientName: record.recipientName,
        subject: record.subject,
        payload,
        contentJson: record.contentJson,
        expiresAt: record.expiresAt,
        issueDate: currentTime,
        configuration,
        organisation,
        signatory,
      }));
      const storageKey = `documents/${crypto.randomUUID()}.pdf`;
      createdStorageKey = storageKey;
      await storePrivateDocument(storageKey, pdf);

      const nextStatus = 'ISSUED';
      const updated = await tx.update(schema.issuedDocuments).set({
        referenceCode,
        status: nextStatus,
        organisationSnapshotJson: JSON.stringify(organisation),
        storageKey,
        pdfSha256: sha256Document(pdf),
        approvedBy: expectedStatus === 'PENDING_APPROVAL' ? user.id : record.approvedBy,
        issuedBy: user.id,
        issuedAt: currentTime,
      }).where(and(
        eq(schema.issuedDocuments.id, record.id),
        eq(schema.issuedDocuments.status, expectedStatus),
      ));

      const affectedRows = getAffectedRows(updated);
      if (affectedRows === 0) throw new AppError(409, 'This document was issued by another administrator.');
      await appendHistory(tx, record.id, expectedStatus, nextStatus, user.id);
      await tx.insert(schema.auditLogs).values({
        actorUserId: user.id,
        actorRole: user.role,
        action: expectedStatus === 'PENDING_APPROVAL' ? 'DOCUMENT_APPROVED_AND_ISSUED' : 'DOCUMENT_ISSUED',
        resourceType: 'issued_document',
        resourceId: String(record.id),
        detailsJson: JSON.stringify({ referenceCode, templateVersionId: record.templateVersionId }),
        ipAddress: null,
        createdAt: currentTime,
      });
      result = { referenceCode, status: nextStatus };
    });
    return result!;
  } catch (error) {
    if (createdStorageKey) {
      try {
        await deletePrivateDocument(createdStorageKey);
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          'Document issuance failed and its incomplete private PDF could not be removed.',
        );
      }
    }
    throw error;
  }
}

function getAffectedRows(result: unknown): number | undefined {
  if (Array.isArray(result)) {
    const nested = result.find((item) => typeof item === 'object' && item !== null);
    if (nested) return getAffectedRows(nested);
  }
  if (typeof result === 'object' && result !== null) {
    if ('affectedRows' in result && typeof result.affectedRows === 'number') return result.affectedRows;
    if ('rowsAffected' in result && typeof result.rowsAffected === 'number') return result.rowsAffected;
    if ('changes' in result && typeof result.changes === 'number') return result.changes;
  }
  return undefined;
}

export const publicDocumentRoutes = Router();

publicDocumentRoutes.get(
  '/verify/:reference',
  documentVerificationLimiter,
  asyncHandler(async (req, res) => {
    const referenceCode = String(req.params.reference || '').trim().toUpperCase();
    if (!/^[A-Z0-9-]{8,80}$/.test(referenceCode)) {
      return res.setHeader('Cache-Control', 'no-store').json({
        success: true,
        message: 'Verification completed.',
        data: { status: 'NOT_FOUND' },
      });
    }

    const [result] = await db.select({
      id: schema.issuedDocuments.id,
      referenceCode: schema.issuedDocuments.referenceCode,
      status: schema.issuedDocuments.status,
      issuedAt: schema.issuedDocuments.issuedAt,
      expiresAt: schema.issuedDocuments.expiresAt,
      publicRecipientName: schema.issuedDocuments.publicRecipientName,
      typeName: schema.documentTypes.displayName,
      typePublicVerification: schema.documentTypes.publicVerification,
      typePublicRecipient: schema.documentTypes.publicRecipient,
      organisationSnapshotJson: schema.issuedDocuments.organisationSnapshotJson,
    }).from(schema.issuedDocuments)
      .innerJoin(schema.documentTypes, eq(schema.issuedDocuments.documentTypeId, schema.documentTypes.id))
      .where(eq(schema.issuedDocuments.referenceCode, referenceCode))
      .limit(1);

    const hidden = !result ||
      !result.typePublicVerification ||
      !['ISSUED', 'REVOKED'].includes(result.status);
    if (hidden) {
      return res.setHeader('Cache-Control', 'no-store').json({
        success: true,
        message: 'Verification completed.',
        data: { status: 'NOT_FOUND' },
      });
    }

    const expired = result.status === 'ISSUED' && result.expiresAt !== null &&
      new Date(result.expiresAt).getTime() <= Date.now();
    const status = result.status === 'REVOKED' ? 'REVOKED' : expired ? 'EXPIRED' : 'VALID';
    const [organisationSnapshot] = result.organisationSnapshotJson
      ? [JSON.parse(result.organisationSnapshotJson) as { officialName?: string | null }]
      : [null];

    await db.insert(schema.documentVerificationEvents).values({
      documentId: result.id,
      verifiedAt: nowUtc(),
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success: true,
      message: 'Verification completed.',
      data: {
        status,
        referenceCode: result.referenceCode,
        category: result.typeName,
        issuingOrganisation: organisationSnapshot?.officialName || null,
        issueDate: result.issuedAt,
        expiryDate: result.expiresAt,
        recipientName: result.typePublicRecipient ? result.publicRecipientName : null,
        verifiedAt: new Date().toISOString(),
      },
    });
  }),
);

export const adminDocumentRoutes = Router();
adminDocumentRoutes.use(...authorisedDocumentUser);

adminDocumentRoutes.get(
  '/overview',
  asyncHandler(async (_req, res) => {
    const [statusCounts, categoryCounts, verificationCount] = await Promise.all([
      db.select({
        status: schema.issuedDocuments.status,
        count: sql<number>`count(*)`,
      }).from(schema.issuedDocuments).groupBy(schema.issuedDocuments.status),
      db.select({
        category: schema.documentTypes.displayName,
        count: sql<number>`count(*)`,
      }).from(schema.issuedDocuments)
        .innerJoin(schema.documentTypes, eq(schema.issuedDocuments.documentTypeId, schema.documentTypes.id))
        .groupBy(schema.documentTypes.displayName),
      db.select({ count: sql<number>`count(*)` }).from(schema.documentVerificationEvents),
    ]);
    const counts = Object.fromEntries(statusCounts.map((row) => [row.status, Number(row.count)]));
    const [expiredCount] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.issuedDocuments)
      .where(and(
        eq(schema.issuedDocuments.status, 'ISSUED'),
        lte(schema.issuedDocuments.expiresAt, nowUtc()),
      ));
    return res.json({
      success: true,
      message: 'Document centre overview loaded.',
      data: {
        totalIssued: (counts.ISSUED || 0) + (counts.REVOKED || 0) + (counts.EXPIRED || 0) + (counts.ARCHIVED || 0),
        awaitingApproval: counts.PENDING_APPROVAL || 0,
        valid: Math.max(0, (counts.ISSUED || 0) - Number(expiredCount?.count || 0)),
        revoked: counts.REVOKED || 0,
        expired: Number(expiredCount?.count || 0),
        archived: counts.ARCHIVED || 0,
        totalVerifications: Number(verificationCount[0]?.count || 0),
        categories: categoryCounts.map((row) => ({ name: row.category, count: Number(row.count) })),
      },
    });
  }),
);

adminDocumentRoutes.get(
  '/types',
  asyncHandler(async (_req, res) => {
    const types = await db.select().from(schema.documentTypes).orderBy(schema.documentTypes.displayName);
    return res.json({ success: true, message: 'Document categories loaded.', data: types });
  }),
);

adminDocumentRoutes.post(
  '/types',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = typeSchema.parse(req.body);
    const timestamp = nowUtc();
    await db.insert(schema.documentTypes).values({
      ...input,
      createdBy: req.user!.id,
      updatedBy: req.user!.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const [created] = await db.select().from(schema.documentTypes)
      .where(eq(schema.documentTypes.typeCode, input.typeCode)).limit(1);
    if (!created) throw new Error('Document category was not found after creation.');
    await writeDocumentAudit({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'DOCUMENT_CATEGORY_CREATED',
      resourceType: 'document_category',
      resourceId: created.id,
      details: { typeCode: input.typeCode, approved: input.isApproved },
    });
    return res.status(201).json({ success: true, message: 'Document category created.', data: created });
  }),
);

adminDocumentRoutes.patch(
  '/types/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = referenceId(String(req.params.id));
    const input = typeFieldsSchema.partial().parse(req.body);
    const [existing] = await db.select().from(schema.documentTypes)
      .where(eq(schema.documentTypes.id, id)).limit(1);
    if (!existing) throw new AppError(404, 'Document category not found.');
    const next = { ...existing, ...input };
    if (next.publicRecipient && !next.publicVerification) {
      throw new AppError(400, 'Public recipient information requires public verification to be enabled.');
    }
    await db.update(schema.documentTypes)
      .set({ ...input, updatedBy: req.user!.id, updatedAt: nowUtc() })
      .where(eq(schema.documentTypes.id, id));
    await writeDocumentAudit({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'DOCUMENT_CATEGORY_UPDATED',
      resourceType: 'document_category',
      resourceId: id,
      details: { changedFields: Object.keys(input) },
    });
    const [updated] = await db.select().from(schema.documentTypes)
      .where(eq(schema.documentTypes.id, id)).limit(1);
    return res.json({ success: true, message: 'Document category updated.', data: updated });
  }),
);

adminDocumentRoutes.get(
  '/templates',
  asyncHandler(async (_req, res) => {
    const rows = await db.select({
      id: schema.documentTemplates.id,
      documentTypeId: schema.documentTemplates.documentTypeId,
      categoryName: schema.documentTypes.displayName,
      name: schema.documentTemplates.name,
      isActive: schema.documentTemplates.isActive,
      currentVersion: schema.documentTemplates.currentVersion,
      versionId: schema.documentTemplateVersions.id,
      configurationJson: schema.documentTemplateVersions.configurationJson,
      createdAt: schema.documentTemplates.createdAt,
      updatedAt: schema.documentTemplates.updatedAt,
    }).from(schema.documentTemplates)
      .innerJoin(schema.documentTypes, eq(schema.documentTemplates.documentTypeId, schema.documentTypes.id))
      .leftJoin(schema.documentTemplateVersions, and(
        eq(schema.documentTemplateVersions.templateId, schema.documentTemplates.id),
        eq(schema.documentTemplateVersions.versionNumber, schema.documentTemplates.currentVersion),
      ))
      .orderBy(desc(schema.documentTemplates.updatedAt));
    const data = rows.map((row) => ({
      ...row,
      configuration: row.configurationJson
        ? parseTemplateConfiguration(row.configurationJson)
        : null,
    }));
    return res.json({ success: true, message: 'Document templates loaded.', data });
  }),
);

adminDocumentRoutes.post(
  '/templates',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = templateSchema.parse(req.body);
    const type = await getDocumentType(input.documentTypeId);
    const timestamp = nowUtc();
    let createdTemplateId = 0;
    await db.transaction(async (tx) => {
      await tx.insert(schema.documentTemplates).values({
        documentTypeId: type.id,
        name: input.name,
        isActive: input.isActive && type.isApproved,
        currentVersion: 1,
        createdBy: req.user!.id,
        updatedBy: req.user!.id,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      const [template] = await tx.select().from(schema.documentTemplates)
        .where(and(
          eq(schema.documentTemplates.documentTypeId, type.id),
          eq(schema.documentTemplates.name, input.name),
        ))
        .orderBy(desc(schema.documentTemplates.id))
        .limit(1);
      if (!template) throw new Error('Document template could not be confirmed after creation.');
      createdTemplateId = template.id;
      await tx.insert(schema.documentTemplateVersions).values({
        templateId: template.id,
        versionNumber: 1,
        configurationJson: JSON.stringify(input.configuration),
        createdBy: req.user!.id,
        createdAt: timestamp,
      });
    });
    await writeDocumentAudit({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'DOCUMENT_TEMPLATE_CREATED',
      resourceType: 'document_template',
      resourceId: createdTemplateId,
      details: { name: input.name },
    });
    return res.status(201).json({ success: true, message: 'Document template created.', data: null });
  }),
);

adminDocumentRoutes.patch(
  '/templates/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = referenceId(String(req.params.id));
    const input = z.object({
      name: z.string().trim().min(2).max(120),
      isActive: z.boolean(),
      configuration: templateConfigurationSchema,
    }).parse(req.body);
    const [existing] = await db.select().from(schema.documentTemplates)
      .where(eq(schema.documentTemplates.id, id)).limit(1);
    if (!existing) throw new AppError(404, 'Document template not found.');
    const type = await getDocumentType(existing.documentTypeId);
    if (input.isActive && !type.isApproved) {
      throw new AppError(400, 'Approve the document category before activating its template.');
    }
    const nextVersion = existing.currentVersion + 1;
    const timestamp = nowUtc();
    await db.transaction(async (tx) => {
      await tx.insert(schema.documentTemplateVersions).values({
        templateId: existing.id,
        versionNumber: nextVersion,
        configurationJson: JSON.stringify(input.configuration),
        createdBy: req.user!.id,
        createdAt: timestamp,
      });
      await tx.update(schema.documentTemplates).set({
        name: input.name,
        isActive: input.isActive,
        currentVersion: nextVersion,
        updatedBy: req.user!.id,
        updatedAt: timestamp,
      }).where(eq(schema.documentTemplates.id, existing.id));
    });
    await writeDocumentAudit({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'DOCUMENT_TEMPLATE_VERSION_CREATED',
      resourceType: 'document_template',
      resourceId: existing.id,
      details: { version: nextVersion, isActive: input.isActive },
    });
    return res.json({ success: true, message: 'A new template version was saved.', data: { version: nextVersion } });
  }),
);

adminDocumentRoutes.get(
  '/templates/:id/versions',
  asyncHandler(async (req, res) => {
    const id = referenceId(String(req.params.id));
    const versions = await db.select({
      versionNumber: schema.documentTemplateVersions.versionNumber,
      configurationJson: schema.documentTemplateVersions.configurationJson,
      createdAt: schema.documentTemplateVersions.createdAt,
      createdBy: schema.documentTemplateVersions.createdBy,
    }).from(schema.documentTemplateVersions)
      .where(eq(schema.documentTemplateVersions.templateId, id))
      .orderBy(desc(schema.documentTemplateVersions.versionNumber));
    return res.json({
      success: true,
      message: 'Document template version history loaded.',
      data: versions.map((version) => ({
        ...version,
        configuration: parseTemplateConfiguration(version.configurationJson),
      })),
    });
  }),
);

adminDocumentRoutes.get(
  '/organisation',
  asyncHandler(async (_req, res) => {
    const profile = await getOrganisationProfile();
    return res.json({ success: true, message: 'Document organisation information loaded.', data: profile });
  }),
);

adminDocumentRoutes.put(
  '/organisation',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = profileSchema.parse(req.body);
    const timestamp = nowUtc();
    const existing = await getOrganisationProfile();
    const values = {
      ...input,
      email: cleanNullable(input.email),
      website: cleanNullable(input.website),
      updatedBy: req.user!.id,
      updatedAt: timestamp,
    };
    if (existing) {
      await db.update(schema.documentOrganisationProfiles).set(values)
        .where(eq(schema.documentOrganisationProfiles.id, 1));
    } else {
      await db.insert(schema.documentOrganisationProfiles).values({ id: 1, ...values });
    }
    await writeDocumentAudit({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'DOCUMENT_ORGANISATION_PROFILE_UPDATED',
      resourceType: 'organisation_profile',
      resourceId: 1,
      details: { changedFields: Object.keys(input) },
    });
    const profile = await getOrganisationProfile();
    return res.json({ success: true, message: 'Document organisation information saved.', data: profile });
  }),
);

adminDocumentRoutes.get(
  '/signatories',
  asyncHandler(async (_req, res) => {
    const rows = await db.select().from(schema.documentSignatories)
      .orderBy(desc(schema.documentSignatories.updatedAt));
    return res.json({
      success: true,
      message: 'Document signatories loaded.',
      data: rows.map((row) => ({
        ...row,
        authorisedTypeCodes: z.array(z.string()).parse(JSON.parse(row.authorisedTypeCodesJson)),
      })),
    });
  }),
);

adminDocumentRoutes.post(
  '/signatories',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = signatorySchema.parse(req.body);
    const timestamp = nowUtc();
    const codes = [...new Set(input.authorisedTypeCodes)];
    await db.insert(schema.documentSignatories).values({
      fullName: input.fullName,
      position: input.position,
      department: cleanNullable(input.department),
      authorisedTypeCodesJson: JSON.stringify(codes),
      isAuthorised: input.isAuthorised,
      validFrom: input.validFrom ? new Date(input.validFrom).toISOString() : null,
      validUntil: input.validUntil ? new Date(input.validUntil).toISOString() : null,
      createdBy: req.user!.id,
      updatedBy: req.user!.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const [created] = await db.select({ id: schema.documentSignatories.id })
      .from(schema.documentSignatories)
      .where(and(
        eq(schema.documentSignatories.createdBy, req.user!.id),
        eq(schema.documentSignatories.fullName, input.fullName),
        eq(schema.documentSignatories.createdAt, timestamp),
      ))
      .orderBy(desc(schema.documentSignatories.id))
      .limit(1);
    if (!created) throw new Error('Document signatory could not be confirmed after creation.');
    await writeDocumentAudit({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'DOCUMENT_SIGNATORY_CREATED',
      resourceType: 'document_signatory',
      resourceId: created.id,
      details: { isAuthorised: input.isAuthorised, authorisedTypeCodes: codes },
    });
    return res.status(201).json({ success: true, message: 'Document signatory added.', data: null });
  }),
);

adminDocumentRoutes.patch(
  '/signatories/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = referenceId(String(req.params.id));
    const input = signatorySchema.partial().parse(req.body);
    const [existing] = await db.select().from(schema.documentSignatories)
      .where(eq(schema.documentSignatories.id, id)).limit(1);
    if (!existing) throw new AppError(404, 'Document signatory not found.');
    const updated = {
      ...input,
      department: input.department === undefined ? undefined : cleanNullable(input.department),
      authorisedTypeCodesJson: input.authorisedTypeCodes === undefined
        ? undefined
        : JSON.stringify([...new Set(input.authorisedTypeCodes)]),
      validFrom: input.validFrom === undefined ? undefined : input.validFrom ? new Date(input.validFrom).toISOString() : null,
      validUntil: input.validUntil === undefined ? undefined : input.validUntil ? new Date(input.validUntil).toISOString() : null,
      updatedBy: req.user!.id,
      updatedAt: nowUtc(),
    };
    await db.update(schema.documentSignatories).set(updated)
      .where(eq(schema.documentSignatories.id, id));
    await writeDocumentAudit({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'DOCUMENT_SIGNATORY_UPDATED',
      resourceType: 'document_signatory',
      resourceId: id,
      details: { changedFields: Object.keys(input) },
    });
    return res.json({ success: true, message: 'Document signatory updated.', data: null });
  }),
);

adminDocumentRoutes.get(
  '/editor/drafts',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const rows = await db.select({
      id: schema.documentEditorDrafts.id,
      title: schema.documentEditorDrafts.title,
      updatedAt: schema.documentEditorDrafts.updatedAt,
    }).from(schema.documentEditorDrafts)
      .where(eq(schema.documentEditorDrafts.createdBy, req.user!.id))
      .orderBy(desc(schema.documentEditorDrafts.updatedAt));
    return res.json({ success: true, message: 'Editable document drafts loaded.', data: rows });
  }),
);

adminDocumentRoutes.post(
  '/editor/drafts',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = editorDraftSchema.parse(req.body);
    const contentJson = JSON.stringify(parseEditorContent(input.content));
    if (Buffer.byteLength(contentJson, 'utf8') > 6_000_000) {
      throw new AppError(413, 'Document content exceeds the 6 MB editor limit.');
    }
    const timestamp = nowUtc();
    await db.insert(schema.documentEditorDrafts).values({
      title: input.title || 'Untitled document',
      contentJson,
      pageSettingsJson: JSON.stringify(input.pageSettings),
      createdBy: req.user!.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const [record] = await db.select().from(schema.documentEditorDrafts)
      .where(and(
        eq(schema.documentEditorDrafts.createdBy, req.user!.id),
        eq(schema.documentEditorDrafts.updatedAt, timestamp),
      ))
      .orderBy(desc(schema.documentEditorDrafts.id))
      .limit(1);
    if (!record) throw new Error('Editable document draft was not found after creation.');
    await writeDocumentAudit({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'DOCUMENT_EDITOR_DRAFT_CREATED',
      resourceType: 'document_editor_draft',
      resourceId: record.id,
    });
    return res.status(201).json({
      success: true,
      message: 'Blank document created.',
      data: {
        id: record.id,
        title: record.title,
        content: parseEditorContentJson(record.contentJson),
        pageSettings: editorPageSettingsSchema.parse(JSON.parse(record.pageSettingsJson)),
        updatedAt: record.updatedAt,
      },
    });
  }),
);

adminDocumentRoutes.get(
  '/editor/drafts/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = referenceId(String(req.params.id));
    const [record] = await db.select().from(schema.documentEditorDrafts)
      .where(and(
        eq(schema.documentEditorDrafts.id, id),
        eq(schema.documentEditorDrafts.createdBy, req.user!.id),
      ))
      .limit(1);
    if (!record) throw new AppError(404, 'Editable document draft not found.');
    return res.json({
      success: true,
      message: 'Editable document draft loaded.',
      data: {
        id: record.id,
        title: record.title,
        content: parseEditorContentJson(record.contentJson),
        pageSettings: editorPageSettingsSchema.parse(JSON.parse(record.pageSettingsJson)),
        updatedAt: record.updatedAt,
      },
    });
  }),
);

adminDocumentRoutes.put(
  '/editor/drafts/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = referenceId(String(req.params.id));
    const input = editorDraftSchema.parse(req.body);
    const contentJson = JSON.stringify(parseEditorContent(input.content));
    if (Buffer.byteLength(contentJson, 'utf8') > 6_000_000) {
      throw new AppError(413, 'Document content exceeds the 6 MB editor limit.');
    }
    const [existing] = await db.select({ id: schema.documentEditorDrafts.id })
      .from(schema.documentEditorDrafts)
      .where(and(
        eq(schema.documentEditorDrafts.id, id),
        eq(schema.documentEditorDrafts.createdBy, req.user!.id),
      ))
      .limit(1);
    if (!existing) throw new AppError(404, 'Editable document draft not found.');
    const timestamp = nowUtc();
    await db.update(schema.documentEditorDrafts).set({
      title: input.title || 'Untitled document',
      contentJson,
      pageSettingsJson: JSON.stringify(input.pageSettings),
      updatedAt: timestamp,
    }).where(eq(schema.documentEditorDrafts.id, id));
    return res.json({
      success: true,
      message: 'Document draft saved.',
      data: { id, updatedAt: timestamp },
    });
  }),
);

adminDocumentRoutes.post(
  '/editor/drafts/:id/duplicate',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = referenceId(String(req.params.id));
    const [source] = await db.select().from(schema.documentEditorDrafts)
      .where(and(
        eq(schema.documentEditorDrafts.id, id),
        eq(schema.documentEditorDrafts.createdBy, req.user!.id),
      ))
      .limit(1);
    if (!source) throw new AppError(404, 'Editable document draft not found.');
    const timestamp = nowUtc();
    await db.insert(schema.documentEditorDrafts).values({
      title: `${source.title} (copy)`.slice(0, 180),
      contentJson: source.contentJson,
      pageSettingsJson: source.pageSettingsJson,
      createdBy: req.user!.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const [copy] = await db.select().from(schema.documentEditorDrafts)
      .where(and(
        eq(schema.documentEditorDrafts.createdBy, req.user!.id),
        eq(schema.documentEditorDrafts.updatedAt, timestamp),
      ))
      .orderBy(desc(schema.documentEditorDrafts.id))
      .limit(1);
    if (!copy) throw new Error('Duplicated document draft was not found after creation.');
    await writeDocumentAudit({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'DOCUMENT_EDITOR_DRAFT_DUPLICATED',
      resourceType: 'document_editor_draft',
      resourceId: copy.id,
      details: { sourceDraftId: id },
    });
    return res.status(201).json({
      success: true,
      message: 'Document draft duplicated.',
      data: {
        id: copy.id,
        title: copy.title,
        content: parseEditorContentJson(copy.contentJson),
        pageSettings: editorPageSettingsSchema.parse(JSON.parse(copy.pageSettingsJson)),
        updatedAt: copy.updatedAt,
      },
    });
  }),
);

adminDocumentRoutes.delete(
  '/editor/drafts/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = referenceId(String(req.params.id));
    const [record] = await db.select({ id: schema.documentEditorDrafts.id })
      .from(schema.documentEditorDrafts)
      .where(and(
        eq(schema.documentEditorDrafts.id, id),
        eq(schema.documentEditorDrafts.createdBy, req.user!.id),
      ))
      .limit(1);
    if (!record) throw new AppError(404, 'Editable document draft not found.');
    await db.delete(schema.documentEditorDrafts).where(eq(schema.documentEditorDrafts.id, id));
    await writeDocumentAudit({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'DOCUMENT_EDITOR_DRAFT_DELETED',
      resourceType: 'document_editor_draft',
      resourceId: id,
    });
    return res.json({ success: true, message: 'Document draft deleted.', data: null });
  }),
);

adminDocumentRoutes.post(
  '/editor/submit',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = z.object({
      draftId: z.number().int().positive(),
      documentTypeId: z.number().int().positive(),
      templateId: z.number().int().positive(),
      recipientName: z.string().trim().min(2).max(180),
      subject: z.string().trim().min(2).max(240),
      expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
    }).parse(req.body);
    const [editorDraft] = await db.select().from(schema.documentEditorDrafts)
      .where(and(
        eq(schema.documentEditorDrafts.id, input.draftId),
        eq(schema.documentEditorDrafts.createdBy, req.user!.id),
      ))
      .limit(1);
    if (!editorDraft) throw new AppError(404, 'Editable document draft not found.');
    const content = parseEditorContentJson(editorDraft.contentJson);
    const pageSettings = editorPageSettingsSchema.parse(JSON.parse(editorDraft.pageSettingsJson));
    const contentJson = JSON.stringify({ ...content, pageSettings });
    const type = await getDocumentType(input.documentTypeId);
    const record = await createDraft({
      documentTypeId: input.documentTypeId,
      templateId: input.templateId,
      recipientName: input.recipientName,
      subject: input.subject,
      payload: { purpose: '', programme: '', startDate: '', endDate: '' },
      expiresAt: input.expiresAt,
      publicRecipientName: null,
      contentJson,
    }, req.user!);
    await writeDocumentAudit({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'DOCUMENT_EDITOR_SUBMITTED',
      resourceType: 'issued_document',
      resourceId: record.id,
      details: { editorDraftId: editorDraft.id, categoryId: type.id },
    });
    if (!type.requiresApproval) {
      const issued = await issueDocument(record.id, req.user!, 'DRAFT');
      return res.status(201).json({
        success: true,
        message: 'Document issued and stored securely.',
        data: { id: record.id, ...issued },
      });
    }
    const timestamp = nowUtc();
    await db.transaction(async (tx) => {
      const updated = await tx.update(schema.issuedDocuments).set({ status: 'PENDING_APPROVAL' })
        .where(and(
          eq(schema.issuedDocuments.id, record.id),
          eq(schema.issuedDocuments.status, 'DRAFT'),
        ));
      if (getAffectedRows(updated) === 0) throw new AppError(409, 'This document changed before submission.');
      await appendHistory(tx, record.id, 'DRAFT', 'PENDING_APPROVAL', req.user!.id);
      await tx.insert(schema.auditLogs).values({
        actorUserId: req.user!.id,
        actorRole: req.user!.role,
        action: 'DOCUMENT_SUBMITTED_FOR_APPROVAL',
        resourceType: 'issued_document',
        resourceId: String(record.id),
        detailsJson: JSON.stringify({ editorDraftId: editorDraft.id }),
        ipAddress: null,
        createdAt: timestamp,
      });
    });
    return res.status(202).json({
      success: true,
      message: 'Document submitted for independent approval.',
      data: { id: record.id, status: 'PENDING_APPROVAL' },
    });
  }),
);

adminDocumentRoutes.post(
  '/preview',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = draftSchema.parse(req.body);
    const type = await getDocumentType(input.documentTypeId);
    const { template, configuration } = await getTemplate(input.templateId);
    if (!type.isApproved || !template.isActive || template.documentTypeId !== type.id) {
      throw new AppError(400, 'Choose an approved category and an active matching template.');
    }
    const organisation = await getOrganisationProfile();
    if (!organisation?.officialName?.trim()) {
      throw new AppError(409, 'Configure the approved organisation name before previewing documents.');
    }
    const signatory = await getAuthorisedSignatory(configuration, type.typeCode);
    const payload = documentPayloadSchema.parse(input.payload);
    const pdf = await generateDocumentPdf(buildPdfInput({
      referenceCode: 'PREVIEW-ONLY',
      verificationUrl: null,
      typeName: type.displayName,
      typeCode: type.typeCode,
      recipientName: input.recipientName,
      subject: input.subject,
      payload,
      expiresAt: input.expiresAt,
      issueDate: new Date().toISOString(),
      configuration,
      organisation,
      signatory,
      preview: true,
    }));
    res.setHeader('Cache-Control', 'private, no-store');
    res.type('application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="humanitybridge-document-preview.pdf"');
    return res.send(pdf);
  }),
);

adminDocumentRoutes.post(
  '/drafts',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = draftSchema.parse(req.body);
    const record = await createDraft(input, req.user!);
    return res.status(201).json({
      success: true,
      message: 'Document draft saved.',
      data: record,
    });
  }),
);

adminDocumentRoutes.get(
  '/records',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const query = String(req.query.q || '').trim().slice(0, 100);
    const status = String(req.query.status || '').trim().toUpperCase();
    const typeId = Number(req.query.typeId) || 0;
    const search = query ? `%${query.replace(/[%_]/g, '\\$&')}%` : '';
    const conditions = [
      query
        ? or(
            like(schema.issuedDocuments.referenceCode, search),
            like(schema.issuedDocuments.recipientName, search),
            like(schema.issuedDocuments.subject, search),
          )
        : undefined,
      status ? eq(schema.issuedDocuments.status, status) : undefined,
      typeId ? eq(schema.issuedDocuments.documentTypeId, typeId) : undefined,
    ];
    const where = and(...conditions);
    const [rows, countRows] = await Promise.all([
      db.select({
        id: schema.issuedDocuments.id,
        referenceCode: schema.issuedDocuments.referenceCode,
        categoryId: schema.documentTypes.id,
        category: schema.documentTypes.displayName,
        status: schema.issuedDocuments.status,
        recipientName: schema.issuedDocuments.recipientName,
        subject: schema.issuedDocuments.subject,
        createdAt: schema.issuedDocuments.createdAt,
        issuedAt: schema.issuedDocuments.issuedAt,
        expiresAt: schema.issuedDocuments.expiresAt,
        createdBy: schema.issuedDocuments.createdBy,
      }).from(schema.issuedDocuments)
        .innerJoin(schema.documentTypes, eq(schema.issuedDocuments.documentTypeId, schema.documentTypes.id))
        .where(where)
        .orderBy(desc(schema.issuedDocuments.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      db.select({ count: sql<number>`count(*)` }).from(schema.issuedDocuments).where(where),
    ]);
    const total = Number(countRows[0]?.count || 0);
    return res.json({
      success: true,
      message: 'Document registry loaded.',
      data: rows,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  }),
);

adminDocumentRoutes.get(
  '/records/:id',
  asyncHandler(async (req, res) => {
    const id = referenceId(String(req.params.id));
    const [record] = await db.select({
      id: schema.issuedDocuments.id,
      referenceCode: schema.issuedDocuments.referenceCode,
      documentTypeId: schema.issuedDocuments.documentTypeId,
      category: schema.documentTypes.displayName,
      templateVersionId: schema.issuedDocuments.templateVersionId,
      status: schema.issuedDocuments.status,
      recipientName: schema.issuedDocuments.recipientName,
      subject: schema.issuedDocuments.subject,
      payloadJson: schema.issuedDocuments.payloadJson,
      organisationSnapshotJson: schema.issuedDocuments.organisationSnapshotJson,
      publicRecipientName: schema.issuedDocuments.publicRecipientName,
      pdfSha256: schema.issuedDocuments.pdfSha256,
      createdBy: schema.issuedDocuments.createdBy,
      approvedBy: schema.issuedDocuments.approvedBy,
      issuedBy: schema.issuedDocuments.issuedBy,
      createdAt: schema.issuedDocuments.createdAt,
      issuedAt: schema.issuedDocuments.issuedAt,
      expiresAt: schema.issuedDocuments.expiresAt,
      revokedAt: schema.issuedDocuments.revokedAt,
      archivedAt: schema.issuedDocuments.archivedAt,
    }).from(schema.issuedDocuments)
      .innerJoin(schema.documentTypes, eq(schema.issuedDocuments.documentTypeId, schema.documentTypes.id))
      .where(eq(schema.issuedDocuments.id, id)).limit(1);
    if (!record) throw new AppError(404, 'Document record not found.');
    return res.json({
      success: true,
      message: 'Document record loaded.',
      data: {
        ...record,
        payload: documentPayloadSchema.parse(JSON.parse(record.payloadJson)),
        organisationSnapshot: record.organisationSnapshotJson
          ? JSON.parse(record.organisationSnapshotJson) as Record<string, unknown>
          : null,
      },
    });
  }),
);

adminDocumentRoutes.get(
  '/records/:id/history',
  asyncHandler(async (req, res) => {
    const id = referenceId(String(req.params.id));
    const [history, verificationEvents] = await Promise.all([
      db.select({
        previousStatus: schema.documentStatusHistory.previousStatus,
        newStatus: schema.documentStatusHistory.newStatus,
        reason: schema.documentStatusHistory.reason,
        changedBy: schema.documentStatusHistory.changedBy,
        changedAt: schema.documentStatusHistory.changedAt,
      }).from(schema.documentStatusHistory)
        .where(eq(schema.documentStatusHistory.documentId, id))
        .orderBy(desc(schema.documentStatusHistory.changedAt)),
      db.select({
        verifiedAt: schema.documentVerificationEvents.verifiedAt,
      }).from(schema.documentVerificationEvents)
        .where(eq(schema.documentVerificationEvents.documentId, id))
        .orderBy(desc(schema.documentVerificationEvents.verifiedAt))
        .limit(100),
    ]);
    return res.json({
      success: true,
      message: 'Document status and verification history loaded.',
      data: { history, verificationEvents },
    });
  }),
);

adminDocumentRoutes.get(
  '/records/:id/download',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = referenceId(String(req.params.id));
    const [record] = await db.select({
      referenceCode: schema.issuedDocuments.referenceCode,
      status: schema.issuedDocuments.status,
      storageKey: schema.issuedDocuments.storageKey,
      pdfSha256: schema.issuedDocuments.pdfSha256,
    }).from(schema.issuedDocuments)
      .where(eq(schema.issuedDocuments.id, id)).limit(1);
    if (!record || !record.referenceCode) throw new AppError(404, 'Issued document not found.');
    if (!['ISSUED', 'REVOKED', 'ARCHIVED', 'EXPIRED'].includes(record.status)) {
      throw new AppError(409, 'This document is not available for download.');
    }
    if (!record.storageKey || !record.pdfSha256) throw new AppError(500, 'The saved document file is incomplete.');
    const pdf = await readPrivateDocument(record.storageKey);
    if (!pdf) throw new AppError(404, 'The private document file is missing from storage.');
    const actualDigest = Buffer.from(sha256Document(pdf), 'hex');
    const storedDigest = Buffer.from(record.pdfSha256, 'hex');
    if (actualDigest.length !== storedDigest.length || !crypto.timingSafeEqual(actualDigest, storedDigest)) {
      throw new AppError(500, 'Document integrity verification failed.');
    }
    await writeDocumentAudit({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'DOCUMENT_DOWNLOADED',
      resourceId: id,
      details: { referenceCode: record.referenceCode },
    });
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename="${record.referenceCode}.pdf"`);
    res.type('application/pdf');
    return res.send(pdf);
  }),
);

adminDocumentRoutes.post(
  '/records/:id/issue',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = referenceId(String(req.params.id));
    const [record] = await db.select().from(schema.issuedDocuments)
      .where(eq(schema.issuedDocuments.id, id)).limit(1);
    if (!record || record.status !== 'DRAFT') throw new AppError(409, 'Only a saved draft can be submitted for issuance.');
    const type = await getDocumentType(record.documentTypeId);
    if (type.requiresApproval) {
      const timestamp = nowUtc();
      await db.transaction(async (tx) => {
        const updated = await tx.update(schema.issuedDocuments).set({ status: 'PENDING_APPROVAL' })
          .where(and(
            eq(schema.issuedDocuments.id, id),
            eq(schema.issuedDocuments.status, 'DRAFT'),
          ));
        if (getAffectedRows(updated) === 0) {
          throw new AppError(409, 'This draft was submitted by another administrator.');
        }
        await appendHistory(tx, id, 'DRAFT', 'PENDING_APPROVAL', req.user!.id);
        await tx.insert(schema.auditLogs).values({
          actorUserId: req.user!.id,
          actorRole: req.user!.role,
          action: 'DOCUMENT_SUBMITTED_FOR_APPROVAL',
          resourceType: 'issued_document',
          resourceId: String(id),
          detailsJson: null,
          ipAddress: null,
          createdAt: timestamp,
        });
      });
      return res.status(202).json({
        success: true,
        message: 'Document submitted for independent approval.',
        data: { id, status: 'PENDING_APPROVAL' },
      });
    }
    const issued = await issueDocument(id, req.user!, 'DRAFT');
    return res.json({ success: true, message: 'Document issued and stored securely.', data: { id, ...issued } });
  }),
);

adminDocumentRoutes.post(
  '/records/:id/approve',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = referenceId(String(req.params.id));
    const result = await issueDocument(id, req.user!, 'PENDING_APPROVAL');
    return res.json({ success: true, message: 'Document approved, generated, and issued.', data: { id, ...result } });
  }),
);

adminDocumentRoutes.post(
  '/records/:id/revoke',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = referenceId(String(req.params.id));
    const reason = z.string().trim().min(10).max(500).parse(req.body?.reason);
    const [record] = await db.select().from(schema.issuedDocuments)
      .where(eq(schema.issuedDocuments.id, id)).limit(1);
    if (!record || record.status !== 'ISSUED') throw new AppError(409, 'Only an issued document can be revoked.');
    const timestamp = nowUtc();
    await db.transaction(async (tx) => {
      const updated = await tx.update(schema.issuedDocuments).set({ status: 'REVOKED', revokedAt: timestamp })
        .where(and(
          eq(schema.issuedDocuments.id, id),
          eq(schema.issuedDocuments.status, 'ISSUED'),
        ));
      if (getAffectedRows(updated) === 0) {
        throw new AppError(409, 'This document changed before it could be revoked.');
      }
      await appendHistory(tx, id, 'ISSUED', 'REVOKED', req.user!.id, reason);
      await tx.insert(schema.auditLogs).values({
        actorUserId: req.user!.id,
        actorRole: req.user!.role,
        action: 'DOCUMENT_REVOKED',
        resourceType: 'issued_document',
        resourceId: String(id),
        detailsJson: JSON.stringify({ reason }),
        ipAddress: null,
        createdAt: timestamp,
      });
    });
    return res.json({ success: true, message: 'Document revoked. Its public verification now reports the revoked status.', data: null });
  }),
);

adminDocumentRoutes.post(
  '/records/:id/archive',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = referenceId(String(req.params.id));
    const reason = z.string().trim().min(3).max(500).parse(req.body?.reason || 'Archived by authorised administrator.');
    const [record] = await db.select().from(schema.issuedDocuments)
      .where(eq(schema.issuedDocuments.id, id)).limit(1);
    if (!record || !['ISSUED', 'REVOKED', 'EXPIRED'].includes(record.status)) {
      throw new AppError(409, 'Only an issued, expired, or revoked document can be archived.');
    }
    const timestamp = nowUtc();
    await db.transaction(async (tx) => {
      const updated = await tx.update(schema.issuedDocuments).set({ status: 'ARCHIVED', archivedAt: timestamp })
        .where(and(
          eq(schema.issuedDocuments.id, id),
          or(
            eq(schema.issuedDocuments.status, 'ISSUED'),
            eq(schema.issuedDocuments.status, 'REVOKED'),
            eq(schema.issuedDocuments.status, 'EXPIRED'),
          ),
        ));
      if (getAffectedRows(updated) === 0) {
        throw new AppError(409, 'This document changed before it could be archived.');
      }
      await appendHistory(tx, id, record.status, 'ARCHIVED', req.user!.id, reason);
      await tx.insert(schema.auditLogs).values({
        actorUserId: req.user!.id,
        actorRole: req.user!.role,
        action: 'DOCUMENT_ARCHIVED',
        resourceType: 'issued_document',
        resourceId: String(id),
        detailsJson: JSON.stringify({ reason }),
        ipAddress: null,
        createdAt: timestamp,
      });
    });
    return res.json({ success: true, message: 'Document archived; the original PDF and audit history were retained.', data: null });
  }),
);

adminDocumentRoutes.post(
  '/records/:id/reissue',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = referenceId(String(req.params.id));
    const templateId = z.number().int().positive().parse(req.body?.templateId);
    const [record] = await db.select().from(schema.issuedDocuments)
      .where(eq(schema.issuedDocuments.id, id)).limit(1);
    if (!record || !['ISSUED', 'REVOKED', 'EXPIRED', 'ARCHIVED'].includes(record.status)) {
      throw new AppError(409, 'Only a previously issued document can be reissued.');
    }
    const type = await getDocumentType(record.documentTypeId);
    if (!type.isApproved) throw new AppError(400, 'This category is no longer approved for issuance.');
    const template = await getTemplate(templateId);
    if (template.template.documentTypeId !== type.id || !template.template.isActive) {
      throw new AppError(400, 'Choose an active template for the original document category.');
    }
    const originalPayload = documentPayloadSchema.parse(JSON.parse(record.payloadJson));
    const draft = await createDraft({
      documentTypeId: type.id,
      templateId,
      recipientName: record.recipientName,
      subject: record.subject,
      payload: originalPayload,
      expiresAt: null,
      publicRecipientName: record.publicRecipientName,
    }, req.user!);
    await writeDocumentAudit({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'DOCUMENT_REISSUE_DRAFT_CREATED',
      resourceId: id,
      details: { newDraftId: draft.id },
    });
    return res.status(201).json({ success: true, message: 'A new draft was created. Issuing it will generate a new permanent reference.', data: draft });
  }),
);

adminDocumentRoutes.get(
  '/audit',
  asyncHandler(async (_req, res) => {
    const auditRows = await db.select({
      action: schema.auditLogs.action,
      resourceId: schema.auditLogs.resourceId,
      detailsJson: schema.auditLogs.detailsJson,
      actorUserId: schema.auditLogs.actorUserId,
      actorRole: schema.auditLogs.actorRole,
      createdAt: schema.auditLogs.createdAt,
    }).from(schema.auditLogs)
      .where(or(
        eq(schema.auditLogs.resourceType, 'issued_document'),
        eq(schema.auditLogs.resourceType, 'document_category'),
        eq(schema.auditLogs.resourceType, 'document_template'),
        eq(schema.auditLogs.resourceType, 'document_signatory'),
        eq(schema.auditLogs.resourceType, 'organisation_profile'),
      ))
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(200);
    return res.json({ success: true, message: 'Document audit trail loaded.', data: auditRows });
  }),
);
