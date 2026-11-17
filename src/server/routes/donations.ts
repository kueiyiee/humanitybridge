import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db, schema, nowUtc } from '../../db/index';
import { createDonationSchema } from '../../../packages/shared/validation';
import { AppError, asyncHandler } from '../middleware/errorHandler';

const router = Router();

function toMinorUnits(value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new AppError(400, 'Invalid payment amount');
  return Math.round(value * 100);
}

// Step 1: Create an INITIATED donation intent. Never confirms payment from form submission alone.
router.post('/donations', asyncHandler(async (_req, _res) => {
  throw new AppError(503, 'Online donations are not enabled. Use the organisation’s independently published bank-transfer instructions. Transfers are recorded and verified separately by authorised staff.');
}));

// Step 2: Trusted HMAC-signed, idempotent payment provider webhook callback.
router.post('/donations/webhook', asyncHandler(async (_req, _res) => {
  throw new AppError(410, 'Payment webhooks are disabled because HumanityBridge does not process online payments.');
}));

// Sandbox simulator trigger: signs a genuine webhook event and dispatches through the exact webhook verifier
router.post('/donations/:reference/sandbox-confirm', asyncHandler(async (_req, _res) => {
  throw new AppError(410, 'Sandbox payment simulation is disabled. Use the external bank transfer evidence workflow.');
}));

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
