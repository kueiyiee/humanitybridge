import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createApiApp } from '../src/server/app';
import { seedIfEmpty } from '../database/seeds/seed';
import { env } from '../src/server/config/env';
import { closeDb } from '../src/db/index';
import { db, schema } from '../src/db/index';
import { eq } from 'drizzle-orm';
import { invalidateImpactSummaryCache } from '../src/server/services/impactReporting';

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
    // Public coordinator registration is retired and must not create an account
    const publicRegisterRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'unauthorised-registration@example.org',
        password: 'Unauthorised#2026',
        displayName: 'Unauthorised Registration',
        region: 'Synthetic Region',
        organization: 'Synthetic Organisation',
        motivation: 'This request must be rejected.',
      }),
    });
    assert.equal(publicRegisterRes.status, 410);

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

    const impactRes = await fetch(`${baseUrl}/api/v1/public/impact/summary?period=12m`);
    assert.equal(impactRes.status, 200);
    assert.match(impactRes.headers.get('cache-control') || '', /s-maxage=15/);
    const impactJson = (await impactRes.json()) as {
      data: {
        reportingStatus: string;
        verifiedPublicCases: number;
        reportedPeopleAcrossCases: number;
        uniqueBeneficiaries: null;
        activeCampaigns: number;
        countriesCoveredCount: number;
        regionalImpact: Array<{ country: string }>;
        financialSummary: { confirmedDonationCount: number; confirmedDonationsUsd: number };
        trendSeries: Array<{ period: string }>;
      };
    };
    assert.equal(impactJson.data.reportingStatus, 'AVAILABLE');
    assert.equal(impactJson.data.verifiedPublicCases, 3, 'Only consent-cleared, verified public cases are reported');
    assert.equal(impactJson.data.reportedPeopleAcrossCases, 3140);
    assert.equal(impactJson.data.uniqueBeneficiaries, null, 'Beneficiaries are not deduplicated without a stable privacy-safe identifier');
    assert.equal(impactJson.data.activeCampaigns, 2, 'Only active campaign records contribute');
    assert.equal(impactJson.data.countriesCoveredCount, 0, 'Country groups below the distinct-case threshold are suppressed');
    assert.deepEqual(impactJson.data.regionalImpact, []);
    assert.equal(impactJson.data.financialSummary.confirmedDonationCount, 4);
    assert.equal(impactJson.data.financialSummary.confirmedDonationsUsd, 73150);
    assert.ok(impactJson.data.trendSeries.length > 0, 'Historical chart data must come from persisted timestamps');
    assert.ok(
      !JSON.stringify(impactJson.data).match(/Confidential beneficiary|privateContact|beneficiaryFullName|donorEmail|internalAdminNotes/i),
      'Impact summaries must not expose identifying or internal data',
    );
    const invalidImpactPeriod = await fetch(`${baseUrl}/api/v1/public/impact/summary?period=unsupported`);
    assert.equal(invalidImpactPeriod.status, 400);
    const compatibleImpactRes = await fetch(`${baseUrl}/api/v1/impact?period=12m`);
    assert.equal(compatibleImpactRes.status, 200, 'The previous public impact path remains compatible');

    // Test 9: Invalid and expired sessions are rejected
    const unauthAdmin = await fetch(`${baseUrl}/api/v1/admin/dashboard`, {
      headers: { Cookie: 'hb_session=invalid_fabricated_token' },
    });
    assert.equal(unauthAdmin.status, 401);
    const unauthenticatedDocuments = await fetch(`${baseUrl}/api/v1/admin/documents/overview`);
    assert.equal(unauthenticatedDocuments.status, 401);
    const unknownDocument = await fetch(`${baseUrl}/api/v1/public/documents/verify/HB-UNKNOWN-2026-000001`);
    assert.equal(unknownDocument.status, 200);
    const unknownDocumentJson = (await unknownDocument.json()) as { data: Record<string, unknown> };
    assert.equal(unknownDocumentJson.data.status, 'NOT_FOUND');
    assert.equal(unknownDocumentJson.data.recipientName, undefined);

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
    assert.equal((await fetch(`${baseUrl}/api/v1/admin/documents/overview`, {
      headers: { Cookie: coordJar.header() },
    })).status, 403, 'Community Coordinators must not manage official documents');

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

    const editorHeaders = {
      'Content-Type': 'application/json',
      Cookie: adminJar.header(),
      'X-CSRF-Token': adminJar.getCsrf(),
    };
    const blankEditorDraftResponse = await fetch(`${baseUrl}/api/v1/admin/documents/editor/drafts`, {
      method: 'POST',
      headers: editorHeaders,
      body: JSON.stringify({
        title: 'Untitled document',
        content: { type: 'doc', content: [{ type: 'paragraph' }] },
        pageSettings: { orientation: 'PORTRAIT', marginTop: 22, marginRight: 20, marginBottom: 22, marginLeft: 20 },
      }),
    });
    assert.equal(blankEditorDraftResponse.status, 201);
    const blankEditorDraft = (await blankEditorDraftResponse.json()) as {
      data: { id: number; content: { content: Array<{ type: string }> } };
    };
    assert.equal(blankEditorDraft.data.content.content[0].type, 'paragraph');

    const editedContent = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Independent heading' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Freely authored text.' }] },
      ],
    };
    const editorUpdateResponse = await fetch(`${baseUrl}/api/v1/admin/documents/editor/drafts/${blankEditorDraft.data.id}`, {
      method: 'PUT',
      headers: editorHeaders,
      body: JSON.stringify({
        title: 'Flexible draft',
        content: editedContent,
        pageSettings: { orientation: 'LANDSCAPE', marginTop: 18, marginRight: 18, marginBottom: 18, marginLeft: 18 },
      }),
    });
    assert.equal(editorUpdateResponse.status, 200);
    const editorReloadResponse = await fetch(`${baseUrl}/api/v1/admin/documents/editor/drafts/${blankEditorDraft.data.id}`, {
      headers: { Cookie: adminJar.header() },
    });
    assert.equal(editorReloadResponse.status, 200);
    const editorReload = (await editorReloadResponse.json()) as {
      data: { title: string; content: typeof editedContent; pageSettings: { orientation: string } };
    };
    assert.equal(editorReload.data.title, 'Flexible draft');
    assert.deepEqual(editorReload.data.content, editedContent);
    assert.equal(editorReload.data.pageSettings.orientation, 'LANDSCAPE');

    const editorDuplicateResponse = await fetch(`${baseUrl}/api/v1/admin/documents/editor/drafts/${blankEditorDraft.data.id}/duplicate`, {
      method: 'POST',
      headers: editorHeaders,
    });
    assert.equal(editorDuplicateResponse.status, 201);
    const editorDuplicate = (await editorDuplicateResponse.json()) as { data: { id: number } };
    for (const id of [blankEditorDraft.data.id, editorDuplicate.data.id]) {
      const deleteEditorDraftResponse = await fetch(`${baseUrl}/api/v1/admin/documents/editor/drafts/${id}`, {
        method: 'DELETE',
        headers: editorHeaders,
      });
      assert.equal(deleteEditorDraftResponse.status, 200);
    }

    const documentTypeResponse = await fetch(`${baseUrl}/api/v1/admin/documents/types`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminJar.header(),
        'X-CSRF-Token': adminJar.getCsrf(),
      },
      body: JSON.stringify({
        typeCode: 'ACCEPTANCE_CERTIFICATE',
        displayName: 'Acceptance Certificate',
        referencePrefix: 'ATCERT',
        requiresApproval: false,
        isApproved: false,
        publicVerification: false,
        publicRecipient: false,
      }),
    });
    assert.equal(documentTypeResponse.status, 201);
    const documentType = (await documentTypeResponse.json()) as { data: { id: number } };
    const approveDocumentType = await fetch(`${baseUrl}/api/v1/admin/documents/types/${documentType.data.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminJar.header(),
        'X-CSRF-Token': adminJar.getCsrf(),
      },
      body: JSON.stringify({ isApproved: true, requiresApproval: false, publicVerification: true }),
    });
    assert.equal(approveDocumentType.status, 200);

    const organisationResponse = await fetch(`${baseUrl}/api/v1/admin/documents/organisation`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminJar.header(),
        'X-CSRF-Token': adminJar.getCsrf(),
      },
      body: JSON.stringify({
        officialName: 'Acceptance Test Organisation',
        registeredAddress: null,
        country: 'Test Country',
        telephone: null,
        email: null,
        website: null,
        registrationInformation: null,
        approvedTagline: null,
        issuingDepartment: null,
        footerDisclaimer: null,
      }),
    });
    assert.equal(organisationResponse.status, 200);

    const documentTemplateResponse = await fetch(`${baseUrl}/api/v1/admin/documents/templates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminJar.header(),
        'X-CSRF-Token': adminJar.getCsrf(),
      },
      body: JSON.stringify({
        documentTypeId: documentType.data.id,
        name: 'Acceptance Certificate Template',
        isActive: true,
        configuration: {
          pageSize: 'A4',
          orientation: 'PORTRAIT',
          title: 'Acceptance Certificate',
          introduction: '',
          footerText: '',
          signatoryId: null,
          includeBarcode: true,
        },
      }),
    });
    assert.equal(documentTemplateResponse.status, 201);
    const documentTemplatesResponse = await fetch(`${baseUrl}/api/v1/admin/documents/templates`, {
      headers: { Cookie: adminJar.header() },
    });
    assert.equal(documentTemplatesResponse.status, 200);
    const documentTemplates = (await documentTemplatesResponse.json()) as {
      data: Array<{ id: number; documentTypeId: number }>;
    };
    const documentTemplate = documentTemplates.data.find((item) => item.documentTypeId === documentType.data.id);
    assert.ok(documentTemplate);

    const unsignedDraftResponse = await fetch(`${baseUrl}/api/v1/admin/documents/drafts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminJar.header(),
        'X-CSRF-Token': adminJar.getCsrf(),
      },
      body: JSON.stringify({
        documentTypeId: documentType.data.id,
        templateId: documentTemplate.id,
        recipientName: 'Private Unsigned Recipient',
        subject: 'Unsigned document rejection test',
        payload: { purpose: 'Issuance must remain blocked without a configured authorised signatory.' },
      }),
    });
    assert.equal(unsignedDraftResponse.status, 201);
    const unsignedDraft = (await unsignedDraftResponse.json()) as { data: { id: number } };
    const unsignedIssueResponse = await fetch(`${baseUrl}/api/v1/admin/documents/records/${unsignedDraft.data.id}/issue`, {
      method: 'POST',
      headers: { Cookie: adminJar.header(), 'X-CSRF-Token': adminJar.getCsrf() },
    });
    assert.equal(unsignedIssueResponse.status, 409, 'A draft without an authorised template signatory must not be issued');

    const signatoryResponse = await fetch(`${baseUrl}/api/v1/admin/documents/signatories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminJar.header(),
        'X-CSRF-Token': adminJar.getCsrf(),
      },
      body: JSON.stringify({
        fullName: 'Acceptance Test Signatory',
        position: 'Authorised Acceptance Tester',
        department: 'Acceptance Tests',
        authorisedTypeCodes: ['ACCEPTANCE_CERTIFICATE'],
        isAuthorised: true,
      }),
    });
    assert.equal(signatoryResponse.status, 201);
    const signatoriesResponse = await fetch(`${baseUrl}/api/v1/admin/documents/signatories`, {
      headers: { Cookie: adminJar.header() },
    });
    const signatories = (await signatoriesResponse.json()) as {
      data: Array<{ id: number; fullName: string; authorisedTypeCodes: string[] }>;
    };
    const testSignatory = signatories.data.find((item) => item.fullName === 'Acceptance Test Signatory');
    assert.ok(testSignatory);

    const signedTemplateResponse = await fetch(`${baseUrl}/api/v1/admin/documents/templates/${documentTemplate.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminJar.header(),
        'X-CSRF-Token': adminJar.getCsrf(),
      },
      body: JSON.stringify({
        name: 'Acceptance Certificate Template',
        isActive: true,
        configuration: {
          pageSize: 'A4',
          orientation: 'PORTRAIT',
          title: 'Acceptance Certificate',
          introduction: '',
          footerText: '',
          signatoryId: testSignatory.id,
          includeBarcode: true,
        },
      }),
    });
    assert.equal(signedTemplateResponse.status, 200);

    const documentDraftResponse = await fetch(`${baseUrl}/api/v1/admin/documents/drafts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminJar.header(),
        'X-CSRF-Token': adminJar.getCsrf(),
      },
      body: JSON.stringify({
        documentTypeId: documentType.data.id,
        templateId: documentTemplate.id,
        recipientName: 'Private Acceptance Recipient',
        subject: 'Acceptance workflow certificate',
        payload: { purpose: 'Validate the private document issuance and public verification workflow.' },
        expiresAt: null,
        publicRecipientName: null,
      }),
    });
    assert.equal(documentDraftResponse.status, 201);
    const documentDraft = (await documentDraftResponse.json()) as { data: { id: number } };
    const issuedDocumentResponse = await fetch(`${baseUrl}/api/v1/admin/documents/records/${documentDraft.data.id}/issue`, {
      method: 'POST',
      headers: { Cookie: adminJar.header(), 'X-CSRF-Token': adminJar.getCsrf() },
    });
    assert.equal(issuedDocumentResponse.status, 200);
    const issuedDocument = (await issuedDocumentResponse.json()) as { data: { referenceCode: string; status: string } };
    assert.equal(issuedDocument.data.status, 'ISSUED');

    const publicVerificationResponse = await fetch(
      `${baseUrl}/api/v1/public/documents/verify/${encodeURIComponent(issuedDocument.data.referenceCode)}`,
    );
    assert.equal(publicVerificationResponse.status, 200);
    const publicVerification = (await publicVerificationResponse.json()) as { data: Record<string, unknown> };
    assert.equal(publicVerification.data.status, 'VALID');
    assert.equal(publicVerification.data.recipientName, null, 'Public verification must not disclose a recipient unless separately enabled');
    assert.equal(publicVerification.data.privateContactPhone, undefined);
    assert.equal(publicVerification.data.payload, undefined);

    const privateDocumentDownload = await fetch(`${baseUrl}/api/v1/admin/documents/records/${documentDraft.data.id}/download`, {
      headers: { Cookie: adminJar.header() },
    });
    assert.equal(privateDocumentDownload.status, 200);
    assert.match(privateDocumentDownload.headers.get('content-type') || '', /application\/pdf/);
    assert.match(Buffer.from(await privateDocumentDownload.arrayBuffer()).toString('ascii', 0, 5), /%PDF-/);

    const documentRevocation = await fetch(`${baseUrl}/api/v1/admin/documents/records/${documentDraft.data.id}/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminJar.header(),
        'X-CSRF-Token': adminJar.getCsrf(),
      },
      body: JSON.stringify({ reason: 'Acceptance test revocation for the document lifecycle.' }),
    });
    assert.equal(documentRevocation.status, 200);
    const revokedVerification = await fetch(
      `${baseUrl}/api/v1/public/documents/verify/${encodeURIComponent(issuedDocument.data.referenceCode)}`,
    );
    const revokedVerificationJson = (await revokedVerification.json()) as { data: { status: string } };
    assert.equal(revokedVerificationJson.data.status, 'REVOKED');

    const reviewTypeResponse = await fetch(`${baseUrl}/api/v1/admin/documents/types`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminJar.header(),
        'X-CSRF-Token': adminJar.getCsrf(),
      },
      body: JSON.stringify({
        typeCode: 'ACCEPTANCE_REVIEW',
        displayName: 'Acceptance Review Document',
        referencePrefix: 'ATREVIEW',
        isApproved: true,
        requiresApproval: true,
        publicVerification: false,
        publicRecipient: false,
      }),
    });
    assert.equal(reviewTypeResponse.status, 201);
    const reviewType = (await reviewTypeResponse.json()) as { data: { id: number } };
    const extendSignatoryResponse = await fetch(`${baseUrl}/api/v1/admin/documents/signatories/${testSignatory.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminJar.header(),
        'X-CSRF-Token': adminJar.getCsrf(),
      },
      body: JSON.stringify({ authorisedTypeCodes: ['ACCEPTANCE_CERTIFICATE', 'ACCEPTANCE_REVIEW'] }),
    });
    assert.equal(extendSignatoryResponse.status, 200);
    const reviewTemplateResponse = await fetch(`${baseUrl}/api/v1/admin/documents/templates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminJar.header(),
        'X-CSRF-Token': adminJar.getCsrf(),
      },
      body: JSON.stringify({
        documentTypeId: reviewType.data.id,
        name: 'Acceptance Review Template',
        isActive: true,
        configuration: {
          pageSize: 'A4',
          orientation: 'PORTRAIT',
          title: '',
          introduction: '',
          footerText: '',
          signatoryId: testSignatory.id,
          includeBarcode: false,
        },
      }),
    });
    assert.equal(reviewTemplateResponse.status, 201);
    const reviewTemplatesResponse = await fetch(`${baseUrl}/api/v1/admin/documents/templates`, {
      headers: { Cookie: adminJar.header() },
    });
    const reviewTemplates = (await reviewTemplatesResponse.json()) as { data: Array<{ id: number; documentTypeId: number }> };
    const reviewTemplate = reviewTemplates.data.find((item) => item.documentTypeId === reviewType.data.id);
    assert.ok(reviewTemplate);
    const reviewDraftResponse = await fetch(`${baseUrl}/api/v1/admin/documents/drafts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminJar.header(),
        'X-CSRF-Token': adminJar.getCsrf(),
      },
      body: JSON.stringify({
        documentTypeId: reviewType.data.id,
        templateId: reviewTemplate.id,
        recipientName: 'Private Review Recipient',
        subject: 'Independent approval acceptance test',
        payload: { purpose: 'Verify maker-checker approval enforcement.' },
      }),
    });
    assert.equal(reviewDraftResponse.status, 201);
    const reviewDraft = (await reviewDraftResponse.json()) as { data: { id: number } };
    const submitForApproval = await fetch(`${baseUrl}/api/v1/admin/documents/records/${reviewDraft.data.id}/issue`, {
      method: 'POST',
      headers: { Cookie: adminJar.header(), 'X-CSRF-Token': adminJar.getCsrf() },
    });
    assert.equal(submitForApproval.status, 202);
    const selfApproveDocument = await fetch(`${baseUrl}/api/v1/admin/documents/records/${reviewDraft.data.id}/approve`, {
      method: 'POST',
      headers: { Cookie: adminJar.header(), 'X-CSRF-Token': adminJar.getCsrf() },
    });
    assert.equal(selfApproveDocument.status, 403, 'The document creator must not approve their own issuance');

    const seededCasesRes = await fetch(`${baseUrl}/api/v1/admin/cases`, {
      headers: { Cookie: adminJar.header() },
    });
    assert.equal(seededCasesRes.status, 200);
    const seededCases = (await seededCasesRes.json()) as {
      data: Array<{ id: number; regionName: string; beneficiaryFullName: string | null }>;
    };
    const targetCase = seededCases.data.find((item) => item.id === createdCase.data.id);
    assert.ok(targetCase, 'The newly submitted case should be available to the platform administrator');

    const createOperationalAccount = async (role: string, region: string) => {
      const email = `${role.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.org`;
      const response = await fetch(`${baseUrl}/api/v1/admin/users/staff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminJar.header(),
          'X-CSRF-Token': adminJar.getCsrf(),
        },
        body: JSON.stringify({
          email,
          displayName: `Acceptance ${role}`,
          region,
          organization: 'Acceptance Test',
          password: 'RoleTest#2026',
          role,
        }),
      });
      assert.equal(response.status, 201);
      return { email, password: 'RoleTest#2026' };
    };
    const signInOperationalAccount = async (email: string, password: string) => {
      const jar = new CookieJar();
      const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      assert.equal(response.status, 200);
      jar.capture(response);
      return jar;
    };

    const caseOfficerCredentials = await createOperationalAccount('CASE_VERIFICATION_OFFICER', targetCase.regionName);
    const caseOfficerJar = await signInOperationalAccount(caseOfficerCredentials.email, caseOfficerCredentials.password);
    const officerCasesRes = await fetch(`${baseUrl}/api/v1/admin/cases`, {
      headers: { Cookie: caseOfficerJar.header() },
    });
    assert.equal(officerCasesRes.status, 200);
    const officerCases = (await officerCasesRes.json()) as {
      data: Array<{ id: number; regionName: string; beneficiaryFullName: string | null; privateContactPhone: string | null }>;
    };
    assert.ok(officerCases.data.some((item) => item.id === createdCase.data.id));
    assert.ok(officerCases.data.every((item) => item.regionName === targetCase.regionName));
    assert.ok(officerCases.data.find((item) => item.id === createdCase.data.id)?.beneficiaryFullName);
    assert.equal((await fetch(`${baseUrl}/api/v1/admin/users`, {
      headers: { Cookie: caseOfficerJar.header() },
    })).status, 403, 'Case Verification Officers must not access user administration');

    const regionalCredentials = await createOperationalAccount('REGIONAL_COORDINATOR', targetCase.regionName);
    const regionalJar = await signInOperationalAccount(regionalCredentials.email, regionalCredentials.password);
    const regionalCasesRes = await fetch(`${baseUrl}/api/v1/admin/cases`, {
      headers: { Cookie: regionalJar.header() },
    });
    assert.equal(regionalCasesRes.status, 200);
    const regionalCases = (await regionalCasesRes.json()) as {
      data: Array<{
        id: number;
        regionName: string;
        beneficiaryFullName: string | null;
        privateContactPhone: string | null;
        documents: Array<unknown>;
      }>;
    };
    assert.ok(regionalCases.data.every((item) => item.regionName === targetCase.regionName));
    const regionalViewOfCase = regionalCases.data.find((item) => item.id === createdCase.data.id);
    assert.equal(regionalViewOfCase?.beneficiaryFullName, null);
    assert.equal(regionalViewOfCase?.privateContactPhone, null);
    assert.deepEqual(regionalViewOfCase?.documents, []);

    const outsideRegionCredentials = await createOperationalAccount('CASE_VERIFICATION_OFFICER', 'Acceptance Test Region');
    const outsideRegionJar = await signInOperationalAccount(outsideRegionCredentials.email, outsideRegionCredentials.password);
    const outsideCasesRes = await fetch(`${baseUrl}/api/v1/admin/cases`, {
      headers: { Cookie: outsideRegionJar.header() },
    });
    assert.equal(outsideCasesRes.status, 200);
    const outsideCases = (await outsideCasesRes.json()) as { data: Array<{ id: number }> };
    assert.ok(!outsideCases.data.some((item) => item.id === createdCase.data.id));
    const outsideVerifyRes = await fetch(`${baseUrl}/api/v1/admin/cases/${createdCase.data.id}/verify`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: outsideRegionJar.header(),
        'X-CSRF-Token': outsideRegionJar.getCsrf(),
      },
      body: JSON.stringify({ decision: 'UNDER_REVIEW', notes: 'Out-of-region access test' }),
    });
    assert.equal(outsideVerifyRes.status, 403, 'Case Verification Officers must be restricted to their region');

    const auditorCredentials = await createOperationalAccount('READ_ONLY_AUDITOR', 'Global');
    const auditorJar = await signInOperationalAccount(auditorCredentials.email, auditorCredentials.password);
    assert.equal((await fetch(`${baseUrl}/api/v1/admin/audit-logs`, {
      headers: { Cookie: auditorJar.header() },
    })).status, 200);
    assert.equal((await fetch(`${baseUrl}/api/v1/admin/users`, {
      headers: { Cookie: auditorJar.header() },
    })).status, 403, 'Read-only auditors must not access user PII');
    const auditorDashboardRes = await fetch(`${baseUrl}/api/v1/admin/dashboard`, {
      headers: { Cookie: auditorJar.header() },
    });
    assert.equal(auditorDashboardRes.status, 200);
    const auditorDashboard = (await auditorDashboardRes.json()) as {
      data: {
        systemHealth: unknown;
        metrics: {
          totalUsers: number;
          confirmedDonationsUsd: number;
          openSafeguardingAlerts: number;
        };
      };
    };
    assert.equal(auditorDashboard.data.systemHealth, null);
    assert.equal(auditorDashboard.data.metrics.totalUsers, 0);
    assert.equal(auditorDashboard.data.metrics.confirmedDonationsUsd, 0);
    assert.equal(auditorDashboard.data.metrics.openSafeguardingAlerts, 0);

    const adminUsersRes = await fetch(`${baseUrl}/api/v1/admin/users`, {
      headers: { Cookie: adminJar.header() },
    });
    assert.equal(adminUsersRes.status, 200);
    const adminUsers = (await adminUsersRes.json()) as {
      data: Array<{ id: number; email: string; role: string; status: string }>;
    };
    const alternateCoordinator = adminUsers.data.find((user) =>
      user.role === 'COMMUNITY_COORDINATOR' && user.status === 'ACTIVE' &&
      user.email !== 'nyamal.gatluak@humanitybridge.org',
    );
    assert.ok(alternateCoordinator, 'Seed data should contain another active coordinator');
    const primaryCoordinator = adminUsers.data.find((user) =>
      user.role === 'COMMUNITY_COORDINATOR' && user.status === 'ACTIVE' &&
      user.email === 'nyamal.gatluak@humanitybridge.org',
    );
    assert.ok(primaryCoordinator, 'Seed data should contain the primary coordinator');

    const assignmentRes = await fetch(`${baseUrl}/api/v1/admin/cases/${createdCase.data.id}/assign-coordinator`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminJar.header(),
        'X-CSRF-Token': adminJar.getCsrf(),
      },
      body: JSON.stringify({
        coordinatorId: alternateCoordinator.id,
        reason: 'Regional workload reassignment for verification follow-up.',
      }),
    });
    assert.equal(assignmentRes.status, 200);

    const userProfileRes = await fetch(`${baseUrl}/api/v1/admin/users/${alternateCoordinator.id}`, {
      headers: { Cookie: adminJar.header() },
    });
    assert.equal(userProfileRes.status, 200);
    const userProfile = (await userProfileRes.json()) as { data: { user: { email: string }; cases: Array<{ id: number }> } };
    assert.equal(userProfile.data.user.email, alternateCoordinator.email);
    assert.ok(userProfile.data.cases.some((item) => item.id === createdCase.data.id));

    const adminStoriesRes = await fetch(`${baseUrl}/api/v1/admin/stories`, {
      headers: { Cookie: adminJar.header() },
    });
    assert.equal(adminStoriesRes.status, 200);
    const adminStoriesJson = (await adminStoriesRes.json()) as { data: Array<{ id: number; status: string }> };
    const submittedStory = adminStoriesJson.data.find((story) => story.status === 'SUBMITTED');
    assert.ok(submittedStory, 'Seed data should contain a submitted story for workflow validation');
    const prematureStoryPublish = await fetch(`${baseUrl}/api/v1/admin/stories/${submittedStory.id}/review`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminJar.header(),
        'X-CSRF-Token': adminJar.getCsrf(),
      },
      body: JSON.stringify({ decision: 'PUBLISHED', editorialNotes: 'Premature publication attempt' }),
    });
    assert.equal(prematureStoryPublish.status, 409, 'Stories must be approved before they can be published');

    const storyCategoryResponse = await fetch(`${baseUrl}/api/v1/meta/taxonomy`);
    const storyCategories = (await storyCategoryResponse.json()) as {
      data: { storyCategories: Array<{ id: number }> };
    };
    const storyPayload = {
      title: `Acceptance Publishing ${Date.now()}`,
      categoryId: storyCategories.data.storyCategories[0].id,
      regionName: 'Acceptance Region',
      excerpt: 'A real private draft used to verify public publishing and consent boundaries.',
      body: '## Community update\n\nThis acceptance story verifies that a saved draft remains private until it has completed the required review and publication steps.',
      anonymousPublication: true,
      isMinorSubject: false,
      consentStory: true,
      consentMedia: false,
      consentIdentity: false,
      guardianConsentRecorded: false,
    };
    const unsafeImageStory = await fetch(`${baseUrl}/api/v1/admin/stories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminJar.header(),
        'X-CSRF-Token': adminJar.getCsrf(),
      },
      body: JSON.stringify({ ...storyPayload, coverImageUrl: 'http://127.0.0.1/private-image.jpg', coverAltText: 'Private image' }),
    });
    assert.equal(unsafeImageStory.status, 400, 'Unapproved or unsafe remote image locations must be rejected');

    const uploadAcceptanceImage = async (filename: string, value: number) => {
      const formData = new FormData();
      formData.append('file', new Blob([
        Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, value]),
      ], { type: 'image/png' }), filename);
      formData.append('scope', 'PUBLIC_STORY');
      const response = await fetch(`${baseUrl}/api/v1/media/upload`, {
        method: 'POST',
        headers: {
          Cookie: adminJar.header(),
          'X-CSRF-Token': adminJar.getCsrf(),
        },
        body: formData,
      });
      assert.equal(response.status, 201);
      return (await response.json()) as { data: { publicUrl: string } };
    };
    const featuredImage = await uploadAcceptanceImage('acceptance-featured.png', 1);
    const galleryImage = await uploadAcceptanceImage('acceptance-gallery.png', 2);

    const createdStoryResponse = await fetch(`${baseUrl}/api/v1/admin/stories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminJar.header(),
        'X-CSRF-Token': adminJar.getCsrf(),
      },
      body: JSON.stringify({
        ...storyPayload,
        saveAsDraft: true,
        coverImageUrl: featuredImage.data.publicUrl,
        coverAltText: 'A community gathering outdoors',
        consentMedia: true,
        media: [{
          url: galleryImage.data.publicUrl,
          altText: 'Community members meeting together',
          caption: 'A local planning discussion.',
        }],
      }),
    });
    assert.equal(createdStoryResponse.status, 201);
    const createdStory = (await createdStoryResponse.json()) as { data: { id: number; slug: string; status: string } };
    assert.equal(createdStory.data.status, 'DRAFT');
    let publicStoryList = await fetch(`${baseUrl}/api/v1/stories`);
    let publicStoryListJson = (await publicStoryList.json()) as { data: Array<{ slug: string }> };
    assert.ok(!publicStoryListJson.data.some((story) => story.slug === createdStory.data.slug), 'Draft stories must remain private');

    const editStory = async (saveAsDraft: boolean, body = storyPayload.body) => fetch(
      `${baseUrl}/api/v1/admin/stories/${createdStory.data.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminJar.header(),
          'X-CSRF-Token': adminJar.getCsrf(),
        },
        body: JSON.stringify({
          ...storyPayload,
          body,
          saveAsDraft,
          coverImageUrl: featuredImage.data.publicUrl,
          coverAltText: 'A community gathering outdoors',
          consentMedia: true,
          media: [{
            url: galleryImage.data.publicUrl,
            altText: 'Community members meeting together',
            caption: 'A local planning discussion.',
          }],
        }),
      },
    );
    const submittedStoryResponse = await editStory(false);
    assert.equal(submittedStoryResponse.status, 200);
    const savedVersions = await db.select().from(schema.storyVersions)
      .where(eq(schema.storyVersions.storyId, createdStory.data.id));
    assert.equal(savedVersions.length, 1, 'Story edits must retain the previous content version');

    const reviewStory = async (decision: string, editorialNotes: string) => fetch(
      `${baseUrl}/api/v1/admin/stories/${createdStory.data.id}/review`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminJar.header(),
          'X-CSRF-Token': adminJar.getCsrf(),
        },
        body: JSON.stringify({ decision, editorialNotes }),
      },
    );
    assert.equal((await reviewStory('UNDER_REVIEW', 'Editorial review has begun for this story.')).status, 200);
    assert.equal((await reviewStory('APPROVED', 'Story approved after safeguarding review.')).status, 200);
    assert.equal((await reviewStory('PUBLISHED', 'Approved for public publication.')).status, 200);
    publicStoryList = await fetch(`${baseUrl}/api/v1/stories`);
    publicStoryListJson = (await publicStoryList.json()) as { data: Array<{ slug: string }> };
    assert.ok(publicStoryListJson.data.some((story) => story.slug === createdStory.data.slug), 'Published stories must appear in the public feed');
    const publicStoryDetail = await fetch(`${baseUrl}/api/v1/stories/${createdStory.data.slug}`);
    assert.equal(publicStoryDetail.status, 200);
    const publicStoryJson = (await publicStoryDetail.json()) as {
      data: { coverImageUrl: string; coverAltText: string; media: Array<{ url: string; altText: string; caption: string }> };
    };
    assert.equal(publicStoryJson.data.coverImageUrl, featuredImage.data.publicUrl);
    assert.equal(publicStoryJson.data.coverAltText, 'A community gathering outdoors');
    assert.equal(publicStoryJson.data.media[0]?.url, galleryImage.data.publicUrl);
    assert.equal(publicStoryJson.data.media[0]?.caption, 'A local planning discussion.');
    const publicImageResponse = await fetch(`${baseUrl}${galleryImage.data.publicUrl}`);
    assert.equal(publicImageResponse.status, 200);
    assert.equal(publicImageResponse.headers.get('content-type'), 'image/png');

    const editedPublishedStory = await editStory(false, `${storyPayload.body}\n\nA reviewed edit.`);
    assert.equal(editedPublishedStory.status, 200);
    const withdrawnDetail = await fetch(`${baseUrl}/api/v1/stories/${createdStory.data.slug}`);
    assert.equal(withdrawnDetail.status, 404, 'Unreviewed edits to a published story must not remain public');
    const editedVersions = await db.select().from(schema.storyVersions)
      .where(eq(schema.storyVersions.storyId, createdStory.data.id));
    assert.equal(editedVersions.length, 2, 'Published edits must preserve each prior story version');

    assert.equal((await reviewStory('UNDER_REVIEW', 'Updated story review is underway.')).status, 200);
    assert.equal((await reviewStory('APPROVED', 'Updated story approved for publishing.')).status, 200);
    assert.equal((await reviewStory('PUBLISHED', 'Updated story approved for release.')).status, 200);
    assert.equal((await reviewStory('UNPUBLISHED', 'Removing this story from public discovery.')).status, 200);
    const unpublishedDetail = await fetch(`${baseUrl}/api/v1/stories/${createdStory.data.slug}`);
    assert.equal(unpublishedDetail.status, 404, 'Unpublished stories must disappear from the public endpoint immediately');

    const adminDashboardRes = await fetch(`${baseUrl}/api/v1/admin/dashboard`, {
      headers: { Cookie: adminJar.header() },
    });
    assert.equal(adminDashboardRes.status, 200);
    const adminDashboardJson = (await adminDashboardRes.json()) as {
      data: {
        metrics: Record<string, unknown>;
        systemHealth: {
          api: string;
          status: string;
          databaseStatus: string;
          privateStorageStatus: string;
          publicMediaStatus: string;
        };
        recentAudit: Array<Record<string, unknown>>;
      };
    };
    for (const metric of [
      'totalUsers',
      'activeUsers',
      'inactiveUsers',
      'administratorUsers',
      'failedLoginAttempts24h',
      'activeCoordinators',
      'verifiedCases',
      'pendingCases',
      'storiesAwaitingModeration',
      'pendingBankTransfers',
      'openSafeguardingAlerts',
    ]) {
      assert.equal(typeof adminDashboardJson.data.metrics[metric], 'number', `${metric} should be database-backed`);
    }
    assert.equal(adminDashboardJson.data.systemHealth.status, 'connected');
    assert.equal(adminDashboardJson.data.systemHealth.api, 'available');
    assert.equal(adminDashboardJson.data.systemHealth.databaseStatus, 'connected');
    assert.ok(['available', 'unavailable'].includes(adminDashboardJson.data.systemHealth.privateStorageStatus));
    assert.ok(['available', 'unavailable'].includes(adminDashboardJson.data.systemHealth.publicMediaStatus));
    for (const entry of adminDashboardJson.data.recentAudit) {
      assert.equal(entry.detailsJson, undefined, 'Dashboard audit feed must not include full action details');
      assert.equal(entry.ipAddress, undefined, 'Dashboard audit feed must not include IP addresses');
    }

    const prematureVerifyRes = await fetch(`${baseUrl}/api/v1/admin/cases/${createdCase.data.id}/verify`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminJar.header(),
        'X-CSRF-Token': adminJar.getCsrf(),
      },
      body: JSON.stringify({ decision: 'VERIFIED', notes: 'Verified in acceptance test', publishPublicly: false }),
    });
    assert.equal(prematureVerifyRes.status, 409, 'Cases must enter review before verification');

    const beginReviewRes = await fetch(`${baseUrl}/api/v1/admin/cases/${createdCase.data.id}/verify`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminJar.header(),
        'X-CSRF-Token': adminJar.getCsrf(),
      },
      body: JSON.stringify({ decision: 'UNDER_REVIEW', notes: 'Started case verification review' }),
    });
    assert.equal(beginReviewRes.status, 200);

    const verifyRes = await fetch(`${baseUrl}/api/v1/admin/cases/${createdCase.data.id}/verify`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminJar.header(),
        'X-CSRF-Token': adminJar.getCsrf(),
      },
      body: JSON.stringify({ decision: 'VERIFIED', notes: 'Verified in acceptance test', publishPublicly: true }),
    });
    assert.equal(verifyRes.status, 200);
    const refreshedImpactRes = await fetch(`${baseUrl}/api/v1/public/impact/summary?period=12m`);
    assert.equal(refreshedImpactRes.status, 200);
    const refreshedImpact = (await refreshedImpactRes.json()) as { data: { verifiedPublicCases: number; reportedPeopleAcrossCases: number } };
    assert.equal(refreshedImpact.data.verifiedPublicCases, 4, 'Publishing a verified case invalidates the cached public report');
    assert.equal(refreshedImpact.data.reportedPeopleAcrossCases, 3180);

    const campaignCreateRes = await fetch(`${baseUrl}/api/v1/admin/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminJar.header(),
        'X-CSRF-Token': adminJar.getCsrf(),
      },
      body: JSON.stringify({
        title: `Acceptance Campaign ${Date.now()}`,
        summary: 'A real campaign created by the isolated acceptance test.',
        description: 'This campaign verifies transactional creation and the administrative publication workflow.',
        targetAmount: 1250,
        startDate: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        coordinatorId: alternateCoordinator.id,
        assignmentReason: 'Test assignment for campaign field operations.',
      }),
    });
    assert.equal(campaignCreateRes.status, 201);
    const campaignCreated = (await campaignCreateRes.json()) as { data: { id: number; status: string } };
    assert.equal(campaignCreated.data.status, 'DRAFT');

    const campaignAssignmentRes = await fetch(`${baseUrl}/api/v1/admin/campaigns/${campaignCreated.data.id}/assign-coordinator`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminJar.header(),
        'X-CSRF-Token': adminJar.getCsrf(),
      },
      body: JSON.stringify({
        coordinatorId: primaryCoordinator.id,
        assignmentReason: 'Reassigning campaign to balance regional field workload.',
      }),
    });
    assert.equal(campaignAssignmentRes.status, 200);
    const campaignAssignments = await db.select().from(schema.campaignAssignments)
      .where(eq(schema.campaignAssignments.campaignId, campaignCreated.data.id));
    assert.equal(campaignAssignments.filter((assignment) => assignment.endedAt === null).length, 1);
    assert.equal(campaignAssignments.length, 2, 'Reassignment must preserve the previous assignment history');

    const prematureCampaignActivation = await fetch(`${baseUrl}/api/v1/admin/campaigns/${campaignCreated.data.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminJar.header(),
        'X-CSRF-Token': adminJar.getCsrf(),
      },
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
    assert.equal(prematureCampaignActivation.status, 409);

    for (const status of ['PENDING_APPROVAL', 'APPROVED', 'ACTIVE']) {
      const transition = await fetch(`${baseUrl}/api/v1/admin/campaigns/${campaignCreated.data.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminJar.header(),
          'X-CSRF-Token': adminJar.getCsrf(),
        },
        body: JSON.stringify({ status, notes: `Acceptance test decision for ${status}` }),
      });
      assert.equal(transition.status, 200, `Campaign transition to ${status} should succeed`);
    }
    const [publication] = await db.select().from(schema.campaignPublications)
      .where(eq(schema.campaignPublications.campaignId, campaignCreated.data.id));
    assert.ok(publication, 'Publishing an approved campaign must create a publication record');

    const categoriesRes = await fetch(`${baseUrl}/api/v1/admin/article-categories`, {
      headers: { Cookie: adminJar.header() },
    });
    assert.equal(categoriesRes.status, 200);
    const categories = (await categoriesRes.json()) as { data: Array<{ id: number }> };
    assert.ok(categories.data.length > 0);
    const articleTitle = `Acceptance News ${Date.now()}`;
    const articleCreateRes = await fetch(`${baseUrl}/api/v1/admin/articles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminJar.header(),
        'X-CSRF-Token': adminJar.getCsrf(),
      },
      body: JSON.stringify({
        title: articleTitle,
        categoryId: categories.data[0].id,
        summary: 'A news article created to test the controlled publication workflow.',
        body: 'This full article body is intentionally long enough to satisfy server validation for the newsroom workflow.',
      }),
    });
    assert.equal(articleCreateRes.status, 201);
    const articleCreated = (await articleCreateRes.json()) as { data: { id: number } };

    const prematureArticlePublish = await fetch(`${baseUrl}/api/v1/admin/articles/${articleCreated.data.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminJar.header(),
        'X-CSRF-Token': adminJar.getCsrf(),
      },
      body: JSON.stringify({ status: 'PUBLISHED' }),
    });
    assert.equal(prematureArticlePublish.status, 409);
    for (const status of ['SUBMITTED', 'APPROVED', 'PUBLISHED']) {
      const transition = await fetch(`${baseUrl}/api/v1/admin/articles/${articleCreated.data.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminJar.header(),
          'X-CSRF-Token': adminJar.getCsrf(),
        },
        body: JSON.stringify({ status, notes: `Acceptance test decision for ${status}` }),
      });
      assert.equal(transition.status, 200, `Article transition to ${status} should succeed`);
    }
    const publicArticlesRes = await fetch(`${baseUrl}/api/v1/articles`);
    assert.equal(publicArticlesRes.status, 200);
    const publicArticles = (await publicArticlesRes.json()) as { data: Array<{ title: string }> };
    assert.ok(publicArticles.data.some((article) => article.title === articleTitle));

    const announcementRes = await fetch(`${baseUrl}/api/v1/admin/announcements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminJar.header(),
        'X-CSRF-Token': adminJar.getCsrf(),
      },
      body: JSON.stringify({
        title: 'Acceptance Test Operations Notice',
        body: 'This announcement verifies a real database-backed notice and recipient notification.',
        targetRole: 'COMMUNITY_COORDINATOR',
      }),
    });
    assert.equal(announcementRes.status, 201);
    const [savedAnnouncement] = await db.select().from(schema.announcements)
      .where(eq(schema.announcements.title, 'Acceptance Test Operations Notice'));
    assert.ok(savedAnnouncement, 'Announcement must persist to the database');
    const recipientNotifications = await db.select().from(schema.notifications)
      .where(eq(schema.notifications.title, 'Acceptance Test Operations Notice'));
    assert.ok(recipientNotifications.length > 0, 'Publishing an announcement must notify the selected audience');

    const auditRes = await fetch(`${baseUrl}/api/v1/admin/audit-logs`, {
      headers: { Cookie: adminJar.header() },
    });
    assert.equal(auditRes.status, 200);
    const auditJson = (await auditRes.json()) as { data: Array<{ action: string }> };
    assert.ok(auditJson.data.some((a) => a.action === 'ADMIN_CASE_VERIFIED'));

    await db.update(schema.humanitarianCases).set({ status: 'CLOSED', isPublic: false });
    await db.update(schema.campaigns).set({ status: 'PAUSED' });
    await db.update(schema.donations).set({ status: 'INITIATED' });
    invalidateImpactSummaryCache();
    const emptyImpactRes = await fetch(`${baseUrl}/api/v1/public/impact/summary?period=12m`);
    assert.equal(emptyImpactRes.status, 200);
    const emptyImpact = (await emptyImpactRes.json()) as { data: { reportingStatus: string; verifiedPublicCases: number } };
    assert.equal(emptyImpact.data.reportingStatus, 'EMPTY');
    assert.equal(emptyImpact.data.verifiedPublicCases, 0);

    console.log('ALL CRITICAL ACCEPTANCE, WORKFLOW, AND SECURITY TESTS PASSED');
  } finally {
    server.close();
    await closeDb();
  }
}

runTests().catch((err) => {
  console.error('Acceptance test failed:', err);
  process.exit(1);
});
