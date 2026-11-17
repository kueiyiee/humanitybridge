import { AppError } from '../middleware/errorHandler';
export interface PaymentIntentInput { donationReference: string; amount: number; currency: string; paymentChannel: string; }
export interface PaymentIntentResult { provider: string; providerReference: string; checkoutMode: 'SANDBOX_SIMULATOR' | 'EXTERNAL_REDIRECT'; instructions: string; sandboxSignature: string; }
export interface PaymentProviderAdapter {
  readonly providerName: string;
  createPaymentIntent(input: PaymentIntentInput): PaymentIntentResult;
  verifyWebhookSignature(rawPayload: string, signature: string): boolean;
}
class OfflineOnlyPaymentAdapter implements PaymentProviderAdapter {
  public readonly providerName = 'OFFLINE_ONLY';
  createPaymentIntent(_input: PaymentIntentInput): PaymentIntentResult {
    throw new AppError(503, 'Online payment processing is disabled. HumanityBridge records external bank transfers after they are completed outside the platform.');
  }
  verifyWebhookSignature(_rawPayload: string, _signature: string): boolean { return false; }
}
/** No live payment gateway is configured or required; bank transfers use the evidence-review workflow. */
export function createPaymentAdapter(): PaymentProviderAdapter { return new OfflineOnlyPaymentAdapter(); }
export const paymentAdapter: PaymentProviderAdapter = createPaymentAdapter();
