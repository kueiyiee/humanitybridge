import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { closeDb, db, schema, nowUtc } from '../src/db/index';
import {
  decryptMfaSecret,
  encryptMfaSecret,
  generateTotpSecret,
  MfaSecretAuthenticationError,
} from '../src/server/utils/crypto';

function getUserId(): number {
  const index = process.argv.indexOf('--user-id');
  const rawUserId = index >= 0 ? process.argv[index + 1] : '';
  const userId = Number(rawUserId);
  if (!Number.isSafeInteger(userId) || userId < 1) {
    throw new Error('Provide a valid --user-id.');
  }
  if (!process.argv.includes('--confirm')) {
    throw new Error('Refusing to reset MFA without the --confirm flag.');
  }
  return userId;
}

async function main() {
  const userId = getUserId();
  const rows = await db.select({
    id: schema.mfaSettings.id,
    totpSecret: schema.mfaSettings.totpSecret,
    enabled: schema.mfaSettings.enabled,
  }).from(schema.mfaSettings)
    .where(eq(schema.mfaSettings.userId, userId))
    .limit(1);
  const mfa = rows[0];
  if (!mfa?.enabled) {
    throw new Error('The selected user does not have enabled MFA; refusing to reset.');
  }

  try {
    decryptMfaSecret(mfa.totpSecret);
    throw new Error('The selected MFA secret is decryptable; refusing to reset.');
  } catch (error) {
    if (!(error instanceof MfaSecretAuthenticationError)) throw error;
  }

  const ts = nowUtc();
  await db.transaction(async (tx) => {
    await tx.update(schema.mfaSettings)
      .set({ totpSecret: encryptMfaSecret(generateTotpSecret()), enabled: false, updatedAt: ts })
      .where(eq(schema.mfaSettings.id, mfa.id));
    await tx.update(schema.users)
      .set({ mfaEnabled: false, updatedAt: ts })
      .where(eq(schema.users.id, userId));
    await tx.update(schema.userSessions)
      .set({ revokedAt: ts })
      .where(eq(schema.userSessions.userId, userId));
    await tx.insert(schema.auditLogs).values({
      actorUserId: null,
      actorRole: 'SYSTEM',
      action: 'AUTH_MFA_RECOVERY_RESET',
      resourceType: 'user',
      resourceId: String(userId),
      detailsJson: JSON.stringify({ reason: 'MFA encryption key unavailable; re-enrollment required' }),
      ipAddress: null,
      createdAt: ts,
    });
  });

  console.info(`Reset MFA for user ID ${userId}. They must enroll MFA again after signing in.`);
}

main().catch((error) => {
  console.error('MFA recovery reset failed:', error);
  process.exitCode = 1;
}).finally(closeDb);
