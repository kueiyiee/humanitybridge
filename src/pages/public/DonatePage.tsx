import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Lock, ShieldCheck } from 'lucide-react';
import { createDonationSchema } from '../../../packages/shared/validation';
import { apiRequest } from '../../services/api';
import type { z } from 'zod';

type DonationFormValues = z.infer<typeof createDonationSchema>;

interface DonationIntentResponse {
  donationReference: string;
  status: string;
  amount: number;
  currency: string;
  paymentIntent: {
    provider: string;
    providerReference: string;
    instructions: string;
  };
}

export function DonatePage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const initialCampaignId = searchParams.get('campaign') ? Number(searchParams.get('campaign')) : undefined;
  const initialCaseRef = searchParams.get('case') || '';

  const [intent, setIntent] = useState<DonationIntentResponse | null>(null);
  const [confirmedReceipt, setConfirmedReceipt] = useState<{
    donationReference: string;
    amount: number;
    currency: string;
    status: string;
    confirmedAt: string | null;
  } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const { data: campaignsData } = useQuery({
    queryKey: ['public-campaigns-active'],
    queryFn: () => apiRequest<Array<{ id: number; title: string; status: string }>>('/campaigns?status=ACTIVE'),
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof createDonationSchema>, unknown, DonationFormValues>({
    resolver: zodResolver(createDonationSchema),
    defaultValues: {
      campaignId: initialCampaignId,
      caseReference: initialCaseRef,
      amount: 50,
      currency: 'USD',
      donorName: '',
      donorEmail: '',
      isAnonymous: false,
      dedicationNote: '',
      paymentChannel: 'SANDBOX_CARD',
    },
  });

  const selectedAmount = watch('amount');

  const onSubmit = async (values: DonationFormValues) => {
    setServerError(null);
    try {
      const res = await apiRequest<DonationIntentResponse>('/donations', {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          campaignId: values.campaignId ? Number(values.campaignId) : undefined,
          caseReference: values.caseReference?.trim() || undefined,
        }),
      });
      setIntent(res.data);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Unable to initiate donation');
    }
  };

  const handleSandboxConfirm = async () => {
    if (!intent) return;
    setConfirming(true);
    setServerError(null);
    try {
      await apiRequest(`/donations/${intent.donationReference}/sandbox-confirm`, {
        method: 'POST',
        body: JSON.stringify({ providerReference: intent.paymentIntent.providerReference }),
      });
      const receipt = await apiRequest<{
        donationReference: string;
        amount: number;
        currency: string;
        status: string;
        confirmedAt: string | null;
      }>(`/donations/${intent.donationReference}/status`);
      setConfirmedReceipt(receipt.data);
      queryClient.invalidateQueries({ queryKey: ['public-overview'] });
      queryClient.invalidateQueries({ queryKey: ['public-campaigns'] });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Verification callback failed');
    } finally {
      setConfirming(false);
    }
  };

  const activeCampaigns = campaignsData?.data || [];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-2xl mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#16865D] dark:text-[#1FA977]">
          Accountable Humanitarian Contribution
        </p>
        <h1 className="mt-2 font-editorial text-4xl font-semibold text-[#0B1F3A] dark:text-white">
          Support Verified Relief
        </h1>
        <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
          HumanityBridge uses a provider-independent payment verification architecture. Contributions are recorded as
          confirmed only after a signed gateway settlement callback is verified.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8">
          {confirmedReceipt ? (
            <div className="space-y-5">
              <div className="flex items-center gap-3 text-[#16865D] dark:text-[#1FA977]">
                <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
                <h2 className="font-editorial text-2xl font-semibold">Verified Settlement Receipt</h2>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                The sandbox payment webhook passed HMAC-SHA256 verification and updated the financial ledger idempotently.
              </p>
              <dl className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm">
                <div className="px-4 py-3 flex justify-between">
                  <dt className="text-[#748196] dark:text-slate-400">Donation Reference</dt>
                  <dd className="font-mono-tabular font-semibold">{confirmedReceipt.donationReference}</dd>
                </div>
                <div className="px-4 py-3 flex justify-between">
                  <dt className="text-[#748196] dark:text-slate-400">Amount</dt>
                  <dd className="font-mono-tabular font-semibold">
                    ${confirmedReceipt.amount.toLocaleString()} {confirmedReceipt.currency}
                  </dd>
                </div>
                <div className="px-4 py-3 flex justify-between">
                  <dt className="text-[#748196] dark:text-slate-400">Ledger Status</dt>
                  <dd className="font-semibold text-[#16865D] dark:text-[#1FA977]">{confirmedReceipt.status}</dd>
                </div>
              </dl>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmedReceipt(null);
                    setIntent(null);
                  }}
                  className="px-5 py-2.5 rounded-lg bg-[#0B1F3A] dark:bg-[#00BCEB] text-white dark:text-[#071324] text-sm font-semibold"
                >
                  Make Another Contribution
                </button>
                <Link to="/impact" className="px-5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold">
                  View Impact Centre
                </Link>
              </div>
            </div>
          ) : intent ? (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[#123F69] dark:text-[#00BCEB]">
                  Step 2 · Gateway Verification Pending
                </p>
                <h2 className="mt-1 font-editorial text-2xl font-semibold text-[#0B1F3A] dark:text-white">
                  Confirm Contribution via Payment Adapter
                </h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{intent.paymentIntent.instructions}</p>
              </div>

              <div className="p-4 rounded-lg bg-[#F7F9FC] dark:bg-[#071324] border border-slate-200 dark:border-slate-800 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#748196]">Reference</span>
                  <span className="font-mono-tabular font-semibold">{intent.donationReference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#748196]">Gateway Reference</span>
                  <span className="font-mono-tabular">{intent.paymentIntent.providerReference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#748196]">Current Status</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">{intent.status}</span>
                </div>
              </div>

              {serverError && <p className="text-sm text-rose-600">{serverError}</p>}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={confirming}
                  onClick={handleSandboxConfirm}
                  className="px-6 py-3 rounded-lg bg-[#16865D] text-white text-sm font-semibold hover:bg-[#126f4c] disabled:opacity-60"
                >
                  {confirming ? 'Verifying Signed Webhook...' : 'Complete Sandbox Gateway Verification'}
                </button>
                <button
                  type="button"
                  onClick={() => setIntent(null)}
                  className="px-5 py-3 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {serverError && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-sm text-rose-700 dark:text-rose-300">
                  {serverError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">Select Amount (USD)</label>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[25, 50, 100, 250].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setValue('amount', amt, { shouldValidate: true })}
                      className={`py-2.5 rounded-lg text-sm font-mono-tabular font-semibold border transition-colors ${
                        Number(selectedAmount) === amt
                          ? 'bg-[#0B1F3A] dark:bg-[#00BCEB] text-white dark:text-[#071324] border-transparent'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  step="1"
                  min="2"
                  {...register('amount', { valueAsNumber: true })}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-[#071324] border border-slate-200 dark:border-slate-700 text-sm font-mono-tabular"
                />
                {errors.amount && <p className="mt-1 text-xs text-rose-600">{errors.amount.message}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="campaignId" className="block text-sm font-medium mb-1.5">
                    Designate Campaign (Optional)
                  </label>
                  <select
                    id="campaignId"
                    {...register('campaignId')}
                    className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-[#071324] border border-slate-200 dark:border-slate-700 text-sm"
                  >
                    <option value="">General Humanitarian Fund</option>
                    {activeCampaigns.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="caseReference" className="block text-sm font-medium mb-1.5">
                    Verified Case Reference (Optional)
                  </label>
                  <input
                    id="caseReference"
                    type="text"
                    placeholder="e.g. HB-CASE-2026-101"
                    {...register('caseReference')}
                    className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-[#071324] border border-slate-200 dark:border-slate-700 text-sm font-mono-tabular"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="donorName" className="block text-sm font-medium mb-1.5">Full Name or Organisation</label>
                  <input
                    id="donorName"
                    type="text"
                    {...register('donorName')}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-[#071324] border border-slate-200 dark:border-slate-700 text-sm"
                  />
                  {errors.donorName && <p className="mt-1 text-xs text-rose-600">{errors.donorName.message}</p>}
                </div>
                <div>
                  <label htmlFor="donorEmail" className="block text-sm font-medium mb-1.5">Receipt Email</label>
                  <input
                    id="donorEmail"
                    type="email"
                    {...register('donorEmail')}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-[#071324] border border-slate-200 dark:border-slate-700 text-sm"
                  />
                  {errors.donorEmail && <p className="mt-1 text-xs text-rose-600">{errors.donorEmail.message}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="paymentChannel" className="block text-sm font-medium mb-1.5">
                  Payment Channel (Sandbox Adapter)
                </label>
                <select
                  id="paymentChannel"
                  {...register('paymentChannel')}
                  className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-[#071324] border border-slate-200 dark:border-slate-700 text-sm"
                >
                  <option value="SANDBOX_CARD">Card Payment (Sandbox Adapter)</option>
                  <option value="SANDBOX_MOBILE_MONEY">Mobile Money (Sandbox Adapter)</option>
                  <option value="SANDBOX_BANK_TRANSFER">Institutional Bank Transfer (Sandbox Adapter)</option>
                </select>
              </div>

              <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" {...register('isAnonymous')} className="rounded border-slate-300" />
                <span>Display as Anonymous Supporter on public campaign acknowledgements</span>
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-lg bg-[#0B1F3A] dark:bg-[#00BCEB] text-white dark:text-[#071324] text-sm font-semibold hover:bg-[#123F69] transition-colors disabled:opacity-60"
              >
                {isSubmitting ? 'Creating Secure Intent...' : 'Proceed to Gateway Verification'}
              </button>
            </form>
          )}
        </div>

        <aside className="lg:col-span-5 space-y-5">
          <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-[#123F69] dark:text-[#00BCEB] font-semibold text-sm">
              <Lock className="w-4 h-4" aria-hidden="true" />
              <span>Financial Safeguards</span>
            </div>
            <ul className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <li>Card numbers or banking credentials are never stored in HumanityBridge databases.</li>
              <li>Unverified intents never count toward campaign totals or public impact metrics.</li>
              <li>Webhook callbacks are HMAC-verified and deduplicated by unique transaction references.</li>
            </ul>
          </div>

          <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-[#16865D] dark:text-[#1FA977] font-semibold text-sm">
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              <span>Sandbox Mode Notice</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              This environment runs the HumanityBridge Sandbox Payment Adapter. No real funds are charged until
              authorised regional payment providers and legal escrow configurations are activated.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
