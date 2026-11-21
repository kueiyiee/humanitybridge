import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Printer, Upload } from 'lucide-react';
import type { z } from 'zod';
import {
  createAssistanceRequestSchema,
  createCaseSchema,
  createFieldReportSchema,
  createStorySchema,
} from '../../../packages/shared/validation';
import { apiRequest } from '../../services/api';

interface Taxonomy {
  caseCategories: Array<{ id: number; name: string }>;
  storyCategories: Array<{ id: number; name: string }>;
  locations: Array<{ id: number; regionName: string; country: string }>;
}

export function CoordinatorCaseForm({
  taxonomy,
  onSuccess,
}: {
  taxonomy?: Taxonomy;
  onSuccess: () => void;
}) {
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [evidenceFileInfo, setEvidenceFileInfo] = useState<string | null>(null);
  const [evidenceMediaId, setEvidenceMediaId] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof createCaseSchema>, unknown, z.output<typeof createCaseSchema>>({
    resolver: zodResolver(createCaseSchema),
    defaultValues: {
      beneficiaryAgeBand: 'UNKNOWN',
      beneficiaryGender: 'UNKNOWN',
      householdSize: 1,
      urgencyLevel: 'MEDIUM',
      affectedCount: 1,
      isChildRelated: false,
      guardianConsentObtained: false,
      beneficiaryConsentObtained: false,
      saveAsDraft: false,
    },
  });

  const isChildRelated = watch('isChildRelated');
  const beneficiaryAgeBand = watch('beneficiaryAgeBand');
  const requiresGuardianConsent = isChildRelated || beneficiaryAgeBand === 'UNDER_18';

  const handleEvidenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('scope', 'PRIVATE_CASE_EVIDENCE');
    try {
      const res = await apiRequest<{ id: number; safeFilename: string }>('/media/upload', { method: 'POST', body: fd });
      setEvidenceMediaId(res.data.id);
      setEvidenceFileInfo(`Confidential evidence attached: ${res.data.safeFilename}`);
    } catch (uploadErr) {
      setErr(uploadErr instanceof Error ? uploadErr.message : 'File upload rejected');
    }
  };

  const submitCase = async (values: z.infer<typeof createCaseSchema>, asDraft: boolean) => {
    setErr(null);
    setMsg(null);
    if (!asDraft && !values.beneficiaryConsentObtained) {
      setErr('Record informed beneficiary consent before submitting this case. You may save it as a draft while consent is pending.');
      return;
    }
    if (!asDraft && (values.isChildRelated || values.beneficiaryAgeBand === 'UNDER_18') && !values.guardianConsentObtained) {
      setErr('Document verified guardian consent before submitting a case involving a person under 18.');
      return;
    }
    try {
      const res = await apiRequest<{ referenceCode: string }>('/coordinator/cases', {
        method: 'POST',
        body: JSON.stringify({ ...values, evidenceMediaId, saveAsDraft: asDraft }),
      });
      setMsg(`${res.message} (${res.data.referenceCode})`);
      reset();
      setEvidenceMediaId(null);
      setEvidenceFileInfo(null);
      qc.invalidateQueries({ queryKey: ['coordinator-cases'] });
      qc.invalidateQueries({ queryKey: ['coordinator-dashboard'] });
      onSuccess();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Unable to save case');
    }
  };

  return (
    <div className="hb-case-registration space-y-5">
      <div>
        <h2 className="font-editorial text-2xl font-semibold text-[#0B1F3A] dark:text-white">
          Individual & Family Case Registration
        </h2>
        <p className="mt-1 text-xs text-[#748196] dark:text-slate-400">
          Public summaries must exclude personal telephone numbers and street addresses. Private contact fields below
          are restricted exclusively to Platform Administrators.
        </p>
      </div>

      {msg && <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-700 dark:text-emerald-300">{msg}</div>}
      {err && <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-700 dark:text-rose-300">{err}</div>}

      <div className="hb-print-hide flex flex-wrap items-center justify-between gap-3 border-y border-[var(--hb-border)] py-3">
        <p className="text-xs text-[var(--hb-muted)]">Complete the form online or print a blank copy for an authorised field visit. Printed copies contain confidential information and must be stored securely.</p>
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full border border-[var(--hb-border)] bg-[var(--hb-glass)] px-4 py-2 text-sm font-semibold text-[var(--hb-text)] hover:bg-[var(--hb-accent-soft)]"><Printer className="h-4 w-4" /> Print A4 form</button>
      </div>
      <form className="space-y-4">
        <section className="rounded-xl border border-cyan-200 bg-cyan-50/40 p-4 space-y-4 dark:border-cyan-900/60 dark:bg-cyan-950/20">
          <div><h3 className="text-sm font-bold text-slate-900 dark:text-white">Beneficiary identity & household profile</h3><p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">Confidential details for authorised case-management staff only. Do not enter national identity numbers, bank passwords or full bank-account numbers.</p></div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2"><label className="mb-1 block text-xs font-semibold">Beneficiary full name *</label><input {...register('beneficiaryFullName')} autoComplete="name" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />{errors.beneficiaryFullName && <p className="mt-1 text-xs text-rose-600">{errors.beneficiaryFullName.message}</p>}</div>
            <div><label className="mb-1 block text-xs font-semibold">Age group *</label><select {...register('beneficiaryAgeBand')} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="UNKNOWN">Not recorded</option><option value="UNDER_18">Under 18</option><option value="18_24">18–24</option><option value="25_59">25–59</option><option value="60_PLUS">60+</option></select></div>
            <div><label className="mb-1 block text-xs font-semibold">Gender (optional)</label><select {...register('beneficiaryGender')} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="UNKNOWN">Not recorded</option><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="OTHER">Other</option><option value="PREFER_NOT_TO_SAY">Prefer not to say</option></select></div>
            <div><label className="mb-1 block text-xs font-semibold">Household size *</label><input type="number" min="1" max="1000" {...register('householdSize')} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" />{errors.householdSize && <p className="mt-1 text-xs text-rose-600">{errors.householdSize.message}</p>}</div>
            <div><label className="mb-1 block text-xs font-semibold">Preferred language</label><input {...register('beneficiaryPreferredLanguage')} placeholder="e.g. Nuer, Arabic, English" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" /></div>
            <div className="sm:col-span-2 lg:col-span-4"><label className="mb-1 block text-xs font-semibold">Priority or accessibility considerations (optional)</label><textarea rows={2} {...register('beneficiaryNeedsNotes')} placeholder="Record only information necessary to assess and deliver assistance." className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" /></div>
          </div>
        </section>

        <div>
          <label className="block text-sm font-medium mb-1">Case Title</label>
          <input {...register('title')} className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
          {errors.title && <p className="text-xs text-rose-600 mt-1">{errors.title.message}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select {...register('categoryId')} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm">
              <option value="">Select...</option>
              {taxonomy?.caseCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {errors.categoryId && <p className="text-xs text-rose-600 mt-1">{errors.categoryId.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Community Region</label>
            <select {...register('locationId')} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm">
              <option value="">Select...</option>
              {taxonomy?.locations.map((l) => (
                <option key={l.id} value={l.id}>{l.regionName}</option>
              ))}
            </select>
            {errors.locationId && <p className="text-xs text-rose-600 mt-1">{errors.locationId.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Affected Individuals</label>
            <input type="number" {...register('affectedCount')} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm font-mono-tabular" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Urgency Level</label>
            <select {...register('urgencyLevel')} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm">
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Dignified Situation Summary (Safe for Public Review)</label>
          <textarea rows={3} {...register('publicSummary')} className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
          {errors.publicSummary && <p className="text-xs text-rose-600 mt-1">{errors.publicSummary.message}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">Specific Assistance Required</label>
            <input {...register('assistanceNeeded')} className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
            {errors.assistanceNeeded && <p className="text-xs text-rose-600 mt-1">{errors.assistanceNeeded.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Estimated Cost (USD)</label>
            <input type="number" {...register('estimatedCostUsd')} className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm font-mono-tabular" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#F7F9FC] dark:bg-[#071324] border border-slate-200 dark:border-slate-800 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#123F69] dark:text-[#00BCEB]">
            Private Contact & Verification Vault (Never Public)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Private Liaison / Contact Name</label>
              <input {...register('privateContactName')} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0D223D] text-sm" />
              {errors.privateContactName && <p className="text-xs text-rose-600 mt-1">{errors.privateContactName.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Private Phone / Verification Channel</label>
              <input {...register('privateContactPhone')} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0D223D] text-sm" />
              {errors.privateContactPhone && <p className="text-xs text-rose-600 mt-1">{errors.privateContactPhone.message}</p>}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Internal Field Location & Verification Notes</label>
            <input {...register('privateLocationNotes')} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0D223D] text-sm" />
            {errors.privateLocationNotes && <p className="text-xs text-rose-600 mt-1">{errors.privateLocationNotes.message}</p>}
          </div>
          <div>
            <label className="inline-flex items-center gap-2 text-xs font-medium text-[#123F69] dark:text-[#00BCEB] cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>Upload Confidential Evidence Document (JPG, PNG, PDF)</span>
              <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={handleEvidenceUpload} className="sr-only" />
            </label>
            {evidenceFileInfo && <p className="mt-1 text-xs text-[#16865D]">{evidenceFileInfo}</p>}
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" {...register('beneficiaryConsentObtained')} />
            <span>Informed consent obtained from affected household or community committee</span>
          </label>
          {errors.beneficiaryConsentObtained && (
            <p className="text-xs text-rose-600">{errors.beneficiaryConsentObtained.message}</p>
          )}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" {...register('isChildRelated')} />
            <span>Case involves minors (triggers Child Safeguarding protocol)</span>
          </label>
          {requiresGuardianConsent && (
            <label className="flex items-center gap-2.5 cursor-pointer pl-6 text-amber-700 dark:text-amber-300">
              <input type="checkbox" {...register('guardianConsentObtained')} />
              <span>Verified guardian consent documented and stored privately</span>
            </label>
          )}
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit((v) => submitCase(v, false))}
            className="px-6 py-2.5 rounded-lg bg-[#0B1F3A] dark:bg-[#00BCEB] text-white dark:text-[#071324] text-sm font-semibold"
          >
            Submit for Verification
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit((v) => submitCase(v, true))}
            className="px-5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold"
          >
            Save as Draft
          </button>
        </div>
      </form>
    </div>
  );
}

export function CoordinatorStoryForm({ taxonomy }: { taxonomy?: Taxonomy }) {
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [uploadedCoverUrl, setUploadedCoverUrl] = useState<string>('');

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof createStorySchema>, unknown, z.output<typeof createStorySchema>>({
    resolver: zodResolver(createStorySchema),
    defaultValues: {
      anonymousPublication: false,
      consentStory: false,
      consentMedia: false,
      consentIdentity: false,
      isMinorSubject: false,
      guardianConsentRecorded: false,
      saveAsDraft: false,
    },
  });

  const isMinor = watch('isMinorSubject');

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('scope', 'PUBLIC_STORY');
    try {
      const res = await apiRequest<{ publicUrl: string | null }>('/media/upload', { method: 'POST', body: fd });
      if (res.data.publicUrl) setUploadedCoverUrl(res.data.publicUrl);
    } catch (uploadErr) {
      setErr(uploadErr instanceof Error ? uploadErr.message : 'Image upload failed');
    }
  };

  const onSubmit = async (values: z.infer<typeof createStorySchema>) => {
    setErr(null);
    setMsg(null);
    try {
      const res = await apiRequest('/coordinator/stories', {
        method: 'POST',
        body: JSON.stringify({ ...values, coverImageUrl: uploadedCoverUrl || values.coverImageUrl }),
      });
      setMsg(res.message);
      reset();
      setUploadedCoverUrl('');
      qc.invalidateQueries({ queryKey: ['coordinator-stories'] });
      qc.invalidateQueries({ queryKey: ['coordinator-dashboard'] });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Unable to submit story');
    }
  };

  return (
    <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
      <div>
        <h2 className="font-editorial text-2xl font-semibold text-[#0B1F3A] dark:text-white">
          Submit Humanitarian Story
        </h2>
        <p className="mt-1 text-xs text-[#748196] dark:text-slate-400">
          Stories remain unpublished until reviewed and approved by Platform Administration.
        </p>
      </div>

      {msg && <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-700 dark:text-emerald-300">{msg}</div>}
      {err && <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-700 dark:text-rose-300">{err}</div>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium mb-1">Story Title</label>
            <input {...register('title')} className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
            {errors.title && <p className="text-xs text-rose-600 mt-1">{errors.title.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select {...register('categoryId')} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm">
              <option value="">Select...</option>
              {taxonomy?.storyCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {errors.categoryId && <p className="text-xs text-rose-600 mt-1">{errors.categoryId.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Community / Region</label>
            <input {...register('regionName')} className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Upload Story Photograph (Optional)</label>
            <input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={handleCoverUpload} className="w-full text-xs py-1.5" />
            {uploadedCoverUrl && <p className="text-xs text-[#16865D] mt-1">Photo attached cleanly.</p>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Short Introduction</label>
          <input {...register('excerpt')} className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
          {errors.excerpt && <p className="text-xs text-rose-600 mt-1">{errors.excerpt.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Full Narrative</label>
          <textarea rows={6} {...register('body')} className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
          {errors.body && <p className="text-xs text-rose-600 mt-1">{errors.body.message}</p>}
        </div>

        <div className="p-4 rounded-xl bg-[#F7F9FC] dark:bg-[#071324] border border-slate-200 dark:border-slate-800 space-y-2 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#123F69] dark:text-[#00BCEB]">
            Granular Informed Consent Verification
          </p>
          <label className="flex items-center gap-2.5"><input type="checkbox" {...register('consentStory')} /><span>Explicit consent recorded to publish narrative</span></label>
          {errors.consentStory && <p className="text-xs text-rose-600">{errors.consentStory.message}</p>}
          <label className="flex items-center gap-2.5"><input type="checkbox" {...register('consentMedia')} /><span>Separate consent recorded for photographs/media</span></label>
          <label className="flex items-center gap-2.5"><input type="checkbox" {...register('anonymousPublication')} /><span>Publish anonymously (protect contributor identity)</span></label>
          <label className="flex items-center gap-2.5"><input type="checkbox" {...register('isMinorSubject')} /><span>Story involves minors (requires guardian consent)</span></label>
          {isMinor && (
            <label className="flex items-center gap-2.5 pl-6 text-amber-700 dark:text-amber-300">
              <input type="checkbox" {...register('guardianConsentRecorded')} />
              <span>Guardian consent confirmed and documented</span>
            </label>
          )}
        </div>

        <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 rounded-lg bg-[#0B1F3A] dark:bg-[#00BCEB] text-white dark:text-[#071324] text-sm font-semibold">
          {isSubmitting ? 'Submitting...' : 'Submit for Editorial Review'}
        </button>
      </form>
    </div>
  );
}

export function CoordinatorAssistanceAndReports({
  myCases,
  taxonomy,
  mode,
}: {
  myCases: Array<{ id: number; referenceCode: string; title: string }>;
  taxonomy?: Taxonomy;
  mode: 'assistance' | 'report';
}) {
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const assistanceForm = useForm<
    z.input<typeof createAssistanceRequestSchema>,
    unknown,
    z.output<typeof createAssistanceRequestSchema>
  >({
    resolver: zodResolver(createAssistanceRequestSchema),
  });

  const reportForm = useForm<
    z.input<typeof createFieldReportSchema>,
    unknown,
    z.output<typeof createFieldReportSchema>
  >({
    resolver: zodResolver(createFieldReportSchema),
    defaultValues: { visitDate: new Date().toISOString().slice(0, 10), peopleReached: 0 },
  });

  if (mode === 'assistance') {
    const submitReq = async (values: z.infer<typeof createAssistanceRequestSchema>) => {
      setErr(null);
      setMsg(null);
      try {
        const res = await apiRequest('/coordinator/assistance-requests', {
          method: 'POST',
          body: JSON.stringify(values),
        });
        setMsg(res.message);
        assistanceForm.reset();
        qc.invalidateQueries({ queryKey: ['coordinator-assistance'] });
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Unable to submit request');
      }
    };

    return (
      <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <h2 className="font-editorial text-xl font-semibold">New Assistance Request</h2>
        {msg && <p className="text-xs text-[#16865D]">{msg}</p>}
        {err && <p className="text-xs text-rose-600">{err}</p>}
        <form onSubmit={assistanceForm.handleSubmit(submitReq)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Linked Case</label>
              <select {...assistanceForm.register('caseId')} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm">
                <option value="">Select case...</option>
                {myCases.map((c) => (
                  <option key={c.id} value={c.id}>{c.referenceCode} · {c.title.slice(0, 32)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Support Type</label>
              <input {...assistanceForm.register('supportType')} placeholder="e.g. Water Pump Spare Parts" className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Requested USD</label>
              <input type="number" {...assistanceForm.register('requestedAmountUsd')} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm font-mono-tabular" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Operational Justification</label>
            <textarea rows={3} {...assistanceForm.register('justification')} className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
          </div>
          <button type="submit" className="px-5 py-2.5 rounded-lg bg-[#0B1F3A] dark:bg-[#00BCEB] text-white dark:text-[#071324] text-sm font-semibold">
            Submit Assistance Request
          </button>
        </form>
      </div>
    );
  }

  const submitReport = async (values: z.infer<typeof createFieldReportSchema>) => {
    setErr(null);
    setMsg(null);
    try {
      const res = await apiRequest('/coordinator/reports', {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          caseId: values.caseId ? Number(values.caseId) : undefined,
        }),
      });
      setMsg(res.message);
      reportForm.reset();
      qc.invalidateQueries({ queryKey: ['coordinator-reports'] });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Unable to save field report');
    }
  };

  return (
    <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
      <h2 className="font-editorial text-xl font-semibold">Record Community Visit & Field Report</h2>
      {msg && <p className="text-xs text-[#16865D]">{msg}</p>}
      {err && <p className="text-xs text-rose-600">{err}</p>}
      <form onSubmit={reportForm.handleSubmit(submitReport)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Visit Date</label>
            <input type="date" {...reportForm.register('visitDate')} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Region</label>
            <select {...reportForm.register('locationId')} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm">
              <option value="">Select...</option>
              {taxonomy?.locations.map((l) => (
                <option key={l.id} value={l.id}>{l.regionName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Case (Optional)</label>
            <select {...reportForm.register('caseId')} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm">
              <option value="">General community visit</option>
              {myCases.map((c) => (
                <option key={c.id} value={c.id}>{c.referenceCode}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">People Reached</label>
            <input type="number" {...reportForm.register('peopleReached')} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm font-mono-tabular" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Visit Observations & Context</label>
          <textarea rows={3} {...reportForm.register('summary')} className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Assistance Delivered (Optional)</label>
          <input {...reportForm.register('assistanceDelivered')} className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
        </div>
        <button type="submit" className="px-5 py-2.5 rounded-lg bg-[#0B1F3A] dark:bg-[#00BCEB] text-white dark:text-[#071324] text-sm font-semibold">
          Save Field Report
        </button>
      </form>
    </div>
  );
}
