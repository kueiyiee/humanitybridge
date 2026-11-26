import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, ShieldAlert } from 'lucide-react';
import type { z } from 'zod';
import { safeguardingReportSchema } from '../../../packages/shared/validation';
import { apiRequest } from '../../services/api';

type SafeguardingForm = z.infer<typeof safeguardingReportSchema>;

export function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14 space-y-6">
      <h1 className="font-editorial text-4xl font-semibold text-[#0B1F3A] dark:text-white">Privacy Policy</h1>
      <p className="text-sm text-[#748196] dark:text-slate-400">HumanityBridge Data Protection & Beneficiary Confidentiality Charter</p>
      <div className="space-y-4 text-base text-slate-700 dark:text-slate-200 leading-relaxed">
        <p>HumanityBridge separates public humanitarian storytelling from private case administration records. Personal telephone numbers, exact residential coordinates, and sensitive documents are never published or exposed via public APIs.</p>
        <p>Authentication relies on HTTP-only session cookies, Argon2id password hashing, and server-side CSRF validation. Individuals may request access, anonymization, or consent withdrawal through the Safeguarding & Privacy Centre.</p>
      </div>
    </div>
  );
}

export function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14 space-y-6">
      <h1 className="font-editorial text-4xl font-semibold text-[#0B1F3A] dark:text-white">Terms & Conditions</h1>
      <div className="space-y-4 text-base text-slate-700 dark:text-slate-200 leading-relaxed">
        <p>Use of HumanityBridge public resources and coordinator portals is governed by strict adherence to human dignity, truthful documentation, and zero tolerance for exploitation or misrepresentation.</p>
        <p>Community Coordinator accounts require Platform Administrator vetting. Unauthorized attempts to access confidential records or bypass verification workflows result in immediate suspension and audit logging.</p>
      </div>
    </div>
  );
}

export function TransparencyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14 space-y-6">
      <h1 className="font-editorial text-4xl font-semibold text-[#0B1F3A] dark:text-white">Donation Transparency Policy</h1>
      <div className="space-y-4 text-base text-slate-700 dark:text-slate-200 leading-relaxed">
        <p>Every contribution initiated on HumanityBridge receives a unique donation reference. No contribution is marked confirmed or counted toward campaign totals until an authorised gateway settlement webhook is cryptographically verified and deduplicated.</p>
        <p>All refunds, disbursements, and external reconciliations require Platform Administrator authorization and generate immutable financial audit entries.</p>
      </div>
    </div>
  );
}

export function SafeguardingPolicyPage() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SafeguardingForm>({
    resolver: zodResolver(safeguardingReportSchema),
    defaultValues: { subjectType: 'PRIVACY_CONCERN', severity: 'HIGH' },
  });

  const onSubmit = async (values: SafeguardingForm) => {
    setError(null);
    try {
      await apiRequest('/public/safeguarding', { method: 'POST', body: JSON.stringify(values) });
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to submit report');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14 space-y-10">
      <div>
        <h1 className="font-editorial text-4xl font-semibold text-[#0B1F3A] dark:text-white">Safeguarding Policy</h1>
        <p className="mt-3 text-base text-slate-600 dark:text-slate-300 leading-relaxed">
          Protecting children, displaced individuals, and vulnerable contributors is our highest operational mandate.
          Minor-related stories require explicit guardian consent, mandatory identity redaction, and human safeguarding review.
        </p>
      </div>

      <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8">
        <div className="flex items-center gap-2 text-[#0B1F3A] dark:text-[#00BCEB] font-semibold mb-4">
          <ShieldAlert className="w-5 h-5" aria-hidden="true" />
          <h2>Confidential Safeguarding & Consent Withdrawal Form</h2>
        </div>

        {submitted ? (
          <div className="flex items-start gap-3 text-[#16865D] dark:text-[#1FA977]">
            <CheckCircle2 className="w-6 h-6 shrink-0" />
            <div>
              <h3 className="font-semibold text-base">Confidential Report Logged</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Your safeguarding or privacy notice has been routed directly to the restricted Safeguarding & Privacy Centre.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Concern Type</label>
                <select {...register('subjectType')} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm">
                  <option value="PRIVACY_CONCERN">Privacy / Redaction Request</option>
                  <option value="CHILD_SAFEGUARDING">Child Safeguarding</option>
                  <option value="STORY">Published Story Concern</option>
                  <option value="CASE">Humanitarian Case Concern</option>
                  <option value="USER">Account Conduct Concern</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Urgency / Severity</label>
                <select {...register('severity')} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm">
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reference Code (Optional)</label>
                <input {...register('referenceCode')} placeholder="e.g. HB-CASE-2026-101" className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm font-mono-tabular" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Contact Email (Optional for follow-up)</label>
              <input type="email" {...register('reporterEmail')} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description of Concern</label>
              <textarea rows={4} {...register('description')} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
              {errors.description && <p className="text-xs text-rose-600 mt-1">{errors.description.message}</p>}
            </div>
            <button type="submit" disabled={isSubmitting} className="px-6 py-3 rounded-lg bg-[#0B1F3A] dark:bg-[#00BCEB] text-white dark:text-[#071324] text-sm font-semibold">
              {isSubmitting ? 'Submitting Securely...' : 'Submit Confidential Report'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
