import crypto from 'node:crypto';
import { env } from '../config/env';
import { signHmac, verifyHmac } from '../utils/crypto';

export interface PaymentIntentInput {
  donationReference: string;
  amount: number;
  currency: string;
  paymentChannel: string;
}

export interface PaymentIntentResult {
  provider: string;
  providerReference: string;
  checkoutMode: 'SANDBOX_SIMULATOR' | 'EXTERNAL_REDIRECT';
  instructions: string;
  sandboxSignature: string;
}

export interface PaymentProviderAdapter {
  readonly providerName: string;
  createPaymentIntent(input: PaymentIntentInput): PaymentIntentResult;
  verifyWebhookSignature(rawPayload: string, signature: string): boolean;
}

export class SandboxPaymentAdapter implements PaymentProviderAdapter {
  public readonly providerName = 'SANDBOX_GATEWAY';

  createPaymentIntent(input: PaymentIntentInput): PaymentIntentResult {
    const providerReference = `SBX-TX-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const eventPayload = JSON.stringify({
      eventId: `EVT-${providerReference}`,
      donationReference: input.donationReference,
      providerReference,
      amount: input.amount,
      currency: input.currency,
      status: 'SETTLED',
    });
    const sandboxSignature = signHmac(eventPayload, env.paymentWebhookSecret);

    return {
      provider: this.providerName,
      providerReference,
      checkoutMode: 'SANDBOX_SIMULATOR',
      instructions:
        'Sandbox Payment Adapter active. Contributions are simulated for verification only and are never counted until a signed webhook confirmation is processed.',
      sandboxSignature,
    };
  }

  verifyWebhookSignature(rawPayload: string, signature: string): boolean {
    return verifyHmac(rawPayload, signature, env.paymentWebhookSecret);
  }
}

/**
 * Fail closed: this repository currently implements only the sandbox adapter.
 * A live provider must be implemented and independently reviewed before production
 * payment routes can be enabled.
 */
export function createPaymentAdapter(): PaymentProviderAdapter {
  if (env.isProduction) {
    throw new Error('No production payment provider is implemented. Payment processing is disabled.');
  }
  if (env.paymentProvider !== 'sandbox') {
    throw new Error(`Payment provider "${env.paymentProvider}" is not implemented.`);
  }
  return new SandboxPaymentAdapter();
}

export const paymentAdapter: PaymentProviderAdapter = createPaymentAdapter();
