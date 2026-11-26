import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArrowDownToLine,
  ArrowRight,
  BadgeCheck,
  Ban,
  Building2,
  CheckCircle2,
  Eye,
  FileCheck2,
  FilePlus2,
  Files,
  History,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiBlob, apiRequest } from '../../services/api';
import { AdminDocumentEditor } from './AdminDocumentEditor';

type DocumentType = {
  id: number;
  typeCode: string;
  displayName: string;
  referencePrefix: string;
  isApproved: boolean;
  requiresApproval: boolean;
  publicVerification: boolean;
  publicRecipient: boolean;
};

type TemplateConfiguration = {
  pageSize: 'A4' | 'LETTER';
  orientation: 'PORTRAIT' | 'LANDSCAPE';
  title: string;
  introduction: string;
  footerText: string;
  signatoryId: number | null;
  includeBarcode: boolean;
};

type DocumentTemplate = {
  id: number;
  documentTypeId: number;
  categoryName: string;
  name: string;
  isActive: boolean;
  currentVersion: number;
  configuration: TemplateConfiguration | null;
};

type DocumentRecord = {
  id: number;
  referenceCode: string | null;
  categoryId: number;
  category: string;
  status: string;
  recipientName: string;
  subject: string;
  createdAt: string;
  issuedAt: string | null;
  expiresAt: string | null;
};

type OrganisationProfile = {
  officialName: string | null;
  registeredAddress: string | null;
  country: string | null;
  telephone: string | null;
  email: string | null;
  website: string | null;
  registrationInformation: string | null;
  approvedTagline: string | null;
  issuingDepartment: string | null;
  footerDisclaimer: string | null;
};

type Signatory = {
  id: number;
  fullName: string;
  position: string;
  department: string | null;
  authorisedTypeCodes: string[];
  isAuthorised: boolean;
  validFrom: string | null;
  validUntil: string | null;
};

type CentreSection = 'editor' | 'overview' | 'generate' | 'templates' | 'issued' | 'verification' | 'categories' | 'organisation' | 'audit' | 'settings';

const EMPTY_CONFIGURATION: TemplateConfiguration = {
  pageSize: 'A4',
  orientation: 'PORTRAIT',
  title: '',
  introduction: '',
  footerText: '',
  signatoryId: null,
  includeBarcode: true,
};

const EMPTY_PROFILE: OrganisationProfile = {
  officialName: '',
  registeredAddress: '',
  country: '',
  telephone: '',
  email: '',
  website: '',
  registrationInformation: '',
  approvedTagline: '',
  issuingDepartment: '',
  footerDisclaimer: '',
};

const SECTIONS: Array<{ id: CentreSection; label: string; icon: React.ReactNode }> = [
  { id: 'editor', label: 'Editor', icon: <FilePlus2 className="h-4 w-4" /> },
  { id: 'overview', label: 'Overview', icon: <FileCheck2 className="h-4 w-4" /> },
  { id: 'templates', label: 'Templates', icon: <Files className="h-4 w-4" /> },
  { id: 'issued', label: 'Issued', icon: <BadgeCheck className="h-4 w-4" /> },
  { id: 'verification', label: 'Verification', icon: <ShieldCheck className="h-4 w-4" /> },
  { id: 'categories', label: 'Categories', icon: <Settings2 className="h-4 w-4" /> },
  { id: 'organisation', label: 'Organisation', icon: <Building2 className="h-4 w-4" /> },
  { id: 'audit', label: 'Audit Trail', icon: <History className="h-4 w-4" /> },
  { id: 'settings', label: 'Settings', icon: <LockKeyhole className="h-4 w-4" /> },
];

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'The requested action could not be completed.';
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Time unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_12px_36px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-[#111315]/90 sm:p-6 ${className}`}>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
      <span>{label}</span>
      {children}
    </label>
  );
}

const controlClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-300/50 dark:border-white/10 dark:bg-[#0b0c0d] dark:text-slate-100 dark:focus:border-slate-400 dark:focus:ring-slate-500/20';
const buttonClass = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:text-slate-100 dark:hover:bg-white/5';
const primaryButtonClass = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white';

export function AdminDocumentCentre() {
  const queryClient = useQueryClient();
  const [section, setSection] = useState<CentreSection>('editor');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [profileDraft, setProfileDraft] = useState<OrganisationProfile>(EMPTY_PROFILE);
  const [typeDraft, setTypeDraft] = useState({
    typeCode: '',
    displayName: '',
    referencePrefix: '',
    isApproved: false,
    requiresApproval: true,
    publicVerification: false,
    publicRecipient: false,
  });
  const [templateDraft, setTemplateDraft] = useState({
    documentTypeId: 0,
    name: '',
    isActive: false,
    configuration: { ...EMPTY_CONFIGURATION },
  });
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [signatoryDraft, setSignatoryDraft] = useState({
    fullName: '',
    position: '',
    department: '',
    authorisedTypeCodes: '',
    isAuthorised: false,
  });
  const [documentDraft, setDocumentDraft] = useState({
    documentTypeId: 0,
    templateId: 0,
    recipientName: '',
    subject: '',
    purpose: '',
    programme: '',
    startDate: '',
    endDate: '',
    expiresAt: '',
    publicRecipientName: '',
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [registryQuery, setRegistryQuery] = useState('');
  const [registryStatus, setRegistryStatus] = useState('');
  const [registryPage, setRegistryPage] = useState(1);
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
  const [revokeReason, setRevokeReason] = useState('');

  const typesQuery = useQuery({
    queryKey: ['admin-document-types'],
    queryFn: () => apiRequest<DocumentType[]>('/admin/documents/types'),
  });
  const templatesQuery = useQuery({
    queryKey: ['admin-document-templates'],
    queryFn: () => apiRequest<DocumentTemplate[]>('/admin/documents/templates'),
  });
  const profileQuery = useQuery({
    queryKey: ['admin-document-organisation'],
    queryFn: () => apiRequest<OrganisationProfile | null>('/admin/documents/organisation'),
  });
  const signatoriesQuery = useQuery({
    queryKey: ['admin-document-signatories'],
    queryFn: () => apiRequest<Signatory[]>('/admin/documents/signatories'),
  });
  const overviewQuery = useQuery({
    queryKey: ['admin-document-overview'],
    queryFn: () => apiRequest<{
      totalIssued: number;
      awaitingApproval: number;
      valid: number;
      revoked: number;
      expired: number;
      archived: number;
      totalVerifications: number;
      categories: Array<{ name: string; count: number }>;
    }>('/admin/documents/overview'),
  });
  const registryQueryResult = useQuery({
    queryKey: ['admin-document-records', registryQuery, registryStatus, registryPage],
    queryFn: () => apiRequest<DocumentRecord[]>(
      `/admin/documents/records?page=${registryPage}&limit=20&q=${encodeURIComponent(registryQuery)}&status=${encodeURIComponent(registryStatus)}`,
    ),
    enabled: section === 'issued' || section === 'overview',
  });
  const selectedRecordQuery = useQuery({
    queryKey: ['admin-document-record', selectedRecordId],
    queryFn: () => apiRequest<Record<string, unknown>>(`/admin/documents/records/${selectedRecordId}`),
    enabled: selectedRecordId !== null,
  });
  const auditQuery = useQuery({
    queryKey: ['admin-document-audit'],
    queryFn: () => apiRequest<Array<{
      action: string;
      resourceId: string | null;
      detailsJson: string | null;
      actorUserId: number;
      actorRole: string;
      createdAt: string;
    }>>('/admin/documents/audit'),
    enabled: section === 'audit',
  });

  const types = typesQuery.data?.data ?? [];
  const templates = templatesQuery.data?.data ?? [];
  const signatories = signatoriesQuery.data?.data ?? [];
  const approvedTypes = useMemo(() => types.filter((type) => type.isApproved), [types]);
  const availableTemplates = useMemo(
    () => templates.filter((template) => template.isActive && template.documentTypeId === documentDraft.documentTypeId),
    [templates, documentDraft.documentTypeId],
  );
  const currentProfile = profileQuery.data?.data;
  const setupQueries = [typesQuery, templatesQuery, profileQuery, signatoriesQuery];
  const setupDataPending = setupQueries.some((query) => query.isPending);
  const setupDataError = setupQueries.some((query) => query.isError);
  const authorisedSignatoryFor = (typeCode: string, signatoryId?: number | null) => {
    const now = Date.now();
    return signatories.some((signatory) => {
      if (
        !signatory.isAuthorised ||
        (signatoryId != null && signatory.id !== signatoryId) ||
        !signatory.authorisedTypeCodes.includes(typeCode)
      ) return false;
      const validFrom = signatory.validFrom ? Date.parse(signatory.validFrom) : null;
      const validUntil = signatory.validUntil ? Date.parse(signatory.validUntil) : null;
      return (validFrom === null || (Number.isFinite(validFrom) && validFrom <= now)) &&
        (validUntil === null || (Number.isFinite(validUntil) && validUntil >= now));
    });
  };
  const hasAuthorisedSignatory = approvedTypes.some((type) => authorisedSignatoryFor(type.typeCode));
  const hasActiveTemplate = templates.some((template) => {
    const type = approvedTypes.find((approvedType) => approvedType.id === template.documentTypeId);
    return Boolean(
      template.isActive &&
      type &&
      template.configuration?.signatoryId &&
      authorisedSignatoryFor(type.typeCode, template.configuration.signatoryId),
    );
  });
  const readinessSteps: Array<{ label: string; section: CentreSection; ready: boolean }> = [
    { label: 'Organisation profile', section: 'organisation', ready: Boolean(currentProfile?.officialName?.trim()) },
    { label: 'Document categories', section: 'categories', ready: approvedTypes.length > 0 },
    { label: 'Authorised signatories', section: 'organisation', ready: hasAuthorisedSignatory },
    { label: 'Approved templates', section: 'templates', ready: hasActiveTemplate },
  ];
  const nextSetupStep = readinessSteps.find((step) => !step.ready);
  const issuanceReady = !setupDataPending && !setupDataError && !nextSetupStep;

  useEffect(() => {
    if (currentProfile) setProfileDraft({ ...EMPTY_PROFILE, ...currentProfile });
    else if (!profileQuery.isPending) setProfileDraft(EMPTY_PROFILE);
  }, [currentProfile, profileQuery.isPending]);

  useEffect(() => {
    if (documentDraft.documentTypeId && availableTemplates.length && !availableTemplates.some((template) => template.id === documentDraft.templateId)) {
      setDocumentDraft((current) => ({ ...current, templateId: availableTemplates[0].id }));
    }
  }, [availableTemplates, documentDraft.documentTypeId, documentDraft.templateId]);

  useEffect(() => {
    if (!previewUrl) return undefined;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const refreshDocumentData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-document-overview'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-document-records'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-document-types'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-document-templates'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-document-audit'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-document-record', selectedRecordId] }),
    ]);
  };

  const runAction = async (action: () => Promise<{ message: string }>, onSuccess?: () => void) => {
    setFeedback(null);
    try {
      const response = await action();
      setFeedback({ type: 'success', text: response.message });
      onSuccess?.();
      await refreshDocumentData();
    } catch (error) {
      setFeedback({ type: 'error', text: messageOf(error) });
    }
  };

  const saveCategory = (event: React.FormEvent) => {
    event.preventDefault();
    void runAction(
      async () => (await apiRequest<DocumentType>('/admin/documents/types', {
        method: 'POST',
        body: JSON.stringify(typeDraft),
      })),
      () => setTypeDraft({
        typeCode: '',
        displayName: '',
        referencePrefix: '',
        isApproved: false,
        requiresApproval: true,
        publicVerification: false,
        publicRecipient: false,
      }),
    );
  };

  const saveTemplate = (event: React.FormEvent) => {
    event.preventDefault();
    const url = editingTemplateId
      ? `/admin/documents/templates/${editingTemplateId}`
      : '/admin/documents/templates';
    void runAction(
      async () => (await apiRequest(url, {
        method: editingTemplateId ? 'PATCH' : 'POST',
        body: JSON.stringify(templateDraft),
      })),
      () => {
        setEditingTemplateId(null);
        setTemplateDraft({ documentTypeId: 0, name: '', isActive: false, configuration: { ...EMPTY_CONFIGURATION } });
      },
    );
  };

  const saveProfile = (event: React.FormEvent) => {
    event.preventDefault();
    void runAction(async () => (await apiRequest('/admin/documents/organisation', {
      method: 'PUT',
      body: JSON.stringify(Object.fromEntries(
        Object.entries(profileDraft).map(([key, value]) => [key, value?.trim() || null]),
      )),
    })));
  };

  const saveSignatory = (event: React.FormEvent) => {
    event.preventDefault();
    const authorisedTypeCodes = [...new Set(signatoryDraft.authorisedTypeCodes.split(',').map((code) => code.trim().toUpperCase()).filter(Boolean))];
    void runAction(
      async () => (await apiRequest('/admin/documents/signatories', {
        method: 'POST',
        body: JSON.stringify({ ...signatoryDraft, authorisedTypeCodes }),
      })),
      () => setSignatoryDraft({ fullName: '', position: '', department: '', authorisedTypeCodes: '', isAuthorised: false }),
    );
  };

  const submitDocument = async (submitForIssuance: boolean) => {
    setFeedback(null);
    setPreviewUrl(null);
    try {
      const expiresAt = documentDraft.expiresAt
        ? new Date(`${documentDraft.expiresAt}T23:59:59.000Z`).toISOString()
        : null;
      const created = await apiRequest<{ id: number }>('/admin/documents/drafts', {
        method: 'POST',
        body: JSON.stringify({
          documentTypeId: documentDraft.documentTypeId,
          templateId: documentDraft.templateId,
          recipientName: documentDraft.recipientName,
          subject: documentDraft.subject,
          publicRecipientName: documentDraft.publicRecipientName.trim() || null,
          expiresAt,
          payload: {
            purpose: documentDraft.purpose,
            programme: documentDraft.programme,
            startDate: documentDraft.startDate,
            endDate: documentDraft.endDate,
          },
        }),
      });
      let successMessage = created.message;
      if (submitForIssuance) {
        const issuance = await apiRequest(`/admin/documents/records/${created.data.id}/issue`, { method: 'POST' });
        successMessage = issuance.message;
      }
      setFeedback({ type: 'success', text: successMessage });
      setDocumentDraft((current) => ({
        ...current,
        recipientName: '',
        subject: '',
        purpose: '',
        programme: '',
        startDate: '',
        endDate: '',
        expiresAt: '',
        publicRecipientName: '',
      }));
      setSection('issued');
      setRegistryPage(1);
      await refreshDocumentData();
    } catch (error) {
      setFeedback({ type: 'error', text: messageOf(error) });
    }
  };

  const previewDocument = async (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    try {
      const expiresAt = documentDraft.expiresAt
        ? new Date(`${documentDraft.expiresAt}T23:59:59.000Z`).toISOString()
        : null;
      const blob = await apiBlob('/admin/documents/preview', {
        method: 'POST',
        body: JSON.stringify({
          documentTypeId: documentDraft.documentTypeId,
          templateId: documentDraft.templateId,
          recipientName: documentDraft.recipientName,
          subject: documentDraft.subject,
          publicRecipientName: documentDraft.publicRecipientName.trim() || null,
          expiresAt,
          payload: {
            purpose: documentDraft.purpose,
            programme: documentDraft.programme,
            startDate: documentDraft.startDate,
            endDate: documentDraft.endDate,
          },
        }),
      });
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (error) {
      setFeedback({ type: 'error', text: messageOf(error) });
    }
  };

  const downloadRecord = async (id: number, reference: string | null) => {
    try {
      const blob = await apiBlob(`/admin/documents/records/${id}/download`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reference || `document-${id}`}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setFeedback({ type: 'error', text: messageOf(error) });
    }
  };

  const updateCategory = (id: number, changes: Partial<DocumentType>) => {
    void runAction(
      async () => (await apiRequest(`/admin/documents/types/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(changes),
      })),
    );
  };

  const statusBadge = (status: string) => (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wide ${
      status === 'ISSUED' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
        : status === 'PENDING_APPROVAL' ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
          : status === 'REVOKED' ? 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
            : 'border-slate-400/30 bg-slate-400/10 text-slate-600 dark:text-slate-300'
    }`}>{status.replaceAll('_', ' ')}</span>
  );

  const overview = overviewQuery.data?.data;
  const records = registryQueryResult.data?.data ?? [];
  const meta = registryQueryResult.data?.meta;

  if (section === 'editor') {
    return <AdminDocumentEditor onBack={() => setSection('overview')} />;
  }

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-200/70 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] dark:border-white/10 dark:from-[#17191b] dark:via-[#101214] dark:to-[#080909] sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full bg-white/80 blur-3xl dark:bg-white/5" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-3xl">
            <h1 className="font-editorial text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">Document Centre</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">Controlled document issuance</p>
          </div>
          <button type="button" className={buttonClass} onClick={() => void refreshDocumentData()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </header>

      <nav aria-label="Document Centre sections" className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/70 p-2 dark:border-white/10 dark:bg-black/20">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => { setSection(item.id); setFeedback(null); }}
            aria-current={section === item.id ? 'page' : undefined}
            className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 text-xs font-semibold transition ${
              section === item.id
                ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-950'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'
            }`}
          >
            {item.icon}{item.label}
          </button>
        ))}
      </nav>

      {feedback && (
        <div role={feedback.type === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
          feedback.type === 'error'
            ? 'border-rose-500/25 bg-rose-500/5 text-rose-700 dark:text-rose-200'
            : 'border-emerald-500/25 bg-emerald-500/5 text-emerald-700 dark:text-emerald-200'
        }`}>
          {feedback.type === 'error' ? <Ban className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {(typesQuery.isError || templatesQuery.isError || overviewQuery.isError || profileQuery.isError || signatoriesQuery.isError) && (
        <p role="alert" className="rounded-xl border border-rose-500/25 bg-rose-500/5 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
          {messageOf(typesQuery.error || templatesQuery.error || overviewQuery.error || profileQuery.error || signatoriesQuery.error)}
        </p>
      )}

      {section === 'overview' && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Issued documents', overview?.totalIssued ?? 0, 'Records in the registry'],
              ['Pending approval', overview?.awaitingApproval ?? 0, 'Awaiting authorisation'],
              ['Valid documents', overview?.valid ?? 0, 'Active, non-revoked records'],
              ['Public verifications', overview?.totalVerifications ?? 0, 'Successful document checks'],
            ].map(([label, value, description]) => (
              <Panel key={String(label)} className="p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{label}</p>
                <p className="mt-3 font-editorial text-3xl font-semibold text-slate-950 dark:text-white">{Number(value).toLocaleString()}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>
              </Panel>
            ))}
          </div>
          <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <Panel>
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent activity</h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Latest document activity from the registry.</p>
                </div>
                <button className={buttonClass} type="button" onClick={() => setSection('issued')}>Open registry</button>
              </div>
              {registryQueryResult.isPending ? (
                <LoadingMessage />
              ) : records.length ? (
                <RegistryTable
                  records={records.slice(0, 6)}
                  loading={false}
                  onOpen={setSelectedRecordId}
                  onDownload={downloadRecord}
                  statusBadge={statusBadge}
                />
              ) : (
                <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">No records available yet.</p>
              )}
            </Panel>
            <Panel>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Issuance requirements</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Complete all four requirements before issuing documents.</p>
                </div>
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-800 dark:text-slate-200">
                {setupDataPending || setupDataError ? '—/4 completed' : `${readinessSteps.filter((step) => step.ready).length}/4 completed`}
              </p>
              <div className="mt-4 space-y-3">
                {readinessSteps.map((step) => (
                  <ReadinessItem
                    key={step.label}
                    label={step.label}
                    ready={step.ready}
                    pending={setupDataPending}
                    unavailable={setupDataError}
                    onSetup={() => setSection(step.section)}
                  />
                ))}
              </div>
              <p className="mt-5 text-xs font-medium text-slate-500 dark:text-slate-400">
                {issuanceReady ? 'Issuance is enabled.' : 'Complete setup to enable issuance.'}
              </p>
            </Panel>
          </div>
        </div>
      )}

      {section === 'generate' && (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
          <Panel>
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Prepare a document</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Save as a draft or send it through the category’s approval workflow. Preview is clearly marked and never receives a permanent reference.</p>
            </div>
            {!issuanceReady && (
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3">
                <p className="text-xs leading-5 text-amber-800 dark:text-amber-200">
                  {setupDataError
                    ? 'Setup checks could not be loaded. Retry before submitting a document for issuance.'
                    : 'Issuance is locked until the organisation profile, approved category, authorised signatory, and signed active template are ready.'}
                </p>
                {!setupDataError && !setupDataPending && nextSetupStep && (
                  <button type="button" className={buttonClass} onClick={() => setSection(nextSetupStep.section)}>
                    Set up {nextSetupStep.label}
                  </button>
                )}
              </div>
            )}
            <form onSubmit={previewDocument} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Approved category">
                  <select className={controlClass} value={documentDraft.documentTypeId || ''} onChange={(event) => setDocumentDraft((current) => ({ ...current, documentTypeId: Number(event.target.value), templateId: 0 }))} required>
                    <option value="">Select category</option>
                    {approvedTypes.map((type) => <option key={type.id} value={type.id}>{type.displayName}</option>)}
                  </select>
                </Field>
                <Field label="Active template">
                  <select className={controlClass} value={documentDraft.templateId || ''} onChange={(event) => setDocumentDraft((current) => ({ ...current, templateId: Number(event.target.value) }))} required disabled={!availableTemplates.length}>
                    <option value="">Select template</option>
                    {availableTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Recipient name">
                  <input className={controlClass} value={documentDraft.recipientName} onChange={(event) => setDocumentDraft((current) => ({ ...current, recipientName: event.target.value }))} maxLength={180} required />
                </Field>
                <Field label="Document subject">
                  <input className={controlClass} value={documentDraft.subject} onChange={(event) => setDocumentDraft((current) => ({ ...current, subject: event.target.value }))} maxLength={240} required />
                </Field>
              </div>
              <Field label="Purpose and authorised details">
                <textarea className={`${controlClass} min-h-28 resize-y`} value={documentDraft.purpose} onChange={(event) => setDocumentDraft((current) => ({ ...current, purpose: event.target.value }))} maxLength={6000} required />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Programme (optional)">
                  <input className={controlClass} value={documentDraft.programme} onChange={(event) => setDocumentDraft((current) => ({ ...current, programme: event.target.value }))} maxLength={180} />
                </Field>
                <Field label="Expiry date (optional)">
                  <input type="date" className={controlClass} value={documentDraft.expiresAt} onChange={(event) => setDocumentDraft((current) => ({ ...current, expiresAt: event.target.value }))} />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Start date (optional)">
                  <input type="date" className={controlClass} value={documentDraft.startDate} onChange={(event) => setDocumentDraft((current) => ({ ...current, startDate: event.target.value }))} />
                </Field>
                <Field label="End date (optional)">
                  <input type="date" className={controlClass} value={documentDraft.endDate} onChange={(event) => setDocumentDraft((current) => ({ ...current, endDate: event.target.value }))} />
                </Field>
              </div>
              {types.find((type) => type.id === documentDraft.documentTypeId)?.publicVerification && (
                <Field label="Publicly visible recipient name (optional)">
                  <input className={controlClass} value={documentDraft.publicRecipientName} onChange={(event) => setDocumentDraft((current) => ({ ...current, publicRecipientName: event.target.value }))} maxLength={180} />
                </Field>
              )}
              {documentDraft.documentTypeId && (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
                  {types.find((type) => type.id === documentDraft.documentTypeId)?.requiresApproval
                    ? 'This category requires a different authorised administrator to approve the document before it can be issued.'
                    : 'This category permits direct issuance after the server validates its approval, template and signatory settings.'}
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="submit" className={buttonClass} disabled={!documentDraft.templateId}><Eye className="h-4 w-4" /> Generate preview</button>
                <button type="button" className={buttonClass} disabled={!documentDraft.templateId} onClick={() => void submitDocument(false)}>Save draft</button>
                <button type="button" className={primaryButtonClass} disabled={!documentDraft.templateId || !issuanceReady} onClick={() => void submitDocument(true)}>Save & submit</button>
              </div>
            </form>
          </Panel>
          <Panel className="xl:sticky xl:top-5">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Document preview</h2>
            <p className="mb-4 mt-1 text-xs text-slate-500 dark:text-slate-400">A watermarked preview will appear here after you request it.</p>
            {previewUrl ? (
              <iframe title="Document preview" src={previewUrl} className="h-[72vh] min-h-[480px] w-full rounded-xl border border-slate-200 bg-white dark:border-white/10" />
            ) : (
              <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-6 text-center dark:border-white/15 dark:bg-white/[0.02]">
                <Eye className="h-8 w-8 text-slate-400" />
                <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">No preview generated</p>
                <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500 dark:text-slate-400">The PDF preview is generated from the saved organisation profile and selected template.</p>
              </div>
            )}
          </Panel>
        </div>
      )}

      {section === 'templates' && (
        <div className="grid items-start gap-5 xl:grid-cols-[0.85fr_1.15fr]">
          <Panel>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{editingTemplateId ? 'Create a template version' : 'Create a template'}</h2>
            <p className="mb-5 mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Template edits create immutable versions so previously issued records retain their original layout.</p>
            <form onSubmit={saveTemplate} className="space-y-4">
              <Field label="Document category">
                <select className={controlClass} value={templateDraft.documentTypeId || ''} disabled={editingTemplateId !== null} onChange={(event) => setTemplateDraft((current) => ({ ...current, documentTypeId: Number(event.target.value) }))} required>
                  <option value="">Select category</option>
                  {types.map((type) => <option key={type.id} value={type.id}>{type.displayName}</option>)}
                </select>
              </Field>
              <Field label="Template name">
                <input className={controlClass} value={templateDraft.name} onChange={(event) => setTemplateDraft((current) => ({ ...current, name: event.target.value }))} maxLength={120} required />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Page size">
                  <select className={controlClass} value={templateDraft.configuration.pageSize} onChange={(event) => setTemplateDraft((current) => ({ ...current, configuration: { ...current.configuration, pageSize: event.target.value as 'A4' | 'LETTER' } }))}>
                    <option value="A4">A4</option><option value="LETTER">US Letter</option>
                  </select>
                </Field>
                <Field label="Orientation">
                  <select className={controlClass} value={templateDraft.configuration.orientation} onChange={(event) => setTemplateDraft((current) => ({ ...current, configuration: { ...current.configuration, orientation: event.target.value as 'PORTRAIT' | 'LANDSCAPE' } }))}>
                    <option value="PORTRAIT">Portrait</option><option value="LANDSCAPE">Landscape</option>
                  </select>
                </Field>
              </div>
              <Field label="Printed title (optional)">
                <input className={controlClass} value={templateDraft.configuration.title} onChange={(event) => setTemplateDraft((current) => ({ ...current, configuration: { ...current.configuration, title: event.target.value } }))} maxLength={160} />
              </Field>
              <Field label="Introduction (optional)">
                <textarea className={`${controlClass} min-h-20`} value={templateDraft.configuration.introduction} onChange={(event) => setTemplateDraft((current) => ({ ...current, configuration: { ...current.configuration, introduction: event.target.value } }))} maxLength={2000} />
              </Field>
              <Field label="Footer text (optional)">
                <input className={controlClass} value={templateDraft.configuration.footerText} onChange={(event) => setTemplateDraft((current) => ({ ...current, configuration: { ...current.configuration, footerText: event.target.value } }))} maxLength={500} />
              </Field>
              <Field label="Authorised signatory">
                <select className={controlClass} value={templateDraft.configuration.signatoryId ?? ''} onChange={(event) => setTemplateDraft((current) => ({ ...current, configuration: { ...current.configuration, signatoryId: event.target.value ? Number(event.target.value) : null } }))}>
                  <option value="">No signatory</option>
                  {signatories.filter((item) => item.isAuthorised).map((item) => <option value={item.id} key={item.id}>{item.fullName} — {item.position}</option>)}
                </select>
              </Field>
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={templateDraft.configuration.includeBarcode} onChange={(event) => setTemplateDraft((current) => ({ ...current, configuration: { ...current.configuration, includeBarcode: event.target.checked } }))} />
                Include Code 128 barcode on issued documents
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={templateDraft.isActive} onChange={(event) => setTemplateDraft((current) => ({ ...current, isActive: event.target.checked }))} />
                Activate for new documents (category must be approved)
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="submit" className={primaryButtonClass}>Save template</button>
                {editingTemplateId && <button type="button" className={buttonClass} onClick={() => { setEditingTemplateId(null); setTemplateDraft({ documentTypeId: 0, name: '', isActive: false, configuration: { ...EMPTY_CONFIGURATION } }); }}>Cancel</button>}
              </div>
            </form>
          </Panel>
          <Panel>
            <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Template registry</h2>
            <div className="space-y-3">
              {templates.map((template) => (
                <article key={template.id} className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{template.name}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{template.categoryName} · Version {template.currentVersion} · {template.configuration?.pageSize ?? '—'} / {template.configuration?.orientation ?? '—'}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${template.isActive ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-slate-500/10 text-slate-600 dark:text-slate-300'}`}>{template.isActive ? 'ACTIVE' : 'INACTIVE'}</span>
                  </div>
                  <button type="button" className={`${buttonClass} mt-3`} onClick={() => {
                    setEditingTemplateId(template.id);
                    setTemplateDraft({
                      documentTypeId: template.documentTypeId,
                      name: template.name,
                      isActive: template.isActive,
                      configuration: template.configuration || { ...EMPTY_CONFIGURATION },
                    });
                    setFeedback(null);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}>Edit / new version</button>
                </article>
              ))}
              {!templates.length && <EmptyMessage text="No templates are configured. Create an approved category first, then add a template." />}
            </div>
          </Panel>
        </div>
      )}

      {section === 'issued' && (
        <Panel>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Issued document registry</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Private records with controlled, audited lifecycle actions.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input className={`${controlClass} min-w-48`} aria-label="Search documents" placeholder="Reference, recipient or subject" value={registryQuery} onChange={(event) => { setRegistryPage(1); setRegistryQuery(event.target.value); }} />
              <select className={`${controlClass} w-auto min-w-40`} aria-label="Filter by status" value={registryStatus} onChange={(event) => { setRegistryPage(1); setRegistryStatus(event.target.value); }}>
                <option value="">All statuses</option>
                {['DRAFT', 'PENDING_APPROVAL', 'ISSUED', 'REVOKED', 'ARCHIVED'].map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
              </select>
            </div>
          </div>
          <RegistryTable
            records={records}
            loading={registryQueryResult.isPending}
            onOpen={setSelectedRecordId}
            onDownload={downloadRecord}
            statusBadge={statusBadge}
            onIssue={(id) => void runAction(() => apiRequest(`/admin/documents/records/${id}/issue`, { method: 'POST' }))}
            onApprove={(id) => void runAction(() => apiRequest(`/admin/documents/records/${id}/approve`, { method: 'POST' }))}
            onRevoke={(id) => void runAction(() => apiRequest(`/admin/documents/records/${id}/revoke`, { method: 'POST', body: JSON.stringify({ reason: revokeReason }) }))}
            onArchive={(id) => void runAction(() => apiRequest(`/admin/documents/records/${id}/archive`, { method: 'POST', body: JSON.stringify({ reason: 'Archived from the Document Centre registry.' }) }))}
            onReissue={(id, typeId) => {
              const template = templates.find((item) => item.documentTypeId === typeId && item.isActive);
              if (!template) {
                setFeedback({ type: 'error', text: 'No active template is available for this document category.' });
                return;
              }
              void runAction(() => apiRequest(`/admin/documents/records/${id}/reissue`, {
                method: 'POST',
                body: JSON.stringify({ templateId: template.id }),
              }));
            }}
            revokeReason={revokeReason}
            onRevokeReasonChange={setRevokeReason}
          />
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{meta?.total ?? 0} record(s) · Page {meta?.page ?? registryPage} of {Math.max(1, meta?.totalPages ?? 1)}</span>
            <div className="flex gap-2">
              <button type="button" className={buttonClass} disabled={registryPage <= 1} onClick={() => setRegistryPage((page) => page - 1)}>Previous</button>
              <button type="button" className={buttonClass} disabled={!meta || registryPage >= (meta.totalPages ?? 1)} onClick={() => setRegistryPage((page) => page + 1)}>Next</button>
            </div>
          </div>
        </Panel>
      )}

      {section === 'verification' && (
        <Panel>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Public verification policy</h2>
          <p className="mb-5 mt-1 max-w-3xl text-xs leading-5 text-slate-500 dark:text-slate-400">
            Verification is disabled by default per category. Only explicitly enabled categories reveal a status, reference, category, issuing organisation and dates. Recipient names require a separate opt-in and are never inferred from private recipient records.
          </p>
          <div className="space-y-3">
            {types.map((type) => (
              <article key={type.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 dark:border-white/10">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{type.displayName}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{type.typeCode} · {type.referencePrefix} prefix</p>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-700 dark:text-slate-300">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={type.publicVerification} onChange={(event) => updateCategory(type.id, {
                      publicVerification: event.target.checked,
                      ...(event.target.checked ? {} : { publicRecipient: false }),
                    })} />
                    Public verification
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={type.publicRecipient} disabled={!type.publicVerification} onChange={(event) => updateCategory(type.id, { publicRecipient: event.target.checked })} />
                    Reveal recipient name
                  </label>
                </div>
              </article>
            ))}
            {!types.length && <EmptyMessage text="Create a document category before configuring public verification." />}
          </div>
        </Panel>
      )}

      {section === 'categories' && (
        <div className="grid items-start gap-5 xl:grid-cols-[0.8fr_1.2fr]">
          <Panel>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Add document category</h2>
            <p className="mb-5 mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Categories start unapproved and private. Use an authorised official type and reference prefix.</p>
            <form className="space-y-4" onSubmit={saveCategory}>
              <Field label="Type code">
                <input className={controlClass} value={typeDraft.typeCode} onChange={(event) => setTypeDraft((current) => ({ ...current, typeCode: event.target.value.toUpperCase() }))} placeholder="CERTIFICATE" required maxLength={32} />
              </Field>
              <Field label="Display name">
                <input className={controlClass} value={typeDraft.displayName} onChange={(event) => setTypeDraft((current) => ({ ...current, displayName: event.target.value }))} required maxLength={120} />
              </Field>
              <Field label="Reference prefix">
                <input className={controlClass} value={typeDraft.referencePrefix} onChange={(event) => setTypeDraft((current) => ({ ...current, referencePrefix: event.target.value.toUpperCase() }))} placeholder="CERT" required maxLength={24} />
              </Field>
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={typeDraft.requiresApproval} onChange={(event) => setTypeDraft((current) => ({ ...current, requiresApproval: event.target.checked }))} />
                Require independent approval for every document
              </label>
              <button className={primaryButtonClass} type="submit">Create private category</button>
            </form>
          </Panel>
          <Panel>
            <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Category governance</h2>
            <div className="space-y-3">
              {types.map((type) => (
                <article key={type.id} className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{type.displayName}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{type.typeCode} · Prefix {type.referencePrefix}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${type.isApproved ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>{type.isApproved ? 'APPROVED' : 'UNAPPROVED'}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-700 dark:text-slate-300">
                    <label className="flex items-center gap-2"><input type="checkbox" checked={type.isApproved} onChange={(event) => updateCategory(type.id, { isApproved: event.target.checked })} /> Approved for issuance</label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={type.requiresApproval} onChange={(event) => updateCategory(type.id, { requiresApproval: event.target.checked })} /> Independent approval required</label>
                  </div>
                </article>
              ))}
              {!types.length && <EmptyMessage text="No document categories are configured. No credentials or categories are created automatically." />}
            </div>
          </Panel>
        </div>
      )}

      {section === 'organisation' && (
        <div className="grid items-start gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <Panel>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Official organisation profile</h2>
            <p className="mb-5 mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">These details are printed on issued documents. The official legal name is required before previews or issuance are enabled.</p>
            {profileQuery.isError && <p role="alert" className="mb-4 text-sm text-rose-600">{messageOf(profileQuery.error)}</p>}
            <form className="space-y-4" onSubmit={saveProfile}>
              <Field label="Official legal name">
                <input className={controlClass} value={profileDraft.officialName || ''} onChange={(event) => setProfileDraft((current) => ({ ...current, officialName: event.target.value }))} maxLength={180} />
              </Field>
              <Field label="Registered address">
                <textarea className={`${controlClass} min-h-20`} value={profileDraft.registeredAddress || ''} onChange={(event) => setProfileDraft((current) => ({ ...current, registeredAddress: event.target.value }))} maxLength={500} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Country"><input className={controlClass} value={profileDraft.country || ''} onChange={(event) => setProfileDraft((current) => ({ ...current, country: event.target.value }))} maxLength={120} /></Field>
                <Field label="Issuing department"><input className={controlClass} value={profileDraft.issuingDepartment || ''} onChange={(event) => setProfileDraft((current) => ({ ...current, issuingDepartment: event.target.value }))} maxLength={160} /></Field>
                <Field label="Telephone"><input className={controlClass} value={profileDraft.telephone || ''} onChange={(event) => setProfileDraft((current) => ({ ...current, telephone: event.target.value }))} maxLength={80} /></Field>
                <Field label="Email"><input type="email" className={controlClass} value={profileDraft.email || ''} onChange={(event) => setProfileDraft((current) => ({ ...current, email: event.target.value }))} maxLength={255} /></Field>
                <Field label="Website"><input type="url" className={controlClass} value={profileDraft.website || ''} onChange={(event) => setProfileDraft((current) => ({ ...current, website: event.target.value }))} maxLength={255} /></Field>
                <Field label="Registration information"><input className={controlClass} value={profileDraft.registrationInformation || ''} onChange={(event) => setProfileDraft((current) => ({ ...current, registrationInformation: event.target.value }))} maxLength={255} /></Field>
              </div>
              <Field label="Approved tagline"><input className={controlClass} value={profileDraft.approvedTagline || ''} onChange={(event) => setProfileDraft((current) => ({ ...current, approvedTagline: event.target.value }))} maxLength={255} /></Field>
              <Field label="Footer disclaimer"><textarea className={`${controlClass} min-h-20`} value={profileDraft.footerDisclaimer || ''} onChange={(event) => setProfileDraft((current) => ({ ...current, footerDisclaimer: event.target.value }))} maxLength={500} /></Field>
              <button type="submit" className={primaryButtonClass}>Save official profile</button>
            </form>
          </Panel>
          <Panel>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Authorised signatories</h2>
            <p className="mb-5 mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Typed names are not cryptographic signatures. Authorisation is limited to the explicit document category codes.</p>
            <form className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-white/10" onSubmit={saveSignatory}>
              <Field label="Full name"><input className={controlClass} value={signatoryDraft.fullName} onChange={(event) => setSignatoryDraft((current) => ({ ...current, fullName: event.target.value }))} maxLength={180} required /></Field>
              <Field label="Position"><input className={controlClass} value={signatoryDraft.position} onChange={(event) => setSignatoryDraft((current) => ({ ...current, position: event.target.value }))} maxLength={160} required /></Field>
              <Field label="Department"><input className={controlClass} value={signatoryDraft.department} onChange={(event) => setSignatoryDraft((current) => ({ ...current, department: event.target.value }))} maxLength={160} /></Field>
              <Field label="Authorised type codes (comma-separated)"><input className={controlClass} value={signatoryDraft.authorisedTypeCodes} onChange={(event) => setSignatoryDraft((current) => ({ ...current, authorisedTypeCodes: event.target.value }))} placeholder="CERTIFICATE, PROGRAMME_LETTER" /></Field>
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"><input type="checkbox" checked={signatoryDraft.isAuthorised} onChange={(event) => setSignatoryDraft((current) => ({ ...current, isAuthorised: event.target.checked }))} /> Mark as authorised</label>
              <button type="submit" className={buttonClass}>Add signatory</button>
            </form>
            <div className="mt-4 space-y-2">
              {signatories.map((signatory) => (
                <article key={signatory.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 dark:border-white/10">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{signatory.fullName}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{signatory.position} · {signatory.authorisedTypeCodes.join(', ') || 'No authorised categories'}</p>
                  </div>
                  <button type="button" className={buttonClass} onClick={() => void runAction(
                    () => apiRequest(`/admin/documents/signatories/${signatory.id}`, {
                      method: 'PATCH',
                      body: JSON.stringify({ isAuthorised: !signatory.isAuthorised }),
                    }),
                  )}>{signatory.isAuthorised ? 'Disable' : 'Enable'}</button>
                </article>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {section === 'audit' && (
        <Panel>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Document audit trail</h2>
          <p className="mb-5 mt-1 text-xs text-slate-500 dark:text-slate-400">Recent document-centre actions recorded by the server, including actor role and event time.</p>
          {auditQuery.isPending ? <LoadingMessage /> : auditQuery.isError ? <p role="alert" className="text-sm text-rose-600">{messageOf(auditQuery.error)}</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400"><tr><th className="pb-3 pr-4">Action</th><th className="pb-3 pr-4">Record</th><th className="pb-3 pr-4">Actor</th><th className="pb-3 pr-4">Details</th><th className="pb-3">Time</th></tr></thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                  {(auditQuery.data?.data ?? []).map((row, index) => (
                    <tr key={`${row.action}-${row.createdAt}-${index}`} className="align-top text-slate-700 dark:text-slate-300">
                      <td className="py-3 pr-4 font-semibold">{row.action.replaceAll('_', ' ')}</td>
                      <td className="py-3 pr-4">{row.resourceId || '—'}</td>
                      <td className="py-3 pr-4">{row.actorRole} · {row.actorUserId}</td>
                      <td className="max-w-xs truncate py-3 pr-4">{row.detailsJson || '—'}</td>
                      <td className="py-3">{formatDate(row.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!auditQuery.data?.data.length && <EmptyMessage text="No document-centre audit events have been recorded yet." />}
            </div>
          )}
        </Panel>
      )}

      {section === 'settings' && (
        <Panel>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Security and operational settings</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
              <LockKeyhole className="h-5 w-5 text-slate-500 dark:text-slate-300" />
              <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">Private file storage</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Issued PDFs are stored using the configured private storage backend. They are never exposed through public media URLs and downloads are audited.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
              <ShieldCheck className="h-5 w-5 text-slate-500 dark:text-slate-300" />
              <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">Public privacy</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Public verification is category opt-in. Recipient identity remains private unless category policy and the issued record both explicitly permit disclosure.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
              <Users className="h-5 w-5 text-slate-500 dark:text-slate-300" />
              <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">Permission boundary</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Document-management access is currently restricted to Platform Administrators. Maker-checker approval is enforced independently on the server.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
              <History className="h-5 w-5 text-slate-500 dark:text-slate-300" />
              <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">Immutable issuance record</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Template versions and organisation details are snapshotted. Revocation and archiving retain the original document and status history.</p>
            </div>
          </div>
        </Panel>
      )}

      {selectedRecordId !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedRecordId(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="document-detail-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-white p-5 shadow-2xl dark:bg-[#111315] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Private registry record</p><h2 id="document-detail-title" className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">Document details</h2></div>
              <button type="button" className={buttonClass} onClick={() => setSelectedRecordId(null)}>Close</button>
            </div>
            {selectedRecordQuery.isPending ? <LoadingMessage /> : selectedRecordQuery.isError ? <p role="alert" className="mt-5 text-sm text-rose-600">{messageOf(selectedRecordQuery.error)}</p> : (
              <pre className="mt-5 whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-700 dark:bg-black/30 dark:text-slate-300">{JSON.stringify(selectedRecordQuery.data?.data, null, 2)}</pre>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function ReadinessItem({
  label,
  ready,
  pending,
  unavailable,
  onSetup,
}: {
  label: string;
  ready: boolean;
  pending: boolean;
  unavailable: boolean;
  onSetup: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3.5 py-3 dark:border-white/10">
      <span className="text-xs text-slate-600 dark:text-slate-300">{label}</span>
      <div className="flex shrink-0 items-center gap-3">
        {!pending && !unavailable && !ready && (
          <button type="button" className="text-[11px] font-semibold text-slate-700 hover:underline dark:text-slate-200" onClick={onSetup}>
            Configure
          </button>
        )}
        {ready && !pending && !unavailable && (
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
        )}
      </div>
    </div>
  );
}

function RegistryTable({
  records,
  loading,
  onOpen,
  onDownload,
  statusBadge,
  onIssue,
  onApprove,
  onRevoke,
  onArchive,
  onReissue,
  revokeReason,
  onRevokeReasonChange,
}: {
  records: DocumentRecord[];
  loading: boolean;
  onOpen: (id: number) => void;
  onDownload: (id: number, reference: string | null) => void;
  statusBadge: (status: string) => React.ReactNode;
  onIssue?: (id: number) => void;
  onApprove?: (id: number) => void;
  onRevoke?: (id: number) => void;
  onArchive?: (id: number) => void;
  onReissue?: (id: number, typeId: number) => void;
  revokeReason?: string;
  onRevokeReasonChange?: (reason: string) => void;
}) {
  if (loading) return <LoadingMessage />;
  if (!records.length) return <EmptyMessage text="No documents match this view. Saved drafts and issued records will appear here." />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] text-left text-xs">
        <thead className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <tr><th className="pb-3 pr-4">Reference</th><th className="pb-3 pr-4">Category / subject</th><th className="pb-3 pr-4">Recipient</th><th className="pb-3 pr-4">Status</th><th className="pb-3 pr-4">Created</th><th className="pb-3">Actions</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-white/10">
          {records.map((record) => {
            const expiresAt = record.expiresAt ? Date.parse(record.expiresAt) : NaN;
            const displayedStatus = record.status === 'ISSUED' && Number.isFinite(expiresAt) && expiresAt <= Date.now()
              ? 'EXPIRED'
              : record.status;
            return (
            <tr key={record.id} className="align-top text-slate-700 transition hover:bg-slate-50/70 dark:text-slate-300 dark:hover:bg-white/[0.025]">
              <td className="py-4 pr-4 font-mono text-[11px] font-semibold text-slate-900 dark:text-white">{record.referenceCode || `Draft #${record.id}`}</td>
              <td className="py-4 pr-4"><span className="font-semibold text-slate-800 dark:text-slate-100">{record.category}</span><span className="mt-1 block max-w-56 truncate text-slate-500 dark:text-slate-400">{record.subject}</span></td>
              <td className="py-4 pr-4">{record.recipientName}</td>
              <td className="py-4 pr-4">{statusBadge(displayedStatus)}</td>
              <td className="py-4 pr-4 whitespace-nowrap">{formatDate(record.createdAt)}</td>
              <td className="py-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button type="button" className={buttonClass} aria-label={`View ${record.referenceCode || 'draft'}`} onClick={() => onOpen(record.id)}><Eye className="h-3.5 w-3.5" /> View</button>
                  {record.status === 'DRAFT' && onIssue && <button type="button" className={buttonClass} onClick={() => onIssue(record.id)}><FileCheck2 className="h-3.5 w-3.5" /> Submit</button>}
                  {record.referenceCode && ['ISSUED', 'REVOKED', 'ARCHIVED', 'EXPIRED'].includes(displayedStatus) && <button type="button" className={buttonClass} onClick={() => onDownload(record.id, record.referenceCode!)}><ArrowDownToLine className="h-3.5 w-3.5" /> PDF</button>}
                  {record.status === 'PENDING_APPROVAL' && onApprove && <button type="button" className={buttonClass} onClick={() => onApprove(record.id)}><BadgeCheck className="h-3.5 w-3.5" /> Approve</button>}
                  {record.status === 'ISSUED' && onRevoke && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <input className="w-44 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-white/10 dark:bg-black/20" value={revokeReason || ''} onChange={(event) => onRevokeReasonChange?.(event.target.value)} aria-label="Revocation reason" placeholder="Reason (10+ characters)" />
                      <button type="button" className={buttonClass} disabled={(revokeReason || '').trim().length < 10} onClick={() => onRevoke(record.id)}><Ban className="h-3.5 w-3.5" /> Revoke</button>
                    </div>
                  )}
                  {['ISSUED', 'REVOKED', 'ARCHIVED', 'EXPIRED'].includes(displayedStatus) && onArchive && record.status !== 'ARCHIVED' && <button type="button" className={buttonClass} onClick={() => onArchive(record.id)}><Archive className="h-3.5 w-3.5" /> Archive</button>}
                  {['ISSUED', 'REVOKED', 'ARCHIVED', 'EXPIRED'].includes(displayedStatus) && onReissue && <button type="button" className={buttonClass} onClick={() => onReissue(record.id, record.categoryId)}><RotateCcw className="h-3.5 w-3.5" /> Reissue</button>}
                </div>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LoadingMessage() {
  return <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500 dark:text-slate-400"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading document data…</div>;
}

function EmptyMessage({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm text-slate-500 dark:border-white/15 dark:text-slate-400">{text}</div>;
}
