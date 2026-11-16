import crypto from 'node:crypto';
import { Router } from 'express';
import { eq, sql } from 'drizzle-orm';
import { db, schema, nowUtc } from '../../db/index';
import { createDonationSchema } from '../../../packages/shared/validation';
import { generateReferenceCode, signHmac } from '../utils/crypto';
import { paymentAdapter } from '../services/paymentAdapter';
import { writeAuditLog } from '../services/auditService';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { env } from '../config/env';

const router = Router();

// Step 1: Create an INITIATED donation intent. Never confirms payment from form submission alone.
router.post(
  '/donations',
  asyncHandler(async (req, res) => {
    const parsed = createDonationSchema.parse(req.body);
    const ts = nowUtc();

    let resolvedCaseId: number | null = null;
    if (parsed.caseReference) {
      const caseRows = await db
        .select({ id: schema.humanitarianCases.id, status: schema.humanitarianCases.status })
        .from(schema.humanitarianCases)
        .where(eq(schema.humanitarianCases.referenceCode, parsed.caseReference))
        .limit(1);
      if (!caseRows[0] || caseRows[0].status !== 'VERIFIED') {
        throw new AppError(400, 'Referenced case is not verified for contributions');
      }
      resolvedCaseId = caseRows[0].id;
    }

    if (parsed.campaignId) {
      const campRows = await db
        .select({ id: schema.campaigns.id, status: schema.campaigns.status })
        .from(schema.campaigns)
        .where(eq(schema.campaigns.id, parsed.campaignId))
        .limit(1);
      if (!campRows[0] || campRows[0].status !== 'ACTIVE') {
        throw new AppError(400, 'Selected campaign is not currently active');
      }
    }

    const donationReference = generateReferenceCode('HB-DON');
    await db.insert(schema.donations).values({
      donationReference,
      campaignId: parsed.campaignId ?? null,
      caseId: resolvedCaseId,
      amount: parsed.amount,
      currency: parsed.currency.toUpperCase(),
      donorName: parsed.donorName,
      donorEmail: parsed.donorEmail,
      isAnonymous: parsed.isAnonymous,
      dedicationNote: parsed.dedicationNote || null,
      status: 'INITIATED',
      paymentChannel: parsed.paymentChannel,
      createdAt: ts,
    });

    const intent = paymentAdapter.createPaymentIntent({
      donationReference,
      amount: parsed.amount,
      currency: parsed.currency.toUpperCase(),
      paymentChannel: parsed.paymentChannel,
    });

    return res.status(201).json({
      success: true,
      message: 'Donation intent created. Awaiting trusted payment verification.',
      data: {
        donationReference,
        status: 'INITIATED',
        amount: parsed.amount,
        currency: parsed.currency.toUpperCase(),
        paymentIntent: intent,
      },
    });
  }),
);

// Step 2: Trusted HMAC-signed, idempotent payment provider webhook callback.
router.post(
  '/donations/webhook',
  asyncHandler(async (req, res) => {
    const signature = String(req.headers['x-hb-signature'] || '');
    const rawPayload = JSON.stringify(req.body);

    if (!signature || !paymentAdapter.verifyWebhookSignature(rawPayload, signature)) {
      throw new AppError(401, 'Invalid webhook signature');
    }

    const eventId = String(req.body?.eventId || '').trim();
    const donationReference = String(req.body?.donationReference || '').trim();
    const providerReference = String(req.body?.providerReference || '').trim();
    const amount = Number(req.body?.amount || 0);
    const currency = String(req.body?.currency || 'USD').toUpperCase();
    const eventStatus = String(req.body?.status || '').toUpperCase();

    if (!eventId || !donationReference || !providerReference) {
      throw new AppError(400, 'Incomplete webhook payload');
    }

    const ts = nowUtc();
    const payloadHash = crypto.createHash('sha256').update(rawPayload).digest('hex');

    const result = await db.transaction(async (tx) => {
      // Idempotency check 1: duplicate webhook eventId
      const existingEvent = await tx
        .select()
        .from(schema.paymentWebhookEvents)
        .where(eq(schema.paymentWebhookEvents.eventId, eventId))
        .limit(1);
      if (existingEvent.length > 0) {
        return { duplicate: true, status: 'ALREADY_PROCESSED' };
      }

      // Idempotency check 2: duplicate providerReference
      const existingTx = await tx
        .select()
        .from(schema.paymentTransactions)
        .where(eq(schema.paymentTransactions.providerReference, providerReference))
        .limit(1);
      if (existingTx.length > 0) {
        return { duplicate: true, status: 'DUPLICATE_PROVIDER_REFERENCE' };
      }

      const donationRows = await tx
        .select()
        .from(schema.donations)
        .where(eq(schema.donations.donationReference, donationReference))
        .limit(1);
      const donation = donationRows[0];
      if (!donation) {
        throw new AppError(404, 'Referenced donation not found');
      }

      await tx.insert(schema.paymentWebhookEvents).values({
        eventId,
        provider: paymentAdapter.providerName,
        signatureValid: true,
        payloadHash,
        processedAt: ts,
      });

      if (eventStatus === 'SETTLED') {
        if (donation.status === 'CONFIRMED') {
          return { duplicate: true, status: 'ALREADY_CONFIRMED' };
        }

        await tx.insert(schema.paymentTransactions).values({
          donationId: donation.id,
          provider: paymentAdapter.providerName,
          providerReference,
          amount,
          currency,
          status: 'SETTLED',
          verifiedByWebhook: true,
          createdAt: ts,
        });

        await tx
          .update(schema.donations)
          .set({ status: 'CONFIRMED', confirmedAt: ts })
          .where(eq(schema.donations.id, donation.id));

        if (donation.campaignId) {
          await tx
            .update(schema.campaigns)
            .set({
              raisedAmount: sql`${schema.campaigns.raisedAmount} + ${donation.amount}`,
              updatedAt: ts,
            })
            .where(eq(schema.campaigns.id, donation.campaignId));
        }

        await tx.insert(schema.financialRecords).values({
          entryType: 'CONFIRMED_INFLOW',
          referenceCode: donation.donationReference,
          amount: donation.amount,
          currency: donation.currency,
          campaignId: donation.campaignId,
          caseId: donation.caseId,
          description: `Verified donation inflow (${providerReference})`,
          recordedAt: ts,
        });

        return { duplicate: false, status: 'CONFIRMED' };
      }

      await tx
        .update(schema.donations)
        .set({ status: 'FAILED' })
        .where(eq(schema.donations.id, donation.id));
      return { duplicate: false, status: 'FAILED' };
    });

    if (!result.duplicate) {
      await writeAuditLog({
        action: `DONATION_WEBHOOK_${result.status}`,
        resourceType: 'donation',
        resourceId: donationReference,
        details: { eventId, providerReference, amount },
        ipAddress: req.ip,
      });
    }

    return res.json({
      success: true,
      message: result.duplicate ? 'Duplicate callback ignored idempotently' : 'Webhook verified and processed',
      data: result,
    });
  }),
);

// Sandbox simulator trigger: signs a genuine webhook event and dispatches through the exact webhook verifier
router.post(
  '/donations/:reference/sandbox-confirm',
  asyncHandler(async (req, res) => {
    if (env.isProduction) {
      throw new AppError(403, 'Sandbox confirmation endpoint is disabled in production');
    }
    const reference = String(req.params.reference);
    const providerReference = String(req.body?.providerReference || `SBX-TX-${Date.now()}`);
    const rows = await db
      .select()
      .from(schema.donations)
      .where(eq(schema.donations.donationReference, reference))
      .limit(1);
    const donation = rows[0];
    if (!donation) throw new AppError(404, 'Donation not found');

    const payload = {
      eventId: `EVT-${providerReference}`,
      donationReference: donation.donationReference,
      providerReference,
      amount: donation.amount,
      currency: donation.currency,
      status: 'SETTLED',
    };
    const raw = JSON.stringify(payload);
    const sig = signHmac(raw, env.paymentWebhookSecret);

    // Forward internally via HTTP call to the real webhook handler or process through the same verification
    const verifyRes = await fetch(`http://127.0.0.1:${env.port}/api/v1/donations/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-hb-signature': sig },
      body: raw,
    });
    const verifyJson = await verifyRes.json();
    return res.status(verifyRes.status).json(verifyJson);
  }),
);

router.get(
  '/donations/:reference/status',
  asyncHandler(async (req, res) => {
    const reference = String(req.params.reference);
    const rows = await db
      .select({
        donationReference: schema.donations.donationReference,
        amount: schema.donations.amount,
        currency: schema.donations.currency,
        donorName: schema.donations.donorName,
        isAnonymous: schema.donations.isAnonymous,
        status: schema.donations.status,
        paymentChannel: schema.donations.paymentChannel,
        confirmedAt: schema.donations.confirmedAt,
        createdAt: schema.donations.createdAt,
      })
      .from(schema.donations)
      .where(eq(schema.donations.donationReference, reference))
      .limit(1);
    const donation = rows[0];
    if (!donation) throw new AppError(404, 'Donation reference not found');

    return res.json({
      success: true,
      message: 'Donation status retrieved',
      data: {
        ...donation,
        donorName: donation.isAnonymous ? 'Anonymous Supporter' : donation.donorName,
      },
    });
  }),
);

export default router;
