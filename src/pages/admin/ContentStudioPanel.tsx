import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EditorContent, useEditor } from '@tiptap/react';
import { type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Plus,
  Save,
  Send,
  Underline as UnderlineIcon,
} from 'lucide-react';
import { CMS_CONTENT_SECTIONS, CMS_CONTENT_TYPES, type CmsContentStatus, type CmsContentType } from '../../../packages/shared/types';
import { useAuth } from '../../contexts/AuthContext';
import { apiRequest } from '../../services/api';

type CmsRecord = {
  id: number;
  type: CmsContentType;
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string;
  body: JSONContent;
  category: string | null;
  authorDepartment: string | null;
  location: string | null;
  coverImageUrl: string | null;
  coverAltText: string | null;
  tags: string[];
  attachments: Array<{ url: string; name: string; mimeType: string }>;
  externalUrl: string | null;
  scheduledAt: string | null;
  expiresAt: string | null;
  isFeatured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  status: CmsContentStatus;
  authorName: string | null;
  updatedAt: string;
};

type FormValues = {
  type: CmsContentType;
  title: string;
  subtitle: string;
  summary: string;
  category: string;
  authorDepartment: string;
  location: string;
  coverImageUrl: string;
  coverAltText: string;
  tags: string;
  externalUrl: string;
  scheduledAt: string;
  expiresAt: string;
  isFeatured: boolean;
  seoTitle: string;
  seoDescription: string;
};

const EMPTY_BODY: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };
const INITIAL_FORM: FormValues = {
  type: 'ANNOUNCEMENT',
  title: '',
  subtitle: '',
  summary: '',
  category: '',
  authorDepartment: '',
  location: '',
  coverImageUrl: '',
  coverAltText: '',
  tags: '',
  externalUrl: '',
  scheduledAt: '',
  expiresAt: '',
  isFeatured: false,
  seoTitle: '',
  seoDescription: '',
};

const controlClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 dark:border-white/15 dark:bg-[#181a1c] dark:text-slate-100';
const buttonClass = 'inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10';

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'The content request could not be completed.';
}

function toLocalDateTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function recordToForm(record: CmsRecord): FormValues {
  return {
    type: record.type,
    title: record.title,
    subtitle: record.subtitle || '',
    summary: record.summary,
    category: record.category || '',
    authorDepartment: record.authorDepartment || '',
    location: record.location || '',
    coverImageUrl: record.coverImageUrl || '',
    coverAltText: record.coverAltText || '',
    tags: record.tags.join(', '),
    externalUrl: record.externalUrl || '',
    scheduledAt: toLocalDateTime(record.scheduledAt),
    expiresAt: toLocalDateTime(record.expiresAt),
    isFeatured: record.isFeatured,
    seoTitle: record.seoTitle || '',
    seoDescription: record.seoDescription || '',
  };
}

function RichTextToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;
  const toggleButton = (label: string, active: boolean, action: () => void, icon: React.ReactNode) => (
    <button
      type="button"
      key={label}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${active ? 'bg-slate-200 text-slate-950 dark:bg-white/15 dark:text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'}`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={action}
    >
      {icon}
    </button>
  );
  const setLink = () => {
    const url = window.prompt('Enter an HTTPS link');
    if (!url) return;
    try {
      const parsed = new URL(url);
      if (!['https:', 'http:'].includes(parsed.protocol)) return;
      editor.chain().focus().setLink({ href: parsed.toString() }).run();
    } catch {
      return;
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 p-2 dark:border-white/10">
      <select
        aria-label="Paragraph style"
        className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs dark:border-white/15 dark:bg-[#181a1c] dark:text-white"
        value={editor.isActive('heading', { level: 1 }) ? '1' : editor.isActive('heading', { level: 2 }) ? '2' : 'p'}
        onChange={(event) => {
          const value = event.target.value;
          if (value === 'p') editor.chain().focus().setParagraph().run();
          else editor.chain().focus().toggleHeading({ level: Number(value) as 1 | 2 }).run();
        }}
      >
        <option value="p">Paragraph</option>
        <option value="1">Heading 1</option>
        <option value="2">Heading 2</option>
      </select>
      {toggleButton('Bold', editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), <Bold className="h-4 w-4" />)}
      {toggleButton('Italic', editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), <Italic className="h-4 w-4" />)}
      {toggleButton('Underline', editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), <UnderlineIcon className="h-4 w-4" />)}
      {toggleButton('Bulleted list', editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), <List className="h-4 w-4" />)}
      {toggleButton('Numbered list', editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered className="h-4 w-4" />)}
      {toggleButton('Align left', editor.isActive({ textAlign: 'left' }), () => editor.chain().focus().setTextAlign('left').run(), <AlignLeft className="h-4 w-4" />)}
      {toggleButton('Align center', editor.isActive({ textAlign: 'center' }), () => editor.chain().focus().setTextAlign('center').run(), <AlignCenter className="h-4 w-4" />)}
      {toggleButton('Align right', editor.isActive({ textAlign: 'right' }), () => editor.chain().focus().setTextAlign('right').run(), <AlignRight className="h-4 w-4" />)}
      <label className="inline-flex h-8 items-center gap-1 px-1 text-[11px] text-slate-600 dark:text-slate-300" title="Text colour">
        A <input aria-label="Text colour" className="h-5 w-5 cursor-pointer" type="color" onChange={(event) => editor.chain().focus().setColor(event.target.value).run()} />
      </label>
      <label className="inline-flex h-8 items-center gap-1 px-1 text-[11px] text-slate-600 dark:text-slate-300" title="Highlight">
        <span className="rounded bg-yellow-200 px-1">Hi</span>
        <input aria-label="Highlight colour" className="h-5 w-5 cursor-pointer" type="color" onChange={(event) => editor.chain().focus().setHighlight({ color: event.target.value }).run()} />
      </label>
      <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10" aria-label="Insert hyperlink" title="Insert hyperlink" onClick={setLink}><Link2 className="h-4 w-4" /></button>
    </div>
  );
}

export function ContentStudioPanel({ mode = 'admin' }: { mode?: 'admin' | 'coordinator' }) {
  const coordinator = mode === 'coordinator';
  const { permissions } = useAuth();
  const queryClient = useQueryClient();
  const basePath = coordinator ? '/coordinator/cms-content' : '/admin/cms-content';
  const queryKey = [coordinator ? 'coordinator-cms-content' : 'admin-cms-content'];
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<FormValues>(INITIAL_FORM);
  const [body, setBody] = useState<JSONContent>(EMPTY_BODY);
  const [feedback, setFeedback] = useState('');
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const imageInput = useRef<HTMLInputElement>(null);
  const canPublish = permissions.includes('admin:news:publish');

  const { data, isLoading, isError, error } = useQuery({
    queryKey,
    queryFn: () => apiRequest<CmsRecord[]>(basePath),
  });
  const records = data?.data || [];
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, protocols: ['http', 'https'] }),
      Image.configure({ allowBase64: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
    ],
    content: EMPTY_BODY,
    editorProps: {
      attributes: {
        class: 'min-h-[320px] px-5 py-4 text-sm leading-7 text-slate-800 outline-none dark:text-slate-100 [&_h1]:my-4 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:my-3 [&_h2]:text-xl [&_h2]:font-semibold [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:border-l-4 [&_blockquote]:pl-4 [&_blockquote]:italic [&_img]:my-3 [&_img]:max-h-96 [&_img]:rounded-lg',
      },
    },
  });

  useEffect(() => {
    if (editor) editor.commands.setContent(body);
  }, [editor, body]);

  const createOrUpdate = useMutation({
    mutationFn: async (submitForReview: boolean) => {
      if (!editor) throw new Error('The rich-text editor is not ready.');
      const payload = {
        ...form,
        tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        body: editor.getJSON(),
        ...(coordinator ? { submitForReview } : {}),
      };
      return apiRequest<CmsRecord>(selectedId ? `${basePath}/${selectedId}` : basePath, {
        method: selectedId ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async (result, submitted) => {
      setFeedback(result.message);
      if (!selectedId && result.data?.id) setSelectedId(result.data.id);
      await queryClient.invalidateQueries({ queryKey });
      if (coordinator && submitted) setSelectedId(null);
    },
    onError: (saveError) => setFeedback(messageOf(saveError)),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, scheduledAt, notes }: {
      id: number;
      status: CmsContentStatus;
      scheduledAt?: string;
      notes?: string;
    }) => apiRequest(`${basePath}/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, scheduledAt, notes }),
    }),
    onSuccess: async (result) => {
      setFeedback(result.message);
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (statusError) => setFeedback(messageOf(statusError)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`${basePath}/${id}`, { method: 'DELETE' }),
    onSuccess: async (result) => {
      setFeedback(result.message);
      if (selectedId) startNew();
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (deleteError) => setFeedback(messageOf(deleteError)),
  });

  function startNew() {
    setSelectedId(null);
    setForm({ ...INITIAL_FORM, type: coordinator ? 'COMMUNITY_UPDATE' : 'ANNOUNCEMENT' });
    setBody(EMPTY_BODY);
    setFeedback('');
  }

  function editRecord(record: CmsRecord) {
    setSelectedId(record.id);
    setForm(recordToForm(record));
    setBody(record.body);
    setFeedback('');
  }

  async function uploadImage(file?: File) {
    if (!file || !editor) return;
    const data = new FormData();
    data.append('file', file);
    data.append('scope', 'PUBLIC_STORY');
    try {
      const result = await apiRequest<{ publicUrl: string }>('/media/upload', { method: 'POST', body: data });
      editor.chain().focus().setImage({ src: result.data.publicUrl, alt: file.name }).run();
      setFeedback('Image uploaded. It becomes publicly available only when referenced by published content.');
    } catch (uploadError) {
      setFeedback(messageOf(uploadError));
    }
    if (imageInput.current) imageInput.current.value = '';
  }

  function transition(record: CmsRecord, status: CmsContentStatus, requiresNotes = false) {
    const notes = reviewNotes[record.id]?.trim() || '';
    if (requiresNotes && notes.length < 8) {
      setFeedback('Add at least 8 characters of review notes before this decision.');
      return;
    }
    const scheduledAt = status === 'SCHEDULED' ? form.scheduledAt : undefined;
    if (status === 'SCHEDULED' && !scheduledAt) {
      setFeedback('Choose a future publication time in the editor before scheduling.');
      return;
    }
    statusMutation.mutate({
      id: record.id,
      status,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      notes,
    });
  }

  const allowedTypes = coordinator
    ? CMS_CONTENT_TYPES.filter((type) => ['COMMUNITY_UPDATE', 'SUCCESS_STORY'].includes(type))
    : CMS_CONTENT_TYPES;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">HumanityBridge · Publishing</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {coordinator ? 'My content submissions' : 'Content studio'}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {coordinator ? 'Create a community update or success story and send it for editorial review.' : 'Create, review and publish public-facing content across the organisation.'}
          </p>
        </div>
        <button type="button" onClick={startNew} className={buttonClass}><Plus className="h-4 w-4" /> New blank item</button>
      </header>

      {feedback && <div role="status" className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-[#0D223D] dark:text-slate-200">{feedback}</div>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,.8fr)]">
        <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0D223D]">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{selectedId ? 'Edit content' : 'Create content'}</h2>
              <p className="mt-1 text-xs text-slate-500">A blank editor with optional publishing details.</p>
            </div>
            {selectedId && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">{records.find((record) => record.id === selectedId)?.status || 'Draft'}</span>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Content section
              <select className={controlClass} value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as CmsContentType })}>
                {allowedTypes.map((type) => <option key={type} value={type}>{CMS_CONTENT_SECTIONS[type].label}</option>)}
              </select>
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Category
              <input className={controlClass} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} maxLength={120} />
            </label>
          </div>
          <label className="mt-4 block space-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Title
            <input required className={controlClass} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={200} />
          </label>
          <label className="mt-4 block space-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Subtitle (optional)
            <input className={controlClass} value={form.subtitle} onChange={(event) => setForm({ ...form, subtitle: event.target.value })} maxLength={255} />
          </label>
          <label className="mt-4 block space-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Summary (optional)
            <textarea className={`${controlClass} min-h-20 resize-y`} value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} maxLength={2000} />
          </label>

          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
            <RichTextToolbar editor={editor} />
            <EditorContent editor={editor} />
          </div>
          <input ref={imageInput} className="hidden" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => void uploadImage(event.target.files?.[0])} />
          <button type="button" className={`${buttonClass} mt-3`} onClick={() => imageInput.current?.click()}><ImagePlus className="h-4 w-4" /> Upload and insert image</button>

          <details className="mt-5 rounded-lg border border-slate-200 p-4 dark:border-white/10">
            <summary className="cursor-pointer text-sm font-semibold text-slate-800 dark:text-slate-200">Optional publication details</summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Department<input className={controlClass} value={form.authorDepartment} onChange={(event) => setForm({ ...form, authorDepartment: event.target.value })} maxLength={160} /></label>
              <label className="space-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Location<input className={controlClass} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} maxLength={180} /></label>
              <label className="space-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Cover image URL<input className={controlClass} value={form.coverImageUrl} onChange={(event) => setForm({ ...form, coverImageUrl: event.target.value })} maxLength={500} /></label>
              <label className="space-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Image alternative text<input className={controlClass} value={form.coverAltText} onChange={(event) => setForm({ ...form, coverAltText: event.target.value })} maxLength={255} /></label>
              <label className="space-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Tags (comma separated)<input className={controlClass} value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} /></label>
              <label className="space-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">External link<input className={controlClass} type="url" value={form.externalUrl} onChange={(event) => setForm({ ...form, externalUrl: event.target.value })} maxLength={500} /></label>
              {!coordinator && (
                <>
                  <label className="space-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Schedule publication<input className={controlClass} type="datetime-local" value={form.scheduledAt} onChange={(event) => setForm({ ...form, scheduledAt: event.target.value })} /></label>
                  <label className="space-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">Expiry date (optional)<input className={controlClass} type="datetime-local" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} /></label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300"><input type="checkbox" checked={form.isFeatured} onChange={(event) => setForm({ ...form, isFeatured: event.target.checked })} /> Feature this item</label>
                </>
              )}
              <label className="space-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">SEO title<input className={controlClass} value={form.seoTitle} onChange={(event) => setForm({ ...form, seoTitle: event.target.value })} maxLength={180} /></label>
              <label className="space-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 sm:col-span-2">SEO description<textarea className={`${controlClass} min-h-16 resize-y`} value={form.seoDescription} onChange={(event) => setForm({ ...form, seoDescription: event.target.value })} maxLength={320} /></label>
            </div>
          </details>

          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className={buttonClass} disabled={createOrUpdate.isPending || !form.title.trim()} onClick={() => createOrUpdate.mutate(false)}><Save className="h-4 w-4" /> Save draft</button>
            {coordinator && <button type="button" className={`${buttonClass} border-slate-800 bg-slate-900 text-white hover:bg-slate-700 dark:border-white/20 dark:bg-white dark:text-slate-900`} disabled={createOrUpdate.isPending || !form.title.trim()} onClick={() => createOrUpdate.mutate(true)}><Send className="h-4 w-4" /> Submit for review</button>}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0D223D]">
          <div className="mb-4 flex items-center justify-between">
            <div><h2 className="text-lg font-semibold text-slate-900 dark:text-white">Content queue</h2><p className="mt-1 text-xs text-slate-500">{records.length} saved item{records.length === 1 ? '' : 's'}</p></div>
            <button type="button" title="Refresh content" className={buttonClass} onClick={() => void queryClient.invalidateQueries({ queryKey })}>Refresh</button>
          </div>
          {isLoading ? <p className="py-8 text-center text-sm text-slate-500">Loading content…</p> :
            isError ? <p role="alert" className="py-8 text-center text-sm text-rose-600">{messageOf(error)}</p> :
              records.length === 0 ? <p className="rounded-lg bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:bg-white/5">No content has been created yet.</p> :
                <ul className="space-y-3">
                  {records.map((record) => {
                    const notesRequired = ['PENDING_REVIEW', 'APPROVED'].includes(record.status);
                    return (
                      <li key={record.id} className={`rounded-lg border p-3 ${selectedId === record.id ? 'border-slate-500 bg-slate-50 dark:bg-white/5' : 'border-slate-200 dark:border-white/10'}`}>
                        <button type="button" className="block w-full text-left" onClick={() => editRecord(record)}>
                          <span className="flex items-start justify-between gap-2">
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{record.title}</span>
                              <span className="mt-1 block text-[11px] text-slate-500">{CMS_CONTENT_SECTIONS[record.type].label} · Updated {new Date(record.updatedAt).toLocaleDateString()}</span>
                            </span>
                            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600 dark:bg-white/10 dark:text-slate-300">{record.status.replace('_', ' ')}</span>
                          </span>
                        </button>
                        {!coordinator && (
                          <>
                            {notesRequired && (
                              <textarea
                                aria-label={`Review notes for ${record.title}`}
                                className={`${controlClass} mt-3 min-h-16 resize-y text-xs`}
                                placeholder="Decision notes (required for approval, rejection or publication)"
                                value={reviewNotes[record.id] || ''}
                                onChange={(event) => setReviewNotes({ ...reviewNotes, [record.id]: event.target.value })}
                              />
                            )}
                            <div className="mt-2 flex flex-wrap gap-2">
                              {record.status === 'DRAFT' && <button type="button" className={buttonClass} onClick={() => transition(record, 'PENDING_REVIEW')}><Send className="h-3.5 w-3.5" /> Submit review</button>}
                              {record.status === 'PENDING_REVIEW' && canPublish && <>
                                <button type="button" className={buttonClass} onClick={() => transition(record, 'APPROVED', true)}><Check className="h-3.5 w-3.5" /> Approve</button>
                                <button type="button" className={buttonClass} onClick={() => transition(record, 'REJECTED', true)}>Reject</button>
                              </>}
                              {record.status === 'APPROVED' && canPublish && <>
                                <button type="button" className={buttonClass} onClick={() => transition(record, 'PUBLISHED', true)}>Publish</button>
                                <button type="button" className={buttonClass} onClick={() => transition(record, 'SCHEDULED')}>Schedule</button>
                              </>}
                              {record.status === 'SCHEDULED' && canPublish && <button type="button" className={buttonClass} onClick={() => transition(record, 'PUBLISHED', true)}>Publish now</button>}
                              {record.status === 'PUBLISHED' && canPublish && <button type="button" className={buttonClass} onClick={() => transition(record, 'APPROVED')}>Unpublish</button>}
                              {['DRAFT', 'REJECTED', 'ARCHIVED'].includes(record.status) && <button type="button" className={`${buttonClass} text-rose-600`} onClick={() => {
                                if (window.confirm(`Delete “${record.title}” from the content workspace?`)) deleteMutation.mutate(record.id);
                              }}>Delete</button>}
                            </div>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>}
          {!coordinator && <p className="mt-4 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500 dark:border-white/10">Approval and publication actions are available only to accounts with publishing permission. Every decision is recorded in the audit trail.</p>}
        </section>
      </div>
    </div>
  );
}
