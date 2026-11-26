import 'dotenv/config';
import { and, eq, isNull } from 'drizzle-orm';
import { closeDb, db, nowUtc, schema } from '../src/db/index';
import { hashPasswordArgon2id } from '../src/server/utils/crypto';
import { DASHBOARD_ROLES } from '../packages/shared/types';

const ownerEmail = 'Admin@humanitybridge.org'.toLowerCase();

async function main() {
  const existingRows = await db
    .select()
    .from(schema.users)
    .where(isNull(schema.users.deletedAt));
  const existing = existingRows.find((user) => user.email.trim().toLowerCase() === ownerEmail);

  if (existing) {
    const ts = nowUtc();
    await db
      .update(schema.users)
      .set({
        email: ownerEmail,
        role: DASHBOARD_ROLES.PLATFORM_ADMIN,
        status: 'ACTIVE',
        emailVerified: true,
        updatedAt: ts,
      })
      .where(and(eq(schema.users.id, existing.id), isNull(schema.users.deletedAt)));

    const profileRows = await db
      .select()
      .from(schema.userProfiles)
      .where(eq(schema.userProfiles.userId, existing.id))
      .limit(1);
    if (!profileRows[0]) {
      await db.insert(schema.userProfiles).values({
        userId: existing.id,
        displayName: 'HumanityBridge Owner Administrator',
        region: 'Global Operations',
        organization: 'HumanityBridge',
        preferredLanguage: 'en',
        createdAt: ts,
        updatedAt: ts,
      });
    }

    console.log('Owner administrator account verified and normalised; existing password and history preserved.');
    return;
  }

  const initialPassword = process.env.OWNER_ADMIN_INITIAL_PASSWORD || process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!initialPassword) {
    throw new Error(
      'Owner administrator does not exist. Set OWNER_ADMIN_INITIAL_PASSWORD in a protected environment before running this setup.',
    );
  }
  if (initialPassword.length < 12) {
    throw new Error('Owner administrator initial password must contain at least 12 characters.');
  }

  const ts = nowUtc();
  await db.insert(schema.users).values({
    email: ownerEmail,
    passwordHash: hashPasswordArgon2id(initialPassword),
    role: DASHBOARD_ROLES.PLATFORM_ADMIN,
    status: 'ACTIVE',
    emailVerified: true,
    mfaEnabled: false,
    createdAt: ts,
    updatedAt: ts,
  });

  const createdRows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, ownerEmail))
    .limit(1);
  const created = createdRows[0];

  await db.insert(schema.userProfiles).values({
    userId: created.id,
    displayName: 'HumanityBridge Owner Administrator',
    region: 'Global Operations',
    organization: 'HumanityBridge',
    preferredLanguage: 'en',
    createdAt: ts,
    updatedAt: ts,
  });

  console.log('Owner administrator account created with normalised email and Argon2id password hashing.');
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Owner administrator configuration failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
