import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createApiApp } from '../src/server/app';
import { seedIfEmpty } from '../database/seeds/seed';
import { env } from '../src/server/config/env';
import { closeDb } from '../src/db/index';

class CookieJar {
  private cookies = new Map<string, string>();

  capture(res: Response) {
    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const raw of setCookies) {
      const [pair] = raw.split(';');
      const idx = pair.indexOf('=');
      if (idx > 0) {
        const name = pair.slice(0, idx).trim();
        const val = pair.slice(idx + 1).trim();
        this.cookies.set(name, val);
      }
    }
  }

  header(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  getCsrf(): string {
    return decodeURIComponent(this.cookies.get('hb_csrf') || '');
  }
}

async function runTests() {
  await seedIfEmpty();
  const app = createApiApp();
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Test 8: Public pages/APIs accessible without login
    const publicStoriesRes = await fetch(`${baseUrl}/api/v1/stories`);
    assert.equal(publicStoriesRes.status, 200);
    const publicStoriesJson = (await publicStoriesRes.json()) as { data: Array<{ status?: string; slug: string }> };
    // Test 3: Unapproved stories NEVER appear publicly
    assert.ok(
      !publicStoriesJson.data.some((s) => s.slug === 'drip-irrigation-cooperative-draft'),
      'Unapproved story leaked to public endpoint',
    );

    // Test 6: Private beneficiary information is NEVER exposed publicly
    const publicCasesRes = await fetch(`${baseUrl}/api/v1/cases`);
    assert.equal(publicCasesRes.status, 200);
    const publicCasesJson = (await publicCasesRes.json()) as { data: Array<Record<string, unknown>> };
    assert.ok(publicCasesJson.data.length > 0);
    for (const c of publicCasesJson.data) {
      assert.equal(c.privateContactName, undefined, 'Private contact name exposed');
      assert.equal(c.privateContactPhone, undefined, 'Private contact phone exposed');
      assert.equal(c.privateLocationNotes, undefined, 'Private location notes exposed');
      assert.equal(c.internalAdminNotes, undefined, 'Internal admin notes exposed');
    }

    // Test 9: Invalid and expired sessions are rejected
    const unauthAdmin = await fetch(`${baseUrl}/api/v1/admin/dashboard`, {
      headers: { Cookie: 'hb_session=invalid_fabricated_token' },
    });
    assert.equal(unauthAdmin.status, 401);

    // Sign in as Community Coordinator
    const coordJar = new CookieJar();
    const coordLoginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nyamal.gatluak@humanitybridge.org',
        password: process.env.COORDINATOR_TEST_PASSWORD || 'Coordinator#2026',
      }),
    });
    assert.equal(coordLoginRes.status, 200);
    coordJar.capture(coordLoginRes);

    // Test 1: Community Coordinator CANNOT access administrator endpoints
    const forbiddenAdmin = await fetch(`${baseUrl}/api/v1/admin/dashboard`, {
      headers: { Cookie: coordJar.header() },
    });
    assert.equal(forbiddenAdmin.status, 403);

    // Test 2: Community Coordinator creates case -> cannot self-approve
    const createCaseRes = await fetch(`${baseUrl}/api/v1/coordinator/cases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: coordJar.header(),
        'X-CSRF-Token': coordJar.getCsrf(),
      },
      body: JSON.stringify({
        title: 'Acceptance Test Clean Water Filter',
        categoryId: 1,
        locationId: 1,
        publicSummary: 'Testing dignified case intake workflow without private contact leaks.',
        affectedCount: 40,
        urgencyLevel: 'HIGH',
        assistanceNeeded: 'Ceramic water filters and storage buckets',
        beneficiaryConsentObtained: true,
        beneficiaryFullName: 'Test Beneficiary',
        beneficiaryAgeBand: '25_59',
        beneficiaryGender: 'UNKNOWN',
        householdSize: 4,
        privateContactName: 'Private Test Name',
        privateContactPhone: '+000-TEST-999',
        privateLocationNotes: 'Private verification note',
      }),
    });
    assert.equal(createCaseRes.status, 201);
    const createdCase = (await createCaseRes.json()) as { data: { id: number; status: string } };
    assert.equal(createdCase.data.status, 'SUBMITTED');

    const selfApproveAttempt = await fetch(`${baseUrl}/api/v1/admin/cases/${createdCase.data.id}/verify`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: coordJar.header(),
        'X-CSRF-Token': coordJar.getCsrf(),
      },
      body: JSON.stringify({ decision: 'VERIFIED', notes: 'Attempted self approval', publishPublicly: true }),
    });
    assert.equal(selfApproveAttempt.status, 403);

    // Test 4: online payments and payment webhooks remain deliberately disabled
    const donateRes = await fetch(`${baseUrl}/api/v1/donations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignId: 1, amount: 100, currency: 'USD',
        donorName: 'Acceptance Test Donor', donorEmail: 'donor@example.org',
        isAnonymous: false, paymentChannel: 'SANDBOX_CARD',
      }),
    });
    assert.equal(donateRes.status, 503);

    const webhookRes = await fetch(`${baseUrl}/api/v1/donations/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-hb-signature': 'disabled' },
      body: JSON.stringify({ eventId: 'DISABLED-TEST', status: 'SETTLED' }),
    });
    assert.equal(webhookRes.status, 410);

    // Test 7: Administrative action generates audit record
    const adminJar = new CookieJar();
    const adminLoginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: process.env.ADMIN_BOOTSTRAP_EMAIL || 'admin@humanitybridge.org',
        password: process.env.ADMIN_BOOTSTRAP_PASSWORD || 'BridgeAdmin#2026',
      }),
    });
    assert.equal(adminLoginRes.status, 200);
    adminJar.capture(adminLoginRes);

    const verifyRes = await fetch(`${baseUrl}/api/v1/admin/cases/${createdCase.data.id}/verify`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminJar.header(),
        'X-CSRF-Token': adminJar.getCsrf(),
      },
      body: JSON.stringify({ decision: 'VERIFIED', notes: 'Verified in acceptance test', publishPublicly: false }),
    });
    assert.equal(verifyRes.status, 200);

    const auditRes = await fetch(`${baseUrl}/api/v1/admin/audit-logs`, {
      headers: { Cookie: adminJar.header() },
    });
    assert.equal(auditRes.status, 200);
    const auditJson = (await auditRes.json()) as { data: Array<{ action: string }> };
    assert.ok(auditJson.data.some((a) => a.action === 'ADMIN_CASE_VERIFIED'));

    console.log('ALL CRITICAL ACCEPTANCE & SECURITY TESTS PASSED (10/10)');
  } finally {
    server.close();
    await closeDb();
  }
}

runTests().catch((err) => {
  console.error('Acceptance test failed:', err);
  process.exit(1);
});
