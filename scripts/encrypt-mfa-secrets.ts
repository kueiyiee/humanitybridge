import { eq } from 'drizzle-orm';
import { db, schema } from '../src/db/index';
import { encryptMfaSecret } from '../src/server/utils/crypto';

/**
 * One-time pre-deployment migration for existing plaintext TOTP secrets.
 * Run with the same database and MFA_ENCRYPTION_KEY that the application
 * will use. Back up the database before running this command.
 */
async function main() {
  if (!process.env.MFA_ENCRYPTION_KEY) {
    throw new Error('MFA_ENCRYPTION_KEY is required.');
  }

  const rows = await db.select().from(schema.mfaSettings);
  let migrated = 0;

  for (const row of rows) {
    if (row.totpSecret.startsWith('v1:')) continue;

    await db.update(schema.mfaSettings)
      .set({ totpSecret: encryptMfaSecret(row.totpSecret) })
      .where(eq(schema.mfaSettings.id, row.id));
    migrated += 1;
  }

  console.info(`Encrypted ${migrated} existing MFA secret(s).`);
}

main().catch((error) => {
  console.error('MFA secret migration failed:', error);
  process.exitCode = 1;
});
