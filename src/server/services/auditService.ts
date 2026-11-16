import { db, schema, nowUtc } from '../../db/index';

export interface AuditEntryInput {
  actorUserId?: number | null;
  actorRole?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | number | null;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
}

export async function writeAuditLog(entry: AuditEntryInput) {
  await db.insert(schema.auditLogs).values({
    actorUserId: entry.actorUserId ?? null,
    actorRole: entry.actorRole ?? null,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId !== undefined && entry.resourceId !== null ? String(entry.resourceId) : null,
    detailsJson: entry.details ? JSON.stringify(entry.details) : null,
    ipAddress: entry.ipAddress ?? null,
    createdAt: nowUtc(),
  });
}

export async function createNotification(input: {
  userId: number;
  eventType: string;
  title: string;
  message: string;
}) {
  await db.insert(schema.notifications).values({
    userId: input.userId,
    eventType: input.eventType,
    title: input.title,
    message: input.message,
    isRead: false,
    createdAt: nowUtc(),
  });
}
