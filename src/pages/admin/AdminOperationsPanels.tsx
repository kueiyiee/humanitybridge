import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { apiRequest } from '../../services/api';
import { renderStoryBody } from '../../utils/storyContent';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import CharacterCount from '@tiptap/extension-character-count';

export function AdminCasesPanel() {
  const { permissions } = useAuth();
  const canVerify = permissions.includes('admin:cases:verify');
  const canAssign = permissions.includes('admin:cases:assign');
  const canViewConfidential = permissions.includes('admin:cases:confidential');
  const qc = useQueryClient();
  const [notesById, setNotesById] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [coordinatorByCase, setCoordinatorByCase] = useState<Record<number, string>>({});
  const [assignmentReasonByCase, setAssignmentReasonByCase] = useState<Record<number, string>>({});

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-cases'],
    queryFn: () =>
      apiRequest<
        Array<{
          id: number;
          referenceCode: string;
          title: string;
          publicSummary: string;
          status: string;
          isPublic: boolean;
          beneficiaryConsentObtained: boolean;
          isChildRelated: boolean;
          guardianConsentObtained: boolean;
          documents: Array<{
            id: number;
            mediaId: number | null;
            documentType: string;
            originalFilename: string;
            isConfidential: boolean;
            createdAt: string;
          }>;
          statusHistory: Array<{
            previousStatus: string | null;
            newStatus: string;
            reason: string | null;
            changedAt: string;
            changedByName: string | null;
          }>;
          urgencyLevel: string;
          affectedCount: number;
          beneficiaryFullName: string | null;
          beneficiaryAgeBand: string | null;
          beneficiaryGender: string | null;
          householdSize: number | null;
          beneficiaryPreferredLanguage: string | null;
          beneficiaryNeedsNotes: string | null;
          privateContactName: string | null;
          privateContactPhone: string | null;
          privateLocationNotes: string | null;
          coordinatorName: string | null;
          coordinatorId: number;
          categoryName: string;
          regionName: string;
        }>
      >('/admin/cases'),
  });
  const { data: usersData } = useQuery({
    queryKey: ['admin-coordinators'],
    queryFn: () => apiRequest<Array<{ id: number; displayName: string | null; role: string; status: string; region: string | null }>>('/admin/coordinators'),
    enabled: canAssign,
  });

  const decideCase = async (id: number, decision: string, publishPublicly: boolean) => {
    const notes = (notesById[id] || '').trim();
    if (notes.length < 8) {
      setFeedback('Enter at least 8 characters of case-specific review notes before deciding.');
      return;
    }
    setBusyId(id);
    setFeedback(null);
    try {
      const res = await apiRequest(`/admin/cases/${id}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({ decision, notes, publishPublicly }),
      });
      setFeedback(res.message);
      setNotesById((current) => ({ ...current, [id]: '' }));
      await qc.invalidateQueries({ queryKey: ['admin-cases'] });
      await qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'The case decision could not be saved.');
    } finally {
      setBusyId(null);
    }
  };
  const assignCoordinator = async (caseId: number) => {
    const coordinatorId = Number(coordinatorByCase[caseId]);
    const reason = (assignmentReasonByCase[caseId] || '').trim();
    if (!coordinatorId || reason.length < 8) {
      setFeedback('Select an active coordinator and enter at least 8 characters explaining the assignment.');
      return;
    }
    setBusyId(caseId);
    setFeedback(null);
    try {
      const response = await apiRequest(`/admin/cases/${caseId}/assign-coordinator`, {
        method: 'PATCH',
        body: JSON.stringify({ coordinatorId, reason }),
      });
      setFeedback(response.message);
      setAssignmentReasonByCase((current) => ({ ...current, [caseId]: '' }));
      await qc.invalidateQueries({ queryKey: ['admin-cases'] });
    } catch (actionError) {
      setFeedback(actionError instanceof Error ? actionError.message : 'Coordinator assignment could not be saved.');
    } finally {
      setBusyId(null);
    }
  };
  const openCaseEvidence = async (mediaId: number) => {
    const viewer = window.open('about:blank', '_blank');
    if (!viewer) {
      setFeedback('Allow pop-ups to open confidential case evidence.');
      return;
    }
    viewer.opener = null;
    try {
      const response = await apiRequest<{ signedUrl: string }>(`/media/private/${mediaId}/signed-url`);
      viewer.location.href = response.data.signedUrl;
    } catch (actionError) {
      viewer.close();
      setFeedback(actionError instanceof Error ? actionError.message : 'Confidential evidence could not be opened.');
    }
  };
  const cases = (data?.data || []).filter((c) =>
    (statusFilter === 'ALL' || c.status === statusFilter) &&
    (!search || `${c.referenceCode} ${c.title} ${c.regionName} ${c.coordinatorName || ''}`.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-editorial text-2xl font-semibold">Humanitarian Case Verification</h2>
      </div>
      {feedback && <p role="status" className="text-xs font-medium text-[#16865D]">{feedback}</p>}
      {isError && <p role="alert" className="text-sm text-rose-600">{error instanceof Error ? error.message : 'Case records could not be loaded.'} <button type="button" onClick={() => refetch()} className="underline">Retry</button></p>}
      <div className="flex flex-col sm:flex-row gap-3">
        <input aria-label="Search cases" type="search" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search reference, title, region or coordinator"
          className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
        <select aria-label="Filter cases by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm">
          {['ALL', 'SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED', 'VERIFIED', 'REJECTED', 'CLOSED'].map((status) =>
            <option key={status} value={status}>{status === 'ALL' ? 'All statuses' : status.replace('_', ' ')}</option>)}
        </select>
      </div>
      {isLoading && <p className="text-sm text-slate-500">Loading case records…</p>}
      {data && cases.length === 0 && <p className="rounded-xl border border-slate-200 dark:border-slate-800 p-6 text-sm text-slate-500">No cases match these filters.</p>}

      <div className="space-y-4">
        {cases.map((c) => (
          <div key={c.id} className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono-tabular text-xs font-semibold text-[#123F69] dark:text-[#00BCEB]">
                  {c.referenceCode} · {c.categoryName} · {c.regionName} · {c.urgencyLevel}
                </p>
                <h3 className="mt-1 font-editorial text-xl font-semibold">{c.title}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{c.publicSummary}</p>
                <p className="text-xs text-[#748196] mt-1">
                  Coordinator: {c.coordinatorName || 'Field Desk'} · Affected: {c.affectedCount} · Public: {c.isPublic ? 'Yes' : 'No'}
                </p>
              </div>
              <span className="font-mono-tabular text-xs font-semibold px-3 py-1 rounded bg-slate-100 dark:bg-slate-800">
                {c.status}
              </span>
            </div>

            {canViewConfidential && <div className="p-3.5 rounded-lg bg-[#F7F9FC] dark:bg-[#071324] border border-slate-200 dark:border-slate-800 text-xs space-y-1">
              <p className="font-semibold text-slate-700 dark:text-slate-200">Confidential Verification Vault (Admin Only):</p>
              <p>Beneficiary: {c.beneficiaryFullName} · {c.beneficiaryAgeBand} · {c.beneficiaryGender}</p>
              <p>Household size: {c.householdSize} · Preferred language: {c.beneficiaryPreferredLanguage || 'Not recorded'}</p>
              {c.beneficiaryNeedsNotes && <p>Priority/accessibility notes: {c.beneficiaryNeedsNotes}</p>}
              <p>Contact: {c.privateContactName} ({c.privateContactPhone})</p>
              <p>Notes: {c.privateLocationNotes}</p>
            </div>}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold">Supporting evidence:</span>
              {c.documents.length === 0 && <span className="text-slate-500">No evidence attached.</span>}
              {c.documents.map((document) => (
                <button key={document.id} type="button" disabled={!document.mediaId}
                  onClick={() => document.mediaId && openCaseEvidence(document.mediaId)}
                  className="rounded border border-slate-300 dark:border-slate-700 px-2.5 py-1 font-medium disabled:opacity-50">
                  {document.originalFilename} · {document.documentType}
                </button>
              ))}
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer font-semibold">Case history ({c.statusHistory.length})</summary>
              <ul className="mt-2 space-y-1 text-slate-500">
                {c.statusHistory.map((entry, index) => (
                  <li key={`${c.id}-${index}`}>{entry.changedByName || 'Account'} · {entry.previousStatus || 'Created'} → {entry.newStatus} · {entry.changedAt}{entry.reason ? ` · ${entry.reason}` : ''}</li>
                ))}
                {c.statusHistory.length === 0 && <li>No case history recorded.</li>}
              </ul>
            </details>
            {canAssign && <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
              <select aria-label={`Coordinator for ${c.referenceCode}`} value={coordinatorByCase[c.id] ?? String(c.coordinatorId)}
                onChange={(event) => setCoordinatorByCase((current) => ({ ...current, [c.id]: event.target.value }))}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-xs">
                {(usersData?.data || []).map((user) =>
                  <option key={user.id} value={user.id}>{user.displayName || `Coordinator ${user.id}`}</option>)}
              </select>
              <input aria-label={`Assignment reason for ${c.referenceCode}`} value={assignmentReasonByCase[c.id] || ''}
                onChange={(event) => setAssignmentReasonByCase((current) => ({ ...current, [c.id]: event.target.value }))}
                placeholder="Reason for assigning or reassigning this case"
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-xs" />
              <button type="button" disabled={busyId === c.id || !coordinatorByCase[c.id] || Number(coordinatorByCase[c.id]) === c.coordinatorId}
                onClick={() => assignCoordinator(c.id)}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold disabled:opacity-50">Assign coordinator</button>
            </div>}
            {c.isChildRelated && !c.guardianConsentObtained && (
              <p className="text-xs text-rose-600">Guardian consent is not recorded. Verification is blocked until consent is documented.</p>
            )}
            {!c.beneficiaryConsentObtained && (
              <p className="text-xs text-amber-700 dark:text-amber-300">Beneficiary consent is not recorded; this case cannot be published publicly.</p>
            )}

            {canVerify && <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Enter verification notes or information request..."
                value={notesById[c.id] || ''}
                onChange={(e) => setNotesById((p) => ({ ...p, [c.id]: e.target.value }))}
                className="flex-1 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-xs"
              />
              <div className="flex flex-wrap gap-2">
                {c.status === 'SUBMITTED' && <button
                  type="button"
                  disabled={busyId === c.id || notesById[c.id]?.trim().length < 8}
                  onClick={() => decideCase(c.id, 'UNDER_REVIEW', false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold disabled:opacity-50"
                >
                  Begin Review
                </button>}
                {c.status === 'UNDER_REVIEW' && <button
                  type="button"
                  disabled={busyId === c.id || notesById[c.id]?.trim().length < 8 || (c.isChildRelated && !c.guardianConsentObtained)}
                  onClick={() => decideCase(c.id, 'VERIFIED', false)}
                  className="px-3.5 py-2 rounded-lg bg-[#16865D] text-white text-xs font-semibold disabled:opacity-50"
                >
                  Verify Privately
                </button>}
                {c.status === 'UNDER_REVIEW' && <button
                  type="button"
                  disabled={busyId === c.id || notesById[c.id]?.trim().length < 8 || !c.beneficiaryConsentObtained || (c.isChildRelated && !c.guardianConsentObtained)}
                  onClick={() => decideCase(c.id, 'VERIFIED', true)}
                  className="px-3.5 py-2 rounded-lg bg-[#16865D] text-white text-xs font-semibold disabled:opacity-50"
                >
                  Verify & Publish
                </button>}
                {c.status === 'UNDER_REVIEW' && <button
                  type="button"
                  disabled={busyId === c.id || notesById[c.id]?.trim().length < 8}
                  onClick={() => decideCase(c.id, 'INFO_REQUESTED', false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold disabled:opacity-50"
                >
                  Request Info
                </button>}
                {c.status === 'UNDER_REVIEW' && <button
                  type="button"
                  disabled={busyId === c.id || notesById[c.id]?.trim().length < 8}
                  onClick={() => decideCase(c.id, 'REJECTED', false)}
                  className="px-3.5 py-2 rounded-lg border border-rose-300 text-rose-700 dark:text-rose-400 text-xs font-semibold disabled:opacity-50"
                >
                  Reject
                </button>}
                {c.status === 'VERIFIED' && <button type="button" disabled={busyId === c.id || notesById[c.id]?.trim().length < 8}
                  onClick={() => decideCase(c.id, 'CLOSED', false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold disabled:opacity-50">
                  Close case
                </button>}
              </div>
            </div>}
          </div>
        ))}
      </div>
    </div>
  );
}

type AdminStoryMediaDraft = { url: string; altText: string; caption: string };

type AdminStoryDraft = {
  id: number;
  title: string;
  slug: string;
  categoryId: number;
  regionName: string;
  countryName?: string | null;
  stateRegionName?: string | null;
  communityName?: string | null;
  tags?: string[];
  isFeatured?: boolean;
  internalEditorialNotes?: string | null;
  excerpt: string;
  body: string;
  coverImageUrl: string | null;
  coverAltText: string | null;
  anonymousPublication: boolean;
  isMinorSubject: boolean;
  consentStory: boolean;
  consentMedia: boolean;
  consentIdentity: boolean;
  guardianConsentRecorded: boolean;
  consentReference?: string | null;
  consentExpiresAt?: string | null;
  media: AdminStoryMediaDraft[];
};

function AdminStoryComposer({
  story,
  onCancel,
  onSaved,
}: {
  story?: AdminStoryDraft | null;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [regionName, setRegionName] = useState('');
  const [countryName, setCountryName] = useState('');
  const [stateRegionName, setStateRegionName] = useState('');
  const [communityName, setCommunityName] = useState('');
  const [tags, setTags] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [internalEditorialNotes, setInternalEditorialNotes] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [body, setBody] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [coverAltText, setCoverAltText] = useState('');
  const [anonymousPublication, setAnonymousPublication] = useState(false);
  const [isMinorSubject, setIsMinorSubject] = useState(false);
  const [consentStory, setConsentStory] = useState(false);
  const [consentMedia, setConsentMedia] = useState(false);
  const [consentIdentity, setConsentIdentity] = useState(false);
  const [guardianConsentRecorded, setGuardianConsentRecorded] = useState(false);
  const [consentReference, setConsentReference] = useState('');
  const [consentExpiresAt, setConsentExpiresAt] = useState('');
  const [media, setMedia] = useState<AdminStoryMediaDraft[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageAltInput, setImageAltInput] = useState('');
  const [imageCaptionInput, setImageCaptionInput] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadState, setUploadState] = useState('');
  const [saveStatus, setSaveStatus] = useState<'Saved' | 'Saving' | 'Unsaved'>('Saved');
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const qc = useQueryClient();
  const taxonomy = useQuery({
    queryKey: ['taxonomy'],
    queryFn: () => apiRequest<{ storyCategories: Array<{ id: number; name: string }> }>('/meta/taxonomy'),
  });
  const library = useQuery({
    queryKey: ['media-library'],
    queryFn: () => apiRequest<Array<{
      id: number;
      safeFilename: string;
      publicUrl: string;
      mimeType: string;
      sizeBytes: number;
      altText: string | null;
      usageCount: number;
    }>>('/media/library'),
    enabled: showLibrary,
  });

  useEffect(() => {
    setTitle(story?.title || '');
    setSlug(story?.slug || '');
    setSlugEdited(Boolean(story?.slug));
    setCategoryId(story ? String(story.categoryId) : '');
    setRegionName(story?.regionName || '');
    setCountryName(story?.countryName || '');
    setStateRegionName(story?.stateRegionName || '');
    setCommunityName(story?.communityName || '');
    setTags((story?.tags || []).join(', '));
    setIsFeatured(story?.isFeatured || false);
    setInternalEditorialNotes(story?.internalEditorialNotes || '');
    setExcerpt(story?.excerpt || '');
    setBody(story?.body || '');
    setCoverImageUrl(story?.coverImageUrl || '');
    setCoverAltText(story?.coverAltText || '');
    setAnonymousPublication(story?.anonymousPublication || false);
    setIsMinorSubject(story?.isMinorSubject || false);
    setConsentStory(story?.consentStory || false);
    setConsentMedia(story?.consentMedia || false);
    setConsentIdentity(story?.consentIdentity || false);
    setGuardianConsentRecorded(story?.guardianConsentRecorded || false);
    setConsentReference(story?.consentReference || '');
    setConsentExpiresAt(story?.consentExpiresAt ? story.consentExpiresAt.slice(0, 16) : '');
    setMedia(story?.media || []);
    setError(null);
  }, [story]);

  useEffect(() => {
    if (!slugEdited && title.trim()) {
      setSlug(title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 180));
    }
  }, [title, slugEdited]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false, heading: { levels: [2, 3, 4] } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer' } }),
      Image.configure({ inline: false, allowBase64: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      CharacterCount,
    ],
    content: story?.body || '',
    onUpdate: ({ editor: currentEditor }) => setBody(currentEditor.getHTML()),
  });

  useEffect(() => {
    if (editor && story && editor.getHTML() !== (story.body || '')) {
      editor.commands.setContent(story.body || '');
    }
  }, [editor, story]);

  const formatBody = (prefix: string, suffix = '') => {
    const textarea = bodyRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selection = body.slice(start, end) || 'text';
    const next = `${body.slice(0, start)}${prefix}${selection}${suffix}${body.slice(end)}`;
    setBody(next);
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + prefix.length + selection.length + suffix.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const uploadImages = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    if (files.length + media.length > 12) {
      setError('A story can include up to 12 gallery images.');
      return;
    }
    setError(null);
    for (let index = 0; index < files.length; index += 1) {
      setUploadState(`Uploading image ${index + 1} of ${files.length}…`);
      const formData = new FormData();
      formData.append('file', files[index]);
      formData.append('scope', 'PUBLIC_STORY');
      try {
        const response = await apiRequest<{ publicUrl: string | null }>('/media/upload', {
          method: 'POST',
          body: formData,
        });
        if (!response.data.publicUrl) throw new Error('The server did not return a stored media URL.');
        setMedia((current) => [...current, {
          url: response.data.publicUrl!,
          altText: files[index].name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '),
          caption: '',
        }]);
        void qc.invalidateQueries({ queryKey: ['media-library'] });
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : 'Image upload failed.');
        break;
      }
    }
    setUploadState('');
  };

  const addImageUrl = () => {
    const url = imageUrlInput.trim();
    const altText = imageAltInput.trim();
    if (!url || altText.length < 3) {
      setError('Enter an image URL and meaningful alternative text (at least 3 characters).');
      return;
    }
    if (media.length >= 12) {
      setError('A story can include up to 12 gallery images.');
      return;
    }
    setMedia((current) => [...current, { url, altText, caption: imageCaptionInput.trim() }]);
    setImageUrlInput('');
    setImageAltInput('');
    setImageCaptionInput('');
    setError(null);
  };

  const saveStory = async (saveAsDraft: boolean) => {
    setError(null);
    if (!title.trim() || !categoryId || regionName.trim().length < 2 ||
      excerpt.trim().length < 20 || body.trim().length < 80) {
      setError('Complete the title, category, region, short description, and story (at least 80 characters).');
      return;
    }
    if (!consentStory) {
      setError('Documented story publication consent is required before saving.');
      return;
    }
    if (consentReference.trim().length < 3) {
      setError('Add a consent documentation reference before saving.');
      return;
    }
    if ((coverImageUrl || media.length) && !consentMedia) {
      setError('Record media consent before attaching photographs.');
      return;
    }
    if (coverImageUrl.trim() && coverAltText.trim().length < 3) {
      setError('Add descriptive alternative text for the featured image.');
      return;
    }
    if (!anonymousPublication && !consentIdentity) {
      setError('Record identity consent or choose anonymous publication.');
      return;
    }
    if (isMinorSubject && !guardianConsentRecorded) {
      setError('Guardian consent must be recorded before saving a minor-related story.');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        title: title.trim(),
        slug: slug.trim(),
        categoryId: Number(categoryId),
        regionName: regionName.trim(),
        countryName: countryName.trim() || undefined,
        stateRegionName: stateRegionName.trim() || undefined,
        communityName: communityName.trim() || undefined,
        tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        isFeatured,
        internalEditorialNotes: internalEditorialNotes.trim() || undefined,
        excerpt: excerpt.trim(),
        body: body.trim(),
        coverImageUrl: coverImageUrl.trim() || undefined,
        coverAltText: coverAltText.trim() || undefined,
        anonymousPublication,
        isMinorSubject,
        consentStory,
        consentMedia,
        consentIdentity,
        guardianConsentRecorded,
        consentReference: consentReference.trim() || undefined,
        consentExpiresAt: consentExpiresAt ? new Date(consentExpiresAt).toISOString() : undefined,
        saveAsDraft,
        media,
      };
      const response = await apiRequest<{ id: number; status: string }>(
        story ? `/admin/stories/${story.id}` : '/admin/stories',
        { method: story ? 'PATCH' : 'POST', body: JSON.stringify(payload) },
      );
      onSaved(response.message);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The story could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!story || !title.trim() || !categoryId || !regionName.trim() || !slug.trim()) return;
    setSaveStatus('Unsaved');
    const timeout = window.setTimeout(async () => {
      setSaveStatus('Saving');
      try {
        await apiRequest(`/admin/stories/${story.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            title: title.trim(),
            slug: slug.trim(),
            categoryId: Number(categoryId),
            regionName: regionName.trim(),
            countryName: countryName.trim() || undefined,
            stateRegionName: stateRegionName.trim() || undefined,
            communityName: communityName.trim() || undefined,
            tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
            isFeatured,
            internalEditorialNotes: internalEditorialNotes.trim() || undefined,
            excerpt: excerpt.trim(),
            body: body.trim(),
            coverImageUrl: coverImageUrl.trim() || undefined,
            coverAltText: coverAltText.trim() || undefined,
            anonymousPublication,
            isMinorSubject,
            consentStory,
            consentMedia,
            consentIdentity,
            guardianConsentRecorded,
            consentReference: consentReference.trim() || undefined,
            consentExpiresAt: consentExpiresAt ? new Date(consentExpiresAt).toISOString() : undefined,
            saveAsDraft: true,
            media,
          }),
        });
        setSaveStatus('Saved');
        void qc.invalidateQueries({ queryKey: ['admin-stories'] });
      } catch (autosaveError) {
        setSaveStatus('Unsaved');
        setError(autosaveError instanceof Error ? autosaveError.message : 'Autosave failed.');
      }
    }, 4000);
    return () => window.clearTimeout(timeout);
  }, [title, slug, categoryId, regionName, countryName, stateRegionName, communityName, tags, isFeatured,
    internalEditorialNotes, excerpt, body, coverImageUrl, coverAltText, anonymousPublication, isMinorSubject,
    consentStory, consentMedia, consentIdentity, guardianConsentRecorded, consentReference, consentExpiresAt, media, story, qc]);

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-[#0D223D]/90 p-5 sm:p-7 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">HumanityBridge Editorial</p>
          <h3 className="mt-1 font-editorial text-2xl font-semibold">{story ? 'Edit story' : 'Create a story'}</h3>
          <p className="mt-1 text-sm text-slate-500">
            Drafts and submissions stay private until approved and published.
          </p>
          <p className="mt-2 text-xs font-semibold text-slate-500" role="status">
            {saveStatus === 'Saved' ? 'All changes saved' : saveStatus === 'Saving' ? 'Saving changes…' : 'Unsaved changes'}
          </p>
        </div>
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm">
          Close
        </button>
      </div>
      {error && <p role="alert" className="rounded-lg bg-rose-50 dark:bg-rose-950/30 p-3 text-sm text-rose-700 dark:text-rose-300">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium sm:col-span-2">Story title
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required
            className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5" />
        </label>
        <label className="text-sm font-medium sm:col-span-2">Permanent URL slug
          <div className="mt-1 flex items-center rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden">
            <span className="px-3 text-xs text-slate-500">/stories/</span>
            <input value={slug} onChange={(event) => { setSlugEdited(true); setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 180)); }}
              className="min-w-0 flex-1 bg-transparent px-2 py-2.5 outline-none" />
          </div>
        </label>
        <label className="text-sm font-medium">Category
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required
            className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5">
            <option value="">Select a category</option>
            {(taxonomy.data?.data?.storyCategories || []).map((category) =>
              <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">Community / region
          <input value={regionName} onChange={(event) => setRegionName(event.target.value)} maxLength={120} required
            className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5" />
        </label>
        <label className="text-sm font-medium">Country
          <input value={countryName} onChange={(event) => setCountryName(event.target.value)} maxLength={120}
            className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5" />
        </label>
        <label className="text-sm font-medium">State / province
          <input value={stateRegionName} onChange={(event) => setStateRegionName(event.target.value)} maxLength={120}
            className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5" />
        </label>
        <label className="text-sm font-medium">Community
          <input value={communityName} onChange={(event) => setCommunityName(event.target.value)} maxLength={120}
            className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5" />
        </label>
        <label className="text-sm font-medium">Tags
          <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="water, maternal care, resilience"
            className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5" />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
          <input type="checkbox" checked={isFeatured} onChange={(event) => setIsFeatured(event.target.checked)} />
          Feature this story on public editorial surfaces
        </label>
        <label className="text-sm font-medium sm:col-span-2">Short description
          <textarea value={excerpt} onChange={(event) => setExcerpt(event.target.value)} minLength={20} maxLength={400} rows={2}
            className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5" />
        </label>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="mr-2 text-sm font-medium">Story editor</span>
          {[
            ['Bold', () => editor?.chain().focus().toggleBold().run(), 'font-bold'],
            ['Italic', () => editor?.chain().focus().toggleItalic().run(), 'italic'],
            ['H2', () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), ''],
            ['H3', () => editor?.chain().focus().toggleHeading({ level: 3 }).run(), ''],
            ['Quote', () => editor?.chain().focus().toggleBlockquote().run(), ''],
            ['List', () => editor?.chain().focus().toggleBulletList().run(), ''],
            ['Ordered', () => editor?.chain().focus().toggleOrderedList().run(), ''],
            ['Link', () => {
              const url = window.prompt('Link URL');
              if (url) editor?.chain().focus().setLink({ href: url }).run();
            }, ''],
            ['Undo', () => editor?.chain().focus().undo().run(), ''],
            ['Redo', () => editor?.chain().focus().redo().run(), ''],
          ].map(([label, action, style]) => (
            <button key={String(label)} type="button" onClick={() => (action as () => void)()}
              className={`rounded-md border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs ${String(style)}`}>
              {String(label)}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-500">
            {editor?.storage.characterCount.words() || 0} words · ~{Math.max(1, Math.ceil((editor?.storage.characterCount.words() || 0) / 200))} min
          </span>
        </div>
        <EditorContent editor={editor} aria-label="Story content"
          className="min-h-64 rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-3 text-sm leading-7 [&_.tiptap]:min-h-56 [&_.tiptap]:outline-none [&_.tiptap_h2]:text-xl [&_.tiptap_h3]:text-lg [&_.tiptap_blockquote]:border-l-2 [&_.tiptap_blockquote]:pl-3" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium sm:col-span-2">Featured image URL
          <input value={coverImageUrl} onChange={(event) => setCoverImageUrl(event.target.value)}
            placeholder="Paste an HTTPS image URL or select from the media library"
            className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5" />
        </label>
        <label className="text-sm font-medium sm:col-span-2">Featured image description (alt text)
          <input value={coverAltText} onChange={(event) => setCoverAltText(event.target.value)} maxLength={255}
            className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5" />
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <label className="cursor-pointer rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm">
            Upload gallery images
            <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={(event) => void uploadImages(event)} className="sr-only" />
          </label>
          <button type="button" onClick={() => setShowLibrary((current) => !current)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm">
            {showLibrary ? 'Hide media library' : 'Browse media library'}
          </button>
          {uploadState && <span role="status" className="self-center text-xs text-slate-500">{uploadState}</span>}
        </div>
        {showLibrary && (
          <div className="grid max-h-56 gap-2 overflow-auto sm:col-span-2 sm:grid-cols-2">
            {(library.data?.data || []).map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-xs">
                <span className="truncate">{item.altText || item.safeFilename} · {item.usageCount} uses</span>
                <div className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => { setCoverImageUrl(item.publicUrl); setCoverAltText(item.altText || 'Humanitarian story photograph'); }} className="underline">Featured</button>
                  <button type="button" onClick={() => setMedia((current) => [...current, {
                    url: item.publicUrl, altText: item.altText || 'Humanitarian story photograph', caption: '',
                  }])} className="underline">Gallery</button>
                </div>
              </div>
            ))}
            {!library.isLoading && !(library.data?.data || []).length && <p className="text-xs text-slate-500">No previously uploaded images are available.</p>}
          </div>
        )}
        <div className="grid gap-2 sm:col-span-2 sm:grid-cols-[2fr_1.5fr_1.5fr_auto]">
          <input value={imageUrlInput} onChange={(event) => setImageUrlInput(event.target.value)}
            placeholder="Additional image HTTPS URL" aria-label="Additional image URL"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm" />
          <input value={imageAltInput} onChange={(event) => setImageAltInput(event.target.value)}
            placeholder="Image description (alt text)" aria-label="Image alternative text"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm" />
          <input value={imageCaptionInput} onChange={(event) => setImageCaptionInput(event.target.value)}
            placeholder="Caption (optional)" aria-label="Image caption"
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm" />
          <button type="button" onClick={addImageUrl} className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm">Add image</button>
        </div>
        {media.length > 0 && (
          <div className="space-y-2 sm:col-span-2">
            {media.map((image, index) => (
              <div key={`${image.url}-${index}`} className="grid gap-2 sm:grid-cols-[2fr_1.5fr_1.5fr_auto]">
                <input value={image.url} readOnly aria-label={`Gallery image URL ${index + 1}`}
                  className="min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 text-xs" />
                <input value={image.altText} onChange={(event) => setMedia((current) => current.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, altText: event.target.value } : item))}
                  aria-label={`Alternative text for gallery image ${index + 1}`}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 text-xs" />
                <input value={image.caption} onChange={(event) => setMedia((current) => current.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, caption: event.target.value } : item))}
                  aria-label={`Caption for gallery image ${index + 1}`}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 text-xs" />
                <div className="flex gap-1">
                  <button type="button" disabled={index === 0} onClick={() => setMedia((current) => {
                    const next = [...current];
                    [next[index - 1], next[index]] = [next[index], next[index - 1]];
                    return next;
                  })} className="rounded-lg border border-slate-300 px-2 py-2 text-xs disabled:opacity-40" aria-label={`Move gallery image ${index + 1} up`}>Up</button>
                  <button type="button" disabled={index === media.length - 1} onClick={() => setMedia((current) => {
                    const next = [...current];
                    [next[index], next[index + 1]] = [next[index + 1], next[index]];
                    return next;
                  })} className="rounded-lg border border-slate-300 px-2 py-2 text-xs disabled:opacity-40" aria-label={`Move gallery image ${index + 1} down`}>Down</button>
                  <button type="button" onClick={() => setMedia((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    className="rounded-lg border border-rose-300 px-2 py-2 text-xs text-rose-700">Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <label className="text-sm font-medium">Internal editorial notes
        <textarea value={internalEditorialNotes} onChange={(event) => setInternalEditorialNotes(event.target.value)}
          maxLength={4000} rows={3} placeholder="Private reviewer guidance, sourcing or follow-up notes"
          className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5" />
      </label>

      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <label className="flex items-start gap-2"><input type="checkbox" checked={consentStory} onChange={(event) => setConsentStory(event.target.checked)} />
          <span>Documented consent for this story is recorded.</span>
        </label>
        <label className="flex items-start gap-2"><input type="checkbox" checked={consentMedia} onChange={(event) => setConsentMedia(event.target.checked)} />
          <span>Documented consent for attached media is recorded.</span>
        </label>
        <label className="flex items-start gap-2"><input type="checkbox" checked={anonymousPublication} onChange={(event) => setAnonymousPublication(event.target.checked)} />
          <span>Protect the subject's identity in public.</span>
        </label>
        <label className="flex items-start gap-2"><input type="checkbox" checked={consentIdentity} onChange={(event) => setConsentIdentity(event.target.checked)} />
          <span>Documented identity consent is recorded for named publication.</span>
        </label>
        <label className="flex items-start gap-2"><input type="checkbox" checked={isMinorSubject} onChange={(event) => setIsMinorSubject(event.target.checked)} />
          <span>This story includes a person under 18.</span>
        </label>
        {isMinorSubject && <label className="flex items-start gap-2"><input type="checkbox" checked={guardianConsentRecorded} onChange={(event) => setGuardianConsentRecorded(event.target.checked)} />
          <span>Guardian consent is documented.</span>
        </label>}
        <label className="text-sm font-medium">Consent documentation reference
          <input value={consentReference} onChange={(event) => setConsentReference(event.target.value)} maxLength={180}
            placeholder="Consent form or case reference"
            className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2" />
        </label>
        <label className="text-sm font-medium">Consent expiry
          <input type="datetime-local" value={consentExpiresAt} onChange={(event) => setConsentExpiresAt(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2" />
        </label>
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 dark:border-slate-700 pt-4">
        <button type="button" disabled={busy || Boolean(uploadState)} onClick={() => void saveStory(true)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">Save draft</button>
        <button type="button" disabled={busy || Boolean(uploadState)} onClick={() => void saveStory(false)}
          className="rounded-lg bg-[#151515] dark:bg-white px-4 py-2.5 text-sm font-semibold text-white dark:text-[#151515] disabled:opacity-50">
          {busy ? 'Saving…' : 'Submit for review'}
        </button>
      </div>
    </section>
  );
}

export function AdminStoriesPanel() {
  const { permissions } = useAuth();
  const canPublishStories = permissions.includes('admin:stories:publish');
  const qc = useQueryClient();
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingStory, setEditingStory] = useState<AdminStoryDraft | null>(null);
  const [translationPreview, setTranslationPreview] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [notesById, setNotesById] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin-stories'],
    queryFn: () =>
      apiRequest<
        Array<{
          id: number;
          slug: string;
          title: string;
          categoryId: number;
          countryName: string | null;
          stateRegionName: string | null;
          communityName: string | null;
          tags: string[];
          isFeatured: boolean;
          internalEditorialNotes: string | null;
          excerpt: string;
          body: string;
          categoryName: string;
          authorName: string | null;
          regionName: string;
          status: string;
          anonymousPublication: boolean;
          isMinorSubject: boolean;
          consentStory: boolean;
          consentMedia: boolean;
          consentIdentity: boolean;
          withdrawnAt: string | null;
          guardianConsentRecorded: boolean;
          consentReference: string | null;
          consentExpiresAt: string | null;
          coverImageUrl: string | null;
          coverAltText: string | null;
          media: AdminStoryMediaDraft[];
          versionCount: number;
          createdAt: string;
          reviewHistory: Array<{
            decision: string;
            editorialNotes: string | null;
            reviewedAt: string;
            reviewerName: string | null;
          }>;
        }>
      >('/admin/stories'),
  });

  const moderateStory = async (id: number, decision: string) => {
    const editorialNotes = (notesById[id] || '').trim();
    if (editorialNotes.length < 8) {
      setFeedback('Enter at least 8 characters of story-specific editorial notes.');
      return;
    }
    setBusyId(id);
    setFeedback(null);
    const scheduledFor = decision === 'SCHEDULED'
      ? window.prompt('Enter the future publication date and time (ISO format)', new Date(Date.now() + 24 * 3600 * 1000).toISOString())
      : null;
    if (decision === 'SCHEDULED' && !scheduledFor) {
      setBusyId(null);
      return;
    }
    try {
      const response = await apiRequest(`/admin/stories/${id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ decision, editorialNotes, ...(scheduledFor ? { scheduledFor } : {}) }),
      });
      setFeedback(response.message);
      setNotesById((current) => ({ ...current, [id]: '' }));
      await qc.invalidateQueries({ queryKey: ['admin-stories'] });
    } catch (actionError) {
      setFeedback(actionError instanceof Error ? actionError.message : 'The moderation decision could not be saved.');
    } finally {
      setBusyId(null);
    }
  };

  const requestTranslationDraft = async (id: number, targetLocale: string) => {
    setFeedback(null);
    try {
      const res = await apiRequest<{ translatedTitle: string; translatedExcerpt: string; providerStatus: string }>(
        `/admin/stories/${id}/translate-draft`,
        { method: 'POST', body: JSON.stringify({ targetLocale }) },
      );
      setTranslationPreview(
        `Draft (${targetLocale.toUpperCase()} · Human review required): ${res.data.translatedTitle} — ${res.data.translatedExcerpt}`,
      );
    } catch (actionError) {
      setFeedback(actionError instanceof Error ? actionError.message : 'Translation draft could not be prepared.');
    }
  };

  const stories = (data?.data || []).filter((story) =>
    (statusFilter === 'ALL' || story.status === statusFilter) &&
    (!search || `${story.title} ${story.regionName} ${story.categoryName} ${story.authorName || ''}`.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-editorial text-2xl font-semibold">Story Publishing & Moderation</h2>
          <p className="mt-1 text-sm text-slate-500">Create, review, publish and withdraw consent-cleared stories.</p>
        </div>
        <button type="button" onClick={() => { setEditingStory(null); setComposerOpen((current) => !current); }}
          className="rounded-lg bg-[#151515] dark:bg-white px-4 py-2.5 text-sm font-semibold text-white dark:text-[#151515]">
          {composerOpen ? 'Close composer' : 'Create story'}
        </button>
      </div>
      {feedback && <p role="status" className="text-sm text-[#16865D]">{feedback}</p>}
      {isError && <p role="alert" className="text-sm text-rose-600">{error instanceof Error ? error.message : 'Stories could not be loaded.'}</p>}
      {composerOpen && (
        <AdminStoryComposer
          story={editingStory}
          onCancel={() => { setComposerOpen(false); setEditingStory(null); }}
          onSaved={(message) => {
            setFeedback(message);
            setComposerOpen(false);
            setEditingStory(null);
            void qc.invalidateQueries({ queryKey: ['admin-stories'] });
            void qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
          }}
        />
      )}
      {translationPreview && (
        <div className="p-4 rounded-xl bg-white dark:bg-[#0D223D] border border-[#00BCEB] text-xs">{translationPreview}</div>
      )}
      <div className="flex flex-col sm:flex-row gap-3">
        <input aria-label="Search stories" type="search" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title, author, category or region"
          className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
        <select aria-label="Filter stories by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm">
          {['ALL', 'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUESTED', 'RESUBMITTED', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'UNPUBLISHED', 'REJECTED', 'ARCHIVED', 'WITHDRAWN'].map((status) =>
            <option key={status} value={status}>{status === 'ALL' ? 'All statuses' : status.replace('_', ' ')}</option>)}
        </select>
      </div>
      {isLoading && <p className="text-sm text-slate-500">Loading story submissions…</p>}
      {!isLoading && stories.length === 0 && <p className="rounded-xl border border-slate-200 dark:border-slate-800 p-6 text-sm text-slate-500">No stories match these filters.</p>}
      <div className="space-y-4">
        {stories.map((s) => (
          <div key={s.id} className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div>
              <p className="text-xs text-[#748196]">{s.regionName} · {s.categoryName} · {s.authorName || 'Author not listed'} · Status: <span className="font-semibold">{s.status}</span></p>
              <h3 className="mt-1 font-editorial text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{s.excerpt}</p>
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer font-semibold">Review full story and media</summary>
                <p className="mt-2 whitespace-pre-wrap text-slate-600 dark:text-slate-300">{s.body}</p>
                {s.coverImageUrl && <img src={s.coverImageUrl} alt={`Featured story image for ${s.title}`} className="mt-3 max-h-64 rounded-lg object-cover" />}
                {s.media.map((image, index) => (
                  <figure key={`${s.id}-${index}`} className="mt-3 inline-block mr-3 max-w-xs">
                    <img src={image.url} alt={image.altText} className="max-h-48 rounded-lg object-cover" />
                    {image.caption && <figcaption className="mt-1 text-xs text-slate-500">{image.caption}</figcaption>}
                  </figure>
                ))}
              </details>
              <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">
                Narrative consent: {s.consentStory && !s.withdrawnAt ? 'Active' : 'Missing or withdrawn'} · Media consent: {s.consentMedia ? 'Recorded' : 'Missing'} ·
                Identity consent: {s.consentIdentity ? 'Recorded' : 'Missing'} ·
                {s.isMinorSubject ? ` Guardian consent: ${s.guardianConsentRecorded ? 'Recorded' : 'MISSING'}` : ' Adult subject'}
                · {s.versionCount} saved version{s.versionCount === 1 ? '' : 's'}
              </p>
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer font-semibold">Moderation history ({s.reviewHistory.length})</summary>
                <ul className="mt-2 space-y-1 text-slate-500">
                  {s.reviewHistory.map((review, index) => (
                    <li key={`${s.id}-${index}`}>{review.reviewerName || 'Reviewer'} · {review.decision} · {review.reviewedAt}{review.editorialNotes ? ` · ${review.editorialNotes}` : ''}</li>
                  ))}
                  {s.reviewHistory.length === 0 && <li>No moderation decisions recorded.</li>}
                </ul>
              </details>
            </div>
            <textarea aria-label={`Editorial notes for ${s.title}`} rows={2}
              placeholder="Record the reason for this review decision (required)"
              value={notesById[s.id] || ''}
              onChange={(event) => setNotesById((current) => ({ ...current, [s.id]: event.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
            <div className="flex flex-wrap gap-2">
              {!['REJECTED', 'ARCHIVED'].includes(s.status) && (
                <button type="button" onClick={() => {
                  setEditingStory({
                    id: s.id,
                    title: s.title,
                    slug: s.slug,
                    categoryId: s.categoryId,
                    regionName: s.regionName,
                    countryName: s.countryName,
                    stateRegionName: s.stateRegionName,
                    communityName: s.communityName,
                    tags: s.tags,
                    isFeatured: s.isFeatured,
                    internalEditorialNotes: s.internalEditorialNotes,
                    excerpt: s.excerpt,
                    body: s.body,
                    coverImageUrl: s.coverImageUrl,
                    coverAltText: s.coverAltText,
                    anonymousPublication: s.anonymousPublication,
                    isMinorSubject: s.isMinorSubject,
                    consentStory: s.consentStory,
                    consentMedia: s.consentMedia,
                    consentIdentity: s.consentIdentity,
                    guardianConsentRecorded: s.guardianConsentRecorded,
                    consentReference: s.consentReference,
                    consentExpiresAt: s.consentExpiresAt,
                    media: s.media,
                  });
                  setComposerOpen(true);
                }} className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold">
                  Edit story
                </button>
              )}
              {['SUBMITTED', 'DRAFT', 'RESUBMITTED'].includes(s.status) && (
                <button type="button" disabled={busyId === s.id || notesById[s.id]?.trim().length < 8}
                  onClick={() => moderateStory(s.id, 'UNDER_REVIEW')}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold disabled:opacity-50">Begin review</button>
              )}
              {s.status === 'UNDER_REVIEW' && (
                <button type="button" disabled={busyId === s.id || notesById[s.id]?.trim().length < 8}
                  onClick={() => moderateStory(s.id, 'APPROVED')}
                  className="px-3.5 py-2 rounded-lg bg-[#16865D] text-white text-xs font-semibold disabled:opacity-50">Approve for publication</button>
              )}
              {canPublishStories && s.status === 'APPROVED' && (
                <>
                  <button type="button" disabled={busyId === s.id || notesById[s.id]?.trim().length < 8}
                    onClick={() => moderateStory(s.id, 'SCHEDULED')}
                    className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold disabled:opacity-50">Schedule publication</button>
                  <button type="button" disabled={busyId === s.id || notesById[s.id]?.trim().length < 8}
                    onClick={() => moderateStory(s.id, 'PUBLISHED')}
                    className="px-3.5 py-2 rounded-lg bg-[#16865D] text-white text-xs font-semibold disabled:opacity-50">Publish story</button>
                </>
              )}
              {['SUBMITTED', 'UNDER_REVIEW'].includes(s.status) && (
                <button type="button" disabled={busyId === s.id || notesById[s.id]?.trim().length < 8}
                  onClick={() => moderateStory(s.id, 'REVISION_REQUESTED')}
                  className="px-3.5 py-2 rounded-lg border border-amber-400 text-amber-800 dark:text-amber-300 text-xs font-semibold disabled:opacity-50">Request revision</button>
              )}
              {['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'].includes(s.status) && (
                <button type="button" disabled={busyId === s.id || notesById[s.id]?.trim().length < 8}
                  onClick={() => moderateStory(s.id, 'REJECTED')}
                  className="px-3.5 py-2 rounded-lg border border-rose-300 text-rose-700 dark:text-rose-400 text-xs font-semibold disabled:opacity-50">Reject</button>
              )}
              {canPublishStories && s.status === 'PUBLISHED' && (
                <button type="button" disabled={busyId === s.id || notesById[s.id]?.trim().length < 8}
                  onClick={() => moderateStory(s.id, 'UNPUBLISHED')}
                  className="px-3.5 py-2 rounded-lg border border-amber-400 text-amber-800 dark:text-amber-300 text-xs font-semibold disabled:opacity-50">Unpublish</button>
              )}
              {s.status === 'UNPUBLISHED' && (
                <button type="button" disabled={busyId === s.id || notesById[s.id]?.trim().length < 8}
                  onClick={() => moderateStory(s.id, 'SUBMITTED')}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold disabled:opacity-50">Resubmit for review</button>
              )}
              {s.status === 'REVISION_REQUESTED' && (
                <button type="button" disabled={busyId === s.id || notesById[s.id]?.trim().length < 8}
                  onClick={() => moderateStory(s.id, 'RESUBMITTED')}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold disabled:opacity-50">Resubmit revision</button>
              )}
              {canPublishStories && s.status === 'SCHEDULED' && (
                <button type="button" disabled={busyId === s.id || notesById[s.id]?.trim().length < 8}
                  onClick={() => moderateStory(s.id, 'PUBLISHED')}
                  className="px-3.5 py-2 rounded-lg bg-[#16865D] text-white text-xs font-semibold disabled:opacity-50">Publish now</button>
              )}
              {canPublishStories && ['PUBLISHED', 'SCHEDULED'].includes(s.status) && (
                <button type="button" disabled={busyId === s.id}
                  onClick={async () => {
                    const reason = window.prompt('Reason for withdrawing consent');
                    if (!reason || reason.trim().length < 8) return;
                    setBusyId(s.id);
                    try {
                      const response = await apiRequest(`/admin/stories/${s.id}/consent/withdraw`, {
                        method: 'PATCH',
                        body: JSON.stringify({ reason: reason.trim() }),
                      });
                      setFeedback(response.message);
                      await qc.invalidateQueries({ queryKey: ['admin-stories'] });
                    } catch (withdrawError) {
                      setFeedback(withdrawError instanceof Error ? withdrawError.message : 'Consent could not be withdrawn.');
                    } finally {
                      setBusyId(null);
                    }
                  }}
                  className="px-3.5 py-2 rounded-lg border border-rose-300 text-rose-700 dark:text-rose-400 text-xs font-semibold disabled:opacity-50">Withdraw consent</button>
              )}
              {s.status === 'PUBLISHED' && (
                <button type="button" disabled={busyId === s.id || notesById[s.id]?.trim().length < 8}
                  onClick={() => moderateStory(s.id, 'ARCHIVED')}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold disabled:opacity-50">Archive</button>
              )}
              <button type="button" onClick={() => requestTranslationDraft(s.id, 'ar')}
                className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold">
                Draft Arabic Translation
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminCampaignsPanel() {
  const { permissions } = useAuth();
  const canManageCampaigns = permissions.includes('admin:campaigns:manage');
  const canAssignCampaigns = permissions.includes('admin:campaigns:assign');
  const canApproveCampaigns = permissions.includes('admin:campaigns:approve');
  const canPublishCampaigns = permissions.includes('admin:campaigns:publish');
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [coordinatorId, setCoordinatorId] = useState('');
  const [assignmentReason, setAssignmentReason] = useState('');
  const [coordinatorByCampaign, setCoordinatorByCampaign] = useState<Record<number, string>>({});
  const [assignmentReasonByCampaign, setAssignmentReasonByCampaign] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin-campaigns'],
    queryFn: () =>
      apiRequest<Array<{
        id: number; title: string; targetAmount: number; raisedAmount: number; status: string;
        coordinatorId: number | null; coordinatorName: string | null;
      }>>(
        '/admin/campaigns',
      ),
  });
  const { data: coordinatorsData } = useQuery({
    queryKey: ['admin-coordinators'],
    queryFn: () => apiRequest<Array<{ id: number; displayName: string | null; role: string; status: string; region: string | null }>>('/admin/coordinators'),
    enabled: canAssignCampaigns,
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      const res = await apiRequest('/admin/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          title,
          summary,
          description,
          targetAmount: Number(targetAmount),
          startDate: new Date(`${startDate}T00:00:00.000Z`).toISOString(),
          endDate: new Date(`${endDate}T00:00:00.000Z`).toISOString(),
          coverImageUrl: coverImageUrl.trim() || undefined,
          coordinatorId: coordinatorId ? Number(coordinatorId) : undefined,
          assignmentReason: assignmentReason.trim() || undefined,
        }),
      });
      setMsg(res.message);
      setTitle('');
      setSummary('');
      setDescription('');
      setTargetAmount('');
      setStartDate('');
      setEndDate('');
      setCoverImageUrl('');
      setCoordinatorId('');
      setAssignmentReason('');
      await qc.invalidateQueries({ queryKey: ['admin-campaigns'] });
    } catch (actionError) {
      setMsg(actionError instanceof Error ? actionError.message : 'Campaign draft could not be saved.');
    }
  };

  const toggleStatus = async (id: number, status: string) => {
    setBusyId(id);
    setMsg(null);
    try {
      const response = await apiRequest(`/admin/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setMsg(response.message);
      await qc.invalidateQueries({ queryKey: ['admin-campaigns'] });
    } catch (actionError) {
      setMsg(actionError instanceof Error ? actionError.message : 'Campaign status could not be changed.');
    } finally {
      setBusyId(null);
    }
  };

  const assignCampaignCoordinator = async (campaignId: number) => {
    const selectedCoordinator = Number(coordinatorByCampaign[campaignId]);
    const reason = (assignmentReasonByCampaign[campaignId] || '').trim();
    if (!selectedCoordinator || reason.length < 8) {
      setMsg('Select an active coordinator and enter at least 8 characters explaining the assignment.');
      return;
    }
    setBusyId(campaignId);
    setMsg(null);
    try {
      const response = await apiRequest(`/admin/campaigns/${campaignId}/assign-coordinator`, {
        method: 'PATCH',
        body: JSON.stringify({ coordinatorId: selectedCoordinator, assignmentReason: reason }),
      });
      setMsg(response.message);
      setAssignmentReasonByCampaign((current) => ({ ...current, [campaignId]: '' }));
      await qc.invalidateQueries({ queryKey: ['admin-campaigns'] });
    } catch (actionError) {
      setMsg(actionError instanceof Error ? actionError.message : 'Campaign assignment could not be saved.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {canManageCampaigns && <form onSubmit={handleCreate} className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <h2 className="font-editorial text-xl font-semibold">Create Campaign Draft</h2>
        {msg && <p role="status" className="text-xs text-[#16865D]">{msg}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <input required minLength={6} maxLength={180} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Campaign title" className="sm:col-span-2 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
          <input required type="number" min="0.01" step="0.01" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} placeholder="Funding target (USD)" className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm font-mono-tabular" />
        </div>
        <input required minLength={20} maxLength={500} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Campaign summary (20–500 characters)" className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
        <textarea required minLength={50} maxLength={10000} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Operational description (50–10,000 characters)" className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="text-xs text-slate-500">Start date<input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" /></label>
          <label className="text-xs text-slate-500">End date<input required type="date" min={startDate || undefined} value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" /></label>
          <label className="text-xs text-slate-500">Cover image URL (optional)<input type="url" value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} placeholder="https://…" className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" /></label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="text-xs text-slate-500">Responsible coordinator (optional)
            <select value={coordinatorId} onChange={(event) => setCoordinatorId(event.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm">
              <option value="">Unassigned</option>
              {(coordinatorsData?.data || []).map((user) =>
                <option key={user.id} value={user.id}>{user.displayName || `Coordinator ${user.id}`}</option>)}
            </select>
          </label>
          {coordinatorId && <label className="text-xs text-slate-500">Assignment reason
            <input required minLength={8} maxLength={1500} value={assignmentReason} onChange={(event) => setAssignmentReason(event.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
          </label>}
        </div>
        <button type="submit" disabled={!startDate || !endDate || !targetAmount || (Boolean(coordinatorId) && assignmentReason.trim().length < 8)} className="px-5 py-2.5 rounded-lg bg-[#0B1F3A] dark:bg-[#00BCEB] text-white dark:text-[#071324] text-sm font-semibold disabled:opacity-50">
          Save Campaign Draft
        </button>
      </form>}

      {isError && <p role="alert" className="text-sm text-rose-600">{error instanceof Error ? error.message : 'Campaigns could not be loaded.'}</p>}
      <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-[#F7F9FC] dark:bg-[#071324] text-xs text-[#748196]">
            <tr>
              <th className="px-5 py-3">Campaign</th>
              <th className="px-5 py-3 text-right">Confirmed Raised</th>
              <th className="px-5 py-3 text-right">Target</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Coordinator</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {isLoading && <tr><td className="px-5 py-4 text-slate-500" colSpan={6}>Loading campaigns…</td></tr>}
            {!isLoading && (data?.data || []).length === 0 && <tr><td className="px-5 py-4 text-slate-500" colSpan={6}>No campaign records.</td></tr>}
            {(data?.data || []).map((c) => (
              <tr key={c.id}>
                <td className="px-5 py-3 font-medium">{c.title}</td>
                <td className="px-5 py-3 text-right font-mono-tabular">${Number(c.raisedAmount).toLocaleString()}</td>
                <td className="px-5 py-3 text-right font-mono-tabular">${Number(c.targetAmount).toLocaleString()}</td>
                <td className="px-5 py-3 text-xs font-semibold">{c.status}</td>
                <td className="px-5 py-3 text-xs">
                  <p>{c.coordinatorName || 'Unassigned'}</p>
                  {canAssignCampaigns && c.status !== 'ARCHIVED' && <div className="mt-2 flex flex-col gap-1">
                    <select aria-label={`Coordinator for campaign ${c.title}`}
                      value={coordinatorByCampaign[c.id] ?? (c.coordinatorId ? String(c.coordinatorId) : '')}
                      onChange={(event) => setCoordinatorByCampaign((current) => ({ ...current, [c.id]: event.target.value }))}
                      className="max-w-40 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324]">
                      <option value="">Unassigned</option>
                      {(coordinatorsData?.data || []).map((user) =>
                        <option key={user.id} value={user.id}>{user.displayName || `Coordinator ${user.id}`}</option>)}
                    </select>
                    <input aria-label={`Assignment reason for campaign ${c.title}`} value={assignmentReasonByCampaign[c.id] || ''}
                      onChange={(event) => setAssignmentReasonByCampaign((current) => ({ ...current, [c.id]: event.target.value }))}
                      placeholder="Assignment reason" className="max-w-40 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324]" />
                    <button type="button" disabled={busyId === c.id || !coordinatorByCampaign[c.id] || Number(coordinatorByCampaign[c.id]) === c.coordinatorId || assignmentReasonByCampaign[c.id]?.trim().length < 8}
                      onClick={() => assignCampaignCoordinator(c.id)} className="text-left text-xs font-semibold text-[#123F69] dark:text-[#00BCEB] disabled:opacity-50">Assign / reassign</button>
                  </div>}
                </td>
                <td className="px-5 py-3 text-right space-x-2">
                  {canManageCampaigns && c.status === 'DRAFT' && <button type="button" disabled={busyId === c.id} onClick={() => toggleStatus(c.id, 'PENDING_APPROVAL')} className="text-xs font-semibold text-[#123F69] dark:text-[#00BCEB]">Submit for approval</button>}
                  {canApproveCampaigns && c.status === 'PENDING_APPROVAL' && <button type="button" disabled={busyId === c.id} onClick={() => toggleStatus(c.id, 'APPROVED')} className="text-xs font-semibold text-[#16865D]">Approve</button>}
                  {canPublishCampaigns && c.status === 'APPROVED' && <button type="button" disabled={busyId === c.id} onClick={() => toggleStatus(c.id, 'ACTIVE')} className="text-xs font-semibold text-[#16865D]">Publish & activate</button>}
                  {canManageCampaigns && c.status === 'ACTIVE' && <>
                    <button type="button" disabled={busyId === c.id} onClick={() => toggleStatus(c.id, 'PAUSED')} className="text-xs font-semibold text-[#123F69] dark:text-[#00BCEB]">Pause</button>
                    <button type="button" disabled={busyId === c.id} onClick={() => toggleStatus(c.id, 'COMPLETED')} className="ml-2 text-xs font-semibold text-[#16865D]">Complete</button>
                  </>}
                  {canPublishCampaigns && c.status === 'PAUSED' && <button type="button" disabled={busyId === c.id} onClick={() => toggleStatus(c.id, 'ACTIVE')} className="text-xs font-semibold text-[#16865D]">Resume</button>}
                  {canManageCampaigns && c.status === 'REJECTED' && <button type="button" disabled={busyId === c.id} onClick={() => toggleStatus(c.id, 'DRAFT')} className="text-xs font-semibold text-[#123F69] dark:text-[#00BCEB]">Reopen draft</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminOutreachAndNewsPanel() {
  const { permissions } = useAuth();
  const canManageOutreach = permissions.includes('admin:outreach:manage');
  const canManageAssistance = permissions.includes('admin:assistance:manage');
  const canManageNews = permissions.includes('admin:news:manage');
  const canPublishNews = permissions.includes('admin:news:publish');
  const canCreateAnnouncements = permissions.includes('admin:announcements:manage');
  const qc = useQueryClient();
  const [articleTitle, setArticleTitle] = useState('');
  const [articleSummary, setArticleSummary] = useState('');
  const [articleBody, setArticleBody] = useState('');
  const [articleCategoryId, setArticleCategoryId] = useState('');
  const [articleCoverImageUrl, setArticleCoverImageUrl] = useState('');
  const [articleEdits, setArticleEdits] = useState<Record<number, {
    title: string; summary: string; body: string; categoryId: string; coverImageUrl: string;
  }>>({});
  const [articleNotes, setArticleNotes] = useState<Record<number, string>>({});
  const [assistanceNotes, setAssistanceNotes] = useState<Record<number, string>>({});
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [announcementAudience, setAnnouncementAudience] = useState('ALL');
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data: volData, isLoading: volunteersLoading, isError: volunteersError } = useQuery({
    queryKey: ['admin-volunteers'],
    queryFn: () =>
      apiRequest<{
        applications: Array<{
          id: number; fullName: string; email: string; phone: string; region: string; skills: string;
          availability: string; motivation: string; status: string;
        }>;
      }>('/admin/volunteers'),
    enabled: canManageOutreach,
  });

  const { data: partData, isLoading: partnershipsLoading, isError: partnershipsError } = useQuery({
    queryKey: ['admin-partnerships'],
    queryFn: () =>
      apiRequest<{
        enquiries: Array<{
          id: number; organizationName: string; organizationType: string; contactName: string;
          email: string; region: string; proposalSummary: string; status: string;
        }>;
      }>('/admin/partnerships'),
    enabled: canManageOutreach,
  });

  const { data: assistData, isLoading: assistanceLoading, isError: assistanceError } = useQuery({
    queryKey: ['admin-assistance'],
    queryFn: () =>
      apiRequest<Array<{
        id: number; caseReference: string; coordinatorName: string; supportType: string;
        requestedAmountUsd: number; justification: string; status: string; adminFeedback: string | null;
      }>>(
        '/admin/assistance-requests',
      ),
    enabled: canManageAssistance,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['admin-article-categories'],
    queryFn: () => apiRequest<Array<{ id: number; name: string }>>('/admin/article-categories'),
    enabled: canManageNews,
  });
  const { data: articlesData, isLoading: articlesLoading, isError: articlesError } = useQuery({
    queryKey: ['admin-articles'],
    queryFn: () => apiRequest<Array<{
      id: number; title: string; summary: string; body: string; coverImageUrl: string | null;
      status: string; categoryId: number; categoryName: string;
      authorName: string | null; publishedAt: string;
    }>>('/admin/articles'),
    enabled: canManageNews,
  });
  const { data: reportsData, isLoading: reportsLoading, isError: reportsError } = useQuery({
    queryKey: ['admin-field-reports'],
    queryFn: () => apiRequest<Array<{
      id: number; coordinatorName: string | null; visitDate: string; summary: string; peopleReached: number;
      regionName: string; caseReference: string | null; activities: Array<{ activityTitle: string; notes: string | null }>;
    }>>('/admin/field-reports'),
    enabled: canManageOutreach,
  });
  const { data: announcementsData, isLoading: announcementsLoading } = useQuery({
    queryKey: ['admin-announcements'],
    queryFn: () => apiRequest<Array<{ id: number; title: string; targetRole: string; publishedAt: string }>>('/admin/announcements'),
    enabled: canManageOutreach,
  });

  const publishArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const response = await apiRequest('/admin/articles', {
        method: 'POST',
        body: JSON.stringify({
          title: articleTitle,
          summary: articleSummary,
          body: articleBody,
          categoryId: Number(articleCategoryId),
          coverImageUrl: articleCoverImageUrl.trim() || undefined,
        }),
      });
      setFeedback(response.message);
      setArticleTitle('');
      setArticleSummary('');
      setArticleBody('');
      setArticleCategoryId('');
      setArticleCoverImageUrl('');
      await qc.invalidateQueries({ queryKey: ['admin-articles'] });
    } catch (actionError) {
      setFeedback(actionError instanceof Error ? actionError.message : 'Article draft could not be saved.');
    }
  };

  const changeArticleStatus = async (id: number, status: string) => {
    const notes = articleNotes[id]?.trim() || '';
    if (['APPROVED', 'PUBLISHED', 'REVISION_REQUESTED', 'REJECTED'].includes(status) && notes.length < 8) {
      setFeedback('Provide at least 8 characters explaining the editorial decision.');
      return;
    }
    setFeedback(null);
    try {
      const response = await apiRequest(`/admin/articles/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, notes }),
      });
      setFeedback(response.message);
      setArticleNotes((current) => ({ ...current, [id]: '' }));
      await qc.invalidateQueries({ queryKey: ['admin-articles'] });
    } catch (actionError) {
      setFeedback(actionError instanceof Error ? actionError.message : 'Article status could not be updated.');
    }
  };

  const saveArticle = async (id: number) => {
    const edits = articleEdits[id];
    if (!edits) return;
    setFeedback(null);
    try {
      const response = await apiRequest(`/admin/articles/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: edits.title,
          summary: edits.summary,
          body: edits.body,
          categoryId: Number(edits.categoryId),
          coverImageUrl: edits.coverImageUrl,
        }),
      });
      setFeedback(response.message);
      setArticleEdits((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      await qc.invalidateQueries({ queryKey: ['admin-articles'] });
    } catch (actionError) {
      setFeedback(actionError instanceof Error ? actionError.message : 'Article edits could not be saved.');
    }
  };

  const updateArticleEdit = (
    article: { id: number; title: string; summary: string; body: string; categoryId: number; coverImageUrl: string | null },
    field: 'title' | 'summary' | 'body' | 'categoryId' | 'coverImageUrl',
    value: string,
  ) => {
    setArticleEdits((current) => ({
      ...current,
      [article.id]: {
        title: current[article.id]?.title ?? article.title,
        summary: current[article.id]?.summary ?? article.summary,
        body: current[article.id]?.body ?? article.body,
        categoryId: current[article.id]?.categoryId ?? String(article.categoryId),
        coverImageUrl: current[article.id]?.coverImageUrl ?? article.coverImageUrl ?? '',
        [field]: value,
      },
    }));
  };

  const publishAnnouncement = async (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    try {
      const response = await apiRequest('/admin/announcements', {
        method: 'POST',
        body: JSON.stringify({ title: announcementTitle, body: announcementBody, targetRole: announcementAudience }),
      });
      setFeedback(response.message);
      setAnnouncementTitle('');
      setAnnouncementBody('');
      await qc.invalidateQueries({ queryKey: ['admin-announcements'] });
    } catch (actionError) {
      setFeedback(actionError instanceof Error ? actionError.message : 'Announcement could not be published.');
    }
  };

  const reviewOutreachRecord = async (
    endpoint: string,
    status: 'APPROVED' | 'REJECTED',
    queryKey: string[],
  ) => {
    setFeedback(null);
    try {
      const response = await apiRequest(endpoint, { method: 'PATCH', body: JSON.stringify({ status }) });
      setFeedback(response.message);
      await qc.invalidateQueries({ queryKey });
    } catch (actionError) {
      setFeedback(actionError instanceof Error ? actionError.message : 'The review decision could not be saved.');
    }
  };

  const reviewAssistanceRequest = async (id: number, status: string) => {
    const adminFeedback = assistanceNotes[id]?.trim() || '';
    if (adminFeedback.length < 8) {
      setFeedback('Provide at least 8 characters explaining the assistance decision.');
      return;
    }
    setFeedback(null);
    try {
      const response = await apiRequest(`/admin/assistance-requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, adminFeedback }),
      });
      setFeedback(response.message);
      setAssistanceNotes((current) => ({ ...current, [id]: '' }));
      await qc.invalidateQueries({ queryKey: ['admin-assistance'] });
    } catch (actionError) {
      setFeedback(actionError instanceof Error ? actionError.message : 'The assistance decision could not be saved.');
    }
  };

  return (
    <div className="space-y-6">
      {feedback && <p role="status" className="text-sm text-[#16865D]">{feedback}</p>}
      {(volunteersError || partnershipsError || assistanceError || articlesError || reportsError) && (
        <p role="alert" className="text-sm text-rose-600">One or more Operations records could not be loaded. Refresh and retry.</p>
      )}

      {canManageNews && <section className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="font-editorial text-xl font-semibold">News Publishing Workflow</h2>
          <p className="mt-1 text-xs text-slate-500">Articles remain unpublished until they are reviewed and explicitly published.</p>
        </div>
        {articlesLoading ? <p className="text-xs text-slate-500">Loading articles…</p> : (articlesData?.data || []).length === 0 ? (
          <p className="text-xs text-slate-500">No article records.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {(articlesData?.data || []).map((article) => (
              <div key={article.id} className="py-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{article.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">{article.categoryName} · {article.authorName || 'Author not listed'} · {article.status}</p>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{article.summary}</p>
                  </div>
                </div>
                {['DRAFT', 'REVISION_REQUESTED'].includes(article.status) && (
                  <details className="text-xs">
                    <summary className="cursor-pointer font-semibold">Edit article content</summary>
                    <div className="mt-3 space-y-2">
                      <input value={articleEdits[article.id]?.title ?? article.title}
                        onChange={(event) => updateArticleEdit(article, 'title', event.target.value)}
                        aria-label={`Article title ${article.id}`} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324]" />
                      <select value={articleEdits[article.id]?.categoryId ?? String(article.categoryId)}
                        onChange={(event) => updateArticleEdit(article, 'categoryId', event.target.value)}
                        aria-label={`Article category ${article.id}`} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324]">
                        {(categoriesData?.data || []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                      </select>
                      <textarea rows={2} value={articleEdits[article.id]?.summary ?? article.summary}
                        onChange={(event) => updateArticleEdit(article, 'summary', event.target.value)}
                        aria-label={`Article summary ${article.id}`} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324]" />
                      <textarea rows={5} value={articleEdits[article.id]?.body ?? article.body}
                        onChange={(event) => updateArticleEdit(article, 'body', event.target.value)}
                        aria-label={`Article body ${article.id}`} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324]" />
                      <input value={articleEdits[article.id]?.coverImageUrl ?? article.coverImageUrl ?? ''}
                        onChange={(event) => updateArticleEdit(article, 'coverImageUrl', event.target.value)}
                        aria-label={`Article cover image URL ${article.id}`} placeholder="Featured image URL (optional)"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324]" />
                      <button type="button" onClick={() => saveArticle(article.id)} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold">Save article edits</button>
                    </div>
                  </details>
                )}
                {['SUBMITTED', 'APPROVED'].includes(article.status) && (
                  <input aria-label={`Editorial decision notes for ${article.title}`} value={articleNotes[article.id] || ''}
                    onChange={(event) => setArticleNotes((current) => ({ ...current, [article.id]: event.target.value }))}
                    placeholder="Editorial notes (required for revision or rejection)"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-xs" />
                )}
                <div className="flex flex-wrap gap-2">
                  {article.status === 'DRAFT' && <button type="button" onClick={() => changeArticleStatus(article.id, 'SUBMITTED')} className="text-xs font-semibold text-[#123F69] dark:text-[#00BCEB]">Submit for review</button>}
                  {article.status === 'SUBMITTED' && <>
                    <button type="button" disabled={articleNotes[article.id]?.trim().length < 8} onClick={() => changeArticleStatus(article.id, 'APPROVED')} className="text-xs font-semibold text-[#16865D] disabled:opacity-50">Approve</button>
                    <button type="button" disabled={articleNotes[article.id]?.trim().length < 8} onClick={() => changeArticleStatus(article.id, 'REVISION_REQUESTED')} className="text-xs font-semibold text-amber-700 disabled:opacity-50">Request revision</button>
                    <button type="button" disabled={articleNotes[article.id]?.trim().length < 8} onClick={() => changeArticleStatus(article.id, 'REJECTED')} className="text-xs font-semibold text-rose-600 disabled:opacity-50">Reject</button>
                  </>}
                  {article.status === 'APPROVED' && <button type="button" disabled={articleNotes[article.id]?.trim().length < 8} onClick={() => changeArticleStatus(article.id, 'PUBLISHED')} className="text-xs font-semibold text-[#16865D] disabled:opacity-50">Publish</button>}
                  {article.status === 'REVISION_REQUESTED' && <button type="button" onClick={() => changeArticleStatus(article.id, 'DRAFT')} className="text-xs font-semibold text-[#123F69] dark:text-[#00BCEB]">Return to draft</button>}
                  {['PUBLISHED', 'REJECTED'].includes(article.status) && <button type="button" onClick={() => changeArticleStatus(article.id, 'ARCHIVED')} className="text-xs font-semibold text-slate-500">Archive</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>}

      <section className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <h2 className="font-editorial text-xl font-semibold">Operational Announcements</h2>
        {canCreateAnnouncements && <form onSubmit={publishAnnouncement} className="space-y-3">
          <input required minLength={5} maxLength={180} value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)}
            placeholder="Announcement title" className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
          <textarea required minLength={20} maxLength={4000} rows={3} value={announcementBody} onChange={(event) => setAnnouncementBody(event.target.value)}
            placeholder="Announcement details" className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
          <div className="flex flex-wrap items-center gap-3">
            <select value={announcementAudience} onChange={(event) => setAnnouncementAudience(event.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm">
              <option value="ALL">All active users</option>
              <option value="COMMUNITY_COORDINATOR">Active coordinators</option>
            </select>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#0B1F3A] dark:bg-[#00BCEB] text-white dark:text-[#071324] text-xs font-semibold">Publish & notify audience</button>
          </div>
        </form>}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
          <h3 className="text-xs font-semibold">Recent announcements</h3>
          {announcementsLoading ? <p className="mt-2 text-xs text-slate-500">Loading announcements…</p> : (
            <ul className="mt-2 space-y-1 text-xs text-slate-500">
              {(announcementsData?.data || []).slice(0, 5).map((announcement) => (
                <li key={announcement.id}>{announcement.title} · {announcement.targetRole}</li>
              ))}
              {(announcementsData?.data || []).length === 0 && <li>No announcements published.</li>}
            </ul>
          )}
        </div>
      </section>

      {canManageOutreach && <section className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
        <h2 className="font-editorial text-xl font-semibold">Field Outreach Reports</h2>
        {reportsLoading ? <p className="text-xs text-slate-500">Loading field reports…</p> : (reportsData?.data || []).length === 0 ? (
          <p className="text-xs text-slate-500">No field reports have been submitted.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {(reportsData?.data || []).map((report) => (
              <li key={report.id} className="py-3 text-xs">
                <p className="font-semibold">{report.regionName} · {report.coordinatorName || 'Coordinator'} · {report.visitDate} · People reached: {report.peopleReached}</p>
                <p className="mt-1 text-slate-600 dark:text-slate-300">{report.summary}</p>
                {report.caseReference && <p className="mt-1 text-slate-500">Related case: {report.caseReference}</p>}
                {report.activities.map((activity, index) => <p key={`${report.id}-${index}`} className="mt-1 text-slate-500">{activity.activityTitle}{activity.notes ? ` — ${activity.notes}` : ''}</p>)}
              </li>
            ))}
          </ul>
        )}
      </section>}

      {canManageAssistance && <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <h2 className="font-editorial text-xl font-semibold">Pending Coordinator Assistance Requests</h2>
        {assistanceLoading && <p className="text-xs text-slate-500">Loading assistance requests…</p>}
        {(assistData?.data || []).length === 0 ? (
          <p className="text-xs text-[#748196]">No assistance requests submitted.</p>
        ) : (
          <div className="space-y-2">
            {(assistData?.data || []).map((a) => (
              <div key={a.id} className="grid gap-3 py-3 border-b border-slate-100 dark:border-slate-800 text-xs">
                <div>
                  <span className="font-mono-tabular font-semibold">{a.caseReference}</span> · {a.supportType} (${Number(a.requestedAmountUsd).toLocaleString()}) · {a.status}
                  {a.justification && <p className="mt-1 text-slate-500">{a.justification}</p>}
                  {a.adminFeedback && <p className="mt-1 text-slate-500">Previous feedback: {a.adminFeedback}</p>}
                </div>
                <input aria-label={`Decision feedback for request ${a.id}`} value={assistanceNotes[a.id] || ''}
                  onChange={(event) => setAssistanceNotes((current) => ({ ...current, [a.id]: event.target.value }))}
                  placeholder="Document the decision or additional information required"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324]" />
                {['SUBMITTED', 'UNDER_REVIEW'].includes(a.status) && <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => reviewAssistanceRequest(a.id, 'UNDER_REVIEW')} className="px-3 py-1 rounded border border-slate-300 dark:border-slate-700 font-semibold">Begin review</button>
                  <button type="button" onClick={() => reviewAssistanceRequest(a.id, 'APPROVED')} className="px-3 py-1 rounded bg-[#16865D] text-white font-semibold">Approve</button>
                  <button type="button" onClick={() => reviewAssistanceRequest(a.id, 'REJECTED')} className="px-3 py-1 rounded border border-rose-300 text-rose-600 font-semibold">Reject</button>
                </div>}
              </div>
            ))}
          </div>
        )}
      </div>}

      {canManageOutreach && <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6">
          <h3 className="font-editorial text-lg font-semibold mb-3">Volunteer Applications</h3>
          {volunteersLoading && <p className="text-xs text-slate-500">Loading applications…</p>}
          {(volData?.data?.applications || []).length === 0 ? (
            <p className="text-xs text-[#748196]">No applications in queue.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {(volData?.data?.applications || []).map((v) => (
                <li key={v.id} className="py-3 space-y-2">
                  <p className="font-semibold">{v.fullName} · {v.region} · {v.status}</p>
                  <p className="text-slate-500">{v.email} · {v.phone} · Availability: {v.availability}</p>
                  <p className="text-slate-600 dark:text-slate-300">Skills: {v.skills}</p>
                  <p className="text-slate-600 dark:text-slate-300">{v.motivation}</p>
                  {v.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => reviewOutreachRecord(`/admin/volunteers/${v.id}`, 'APPROVED', ['admin-volunteers'])} className="px-2.5 py-1 rounded bg-[#0B1F3A] text-white font-semibold">Approve</button>
                      <button type="button" onClick={() => reviewOutreachRecord(`/admin/volunteers/${v.id}`, 'REJECTED', ['admin-volunteers'])} className="px-2.5 py-1 rounded border border-rose-300 text-rose-600 font-semibold">Reject</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6">
          <h3 className="font-editorial text-lg font-semibold mb-3">Partnership Enquiries</h3>
          {partnershipsLoading && <p className="text-xs text-slate-500">Loading enquiries…</p>}
          {(partData?.data?.enquiries || []).length === 0 ? (
            <p className="text-xs text-[#748196]">No partnership enquiries in queue.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {(partData?.data?.enquiries || []).map((p) => (
                <li key={p.id} className="py-3 space-y-2">
                  <p className="font-semibold">{p.organizationName} ({p.organizationType}) · {p.status}</p>
                  <p className="text-slate-500">{p.contactName} · {p.email} · {p.region}</p>
                  <p className="text-slate-600 dark:text-slate-300">{p.proposalSummary}</p>
                  {p.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => reviewOutreachRecord(`/admin/partnerships/${p.id}`, 'APPROVED', ['admin-partnerships'])} className="px-2.5 py-1 rounded bg-[#0B1F3A] text-white font-semibold">Approve</button>
                      <button type="button" onClick={() => reviewOutreachRecord(`/admin/partnerships/${p.id}`, 'REJECTED', ['admin-partnerships'])} className="px-2.5 py-1 rounded border border-rose-300 text-rose-600 font-semibold">Reject</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>}

      {canManageNews && <form onSubmit={publishArticle} className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
        <h3 className="font-editorial text-lg font-semibold">Create News Draft</h3>
        <input required minLength={5} maxLength={200} value={articleTitle} onChange={(e) => setArticleTitle(e.target.value)} placeholder="Article headline" className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
        <select required value={articleCategoryId} onChange={(e) => setArticleCategoryId(e.target.value)} className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm">
          <option value="">Select a news category</option>
          {(categoriesData?.data || []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <input required minLength={15} maxLength={2000} value={articleSummary} onChange={(e) => setArticleSummary(e.target.value)} placeholder="Brief summary" className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
        <textarea required minLength={40} maxLength={20000} rows={5} value={articleBody} onChange={(e) => setArticleBody(e.target.value)} placeholder="Full article copy" className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
        <input type="url" maxLength={500} value={articleCoverImageUrl} onChange={(e) => setArticleCoverImageUrl(e.target.value)} placeholder="Featured image URL (optional)" className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#071324] text-sm" />
        <button type="submit" disabled={!articleCategoryId} className="px-5 py-2 rounded-lg bg-[#0B1F3A] dark:bg-[#00BCEB] text-white dark:text-[#071324] text-xs font-semibold disabled:opacity-50">
          Save Draft
        </button>
      </form>}
    </div>
  );
}
