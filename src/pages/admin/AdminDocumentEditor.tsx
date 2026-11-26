import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { Extension, Node, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import { PAGE_SIZES, PaginationPlus } from 'tiptap-pagination-plus';
import { TableKitPlus } from 'tiptap-table-plus';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Bold,
  Check,
  ChevronDown,
  Clock3,
  Download,
  FilePlus2,
  FileText,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  LoaderCircle,
  MoreHorizontal,
  Printer,
  Redo2,
  Save,
  Strikethrough,
  Table2,
  Underline as UnderlineIcon,
  Undo2,
  X,
} from 'lucide-react';
import { apiRequest } from '../../services/api';
import organisationLogo from '../../assets/images/HumanityBridge Global Unity Logo.png';

type PageSettings = {
  orientation: 'PORTRAIT' | 'LANDSCAPE';
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  headerText: string;
  footerText: string;
  showPageNumbers: boolean;
};

type EditorDraft = {
  id: number;
  title: string;
  content: JSONContent;
  pageSettings: PageSettings;
  updatedAt: string;
};

type DraftSummary = Pick<EditorDraft, 'id' | 'title' | 'updatedAt'>;
type DocumentType = { id: number; displayName: string; isApproved: boolean; publicVerification: boolean };
type DocumentTemplate = { id: number; documentTypeId: number; name: string; isActive: boolean };
type OrganisationProfile = {
  officialName: string | null;
  registeredAddress: string | null;
  country: string | null;
  telephone: string | null;
  email: string | null;
  website: string | null;
  approvedTagline: string | null;
  footerDisclaimer: string | null;
};

const EMPTY_CONTENT: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };
const DEFAULT_PAGE_SETTINGS: PageSettings = {
  orientation: 'PORTRAIT',
  marginTop: 22,
  marginRight: 20,
  marginBottom: 22,
  marginLeft: 20,
  headerText: '',
  footerText: '',
  showPageNumbers: true,
};

const StyledText = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontFamily: {
        default: null,
        parseHTML: (element) => element.style.fontFamily || null,
        renderHTML: (attributes) => attributes.fontFamily ? { style: `font-family: ${attributes.fontFamily}` } : {},
      },
      fontSize: {
        default: null,
        parseHTML: (element) => element.style.fontSize || null,
        renderHTML: (attributes) => attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {},
      },
    };
  },
});

const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => element.style.width || null,
        renderHTML: (attributes) => attributes.width ? { style: `width: ${attributes.width}` } : {},
      },
    };
  },
});

const ParagraphLayout = Extension.create({
  name: 'paragraphLayout',
  addGlobalAttributes() {
    return [{
      types: ['paragraph', 'heading'],
      attributes: {
        indent: {
          default: 0,
          parseHTML: (element) => Number(element.getAttribute('data-indent')) || 0,
          renderHTML: (attributes) => ({
            'data-indent': attributes.indent,
            style: attributes.indent ? `margin-left: ${attributes.indent * 24}px` : '',
          }),
        },
        lineHeight: {
          default: '1.5',
          parseHTML: (element) => element.style.lineHeight || '1.5',
          renderHTML: (attributes) => ({ style: `line-height: ${attributes.lineHeight}` }),
        },
      },
    }];
  },
});

const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  parseHTML() {
    return [{ tag: 'div[data-page-break]' }];
  },
  renderHTML() {
    return ['div', { 'data-page-break': 'true', class: 'hb-doc-page-break' }];
  },
});

const toolbarButton = 'inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-md px-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white';
const selectClass = 'h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-slate-500 dark:border-white/15 dark:bg-[#181a1c] dark:text-slate-100';

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'The document could not be saved.';
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character);
}

function EditorButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      className={`${toolbarButton} ${active ? 'bg-slate-200 text-slate-950 dark:bg-white/15 dark:text-white' : ''}`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function AdminDocumentEditor({ onBack }: { onBack: () => void }) {
  const [draftId, setDraftId] = useState<number | null>(null);
  const [title, setTitle] = useState('Untitled document');
  const [pageSettings, setPageSettings] = useState<PageSettings>(DEFAULT_PAGE_SETTINGS);
  const [saveState, setSaveState] = useState<'creating' | 'saved' | 'saving' | 'error'>('creating');
  const [feedback, setFeedback] = useState('');
  const [showDrafts, setShowDrafts] = useState(false);
  const [showPageSetup, setShowPageSetup] = useState(false);
  const [showIssueDialog, setShowIssueDialog] = useState(false);
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [types, setTypes] = useState<DocumentType[]>([]);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [organisation, setOrganisation] = useState<OrganisationProfile | null>(null);
  const [issueFields, setIssueFields] = useState({
    documentTypeId: '',
    templateId: '',
    recipientName: '',
    subject: '',
    expiresAt: '',
  });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const latestContent = useRef<JSONContent>(EMPTY_CONTENT);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const loaded = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      StyledText,
      Color,
      Highlight.configure({ multicolor: true }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer' } }),
      ResizableImage.configure({ inline: false, allowBase64: true, HTMLAttributes: { class: 'hb-doc-image' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TableKitPlus.configure({ table: { resizable: true } }),
      ParagraphLayout,
      PageBreak,
      PaginationPlus.configure({
        ...PAGE_SIZES.A4,
        enabled: true,
        pageGap: 32,
        pageGapBorderColor: '#cbd0d5',
        pageBreakBackground: '#e9eaec',
      }),
    ],
    content: EMPTY_CONTENT,
    onUpdate: ({ editor: currentEditor }) => {
      latestContent.current = currentEditor.getJSON();
      if (loaded.current) scheduleSave();
    },
    editorProps: {
      attributes: {
        class: 'hb-doc-prosemirror focus:outline-none',
        'aria-label': 'Document page content',
      },
    },
  });

  useEffect(() => {
    let active = true;
    void apiRequest<OrganisationProfile | null>('/admin/documents/organisation')
      .then((response) => {
        if (active) setOrganisation(response.data);
      })
      .catch((error: unknown) => {
        if (active) setFeedback(errorText(error));
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!editor) return;
    const dimensions = pageSettings.orientation === 'LANDSCAPE'
      ? { ...PAGE_SIZES.A4, pageWidth: PAGE_SIZES.A4.pageHeight, pageHeight: PAGE_SIZES.A4.pageWidth }
      : PAGE_SIZES.A4;
    const toPixels = (millimetres: number) => millimetres * 3.78;
    const profileLines = [
      organisation?.officialName,
      organisation?.approvedTagline,
      organisation?.registeredAddress,
      organisation?.country,
      [organisation?.telephone, organisation?.email, organisation?.website].filter(Boolean).join(' · '),
    ].filter((line): line is string => Boolean(line?.trim()));
    const logoUrl = escapeHtml(organisationLogo);
    const organisationHtml = profileLines.map((line) => escapeHtml(line)).join('<br>');
    const headerLeft = [
      `<div class="hb-doc-brand"><img src="${logoUrl}" alt="" /><span>${organisationHtml}</span></div>`,
      pageSettings.headerText.trim() ? `<div>${escapeHtml(pageSettings.headerText.trim())}</div>` : '',
    ].filter(Boolean).join('');
    const footerText = pageSettings.footerText.trim() || organisation?.footerDisclaimer?.trim() || '';

    editor.commands.updatePageSize(dimensions);
    editor.commands.updateMargins({
      top: toPixels(pageSettings.marginTop),
      right: toPixels(pageSettings.marginRight),
      bottom: toPixels(pageSettings.marginBottom),
      left: toPixels(pageSettings.marginLeft),
    });
    editor.commands.updateHeaderContent(headerLeft, escapeHtml(title.trim()));
    editor.commands.updateFooterContent(
      escapeHtml(footerText),
      pageSettings.showPageNumbers ? 'Page {page}' : '',
    );
  }, [editor, organisation, pageSettings, title]);

  const saveDraftNow = useCallback(async () => {
    const id = draftId;
    if (!id) return;
    const snapshot = {
      title: title.trim() || 'Untitled document',
      content: latestContent.current,
      pageSettings,
    };
    const save = saveQueue.current.catch(() => undefined).then(async () => {
      await apiRequest(`/admin/documents/editor/drafts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(snapshot),
      });
    });
    saveQueue.current = save;
    await save;
    setSaveState('saved');
    setFeedback('');
  }, [draftId, pageSettings, title]);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState('saving');
    saveTimer.current = setTimeout(() => {
      void saveDraftNow().catch((error: unknown) => {
        setSaveState('error');
        setFeedback(errorText(error));
      });
    }, 750);
  }, [saveDraftNow]);

  useEffect(() => {
    let active = true;
    void apiRequest<EditorDraft>('/admin/documents/editor/drafts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Untitled document',
        content: EMPTY_CONTENT,
        pageSettings: DEFAULT_PAGE_SETTINGS,
      }),
    }).then((response) => {
      if (!active) return;
      setDraftId(response.data.id);
      setTitle(response.data.title);
      setPageSettings(response.data.pageSettings);
      latestContent.current = response.data.content;
      editor?.commands.setContent(response.data.content, { emitUpdate: false });
      loaded.current = true;
      setSaveState('saved');
    }).catch((error: unknown) => {
      if (active) {
        setSaveState('error');
        setFeedback(errorText(error));
      }
    });
    return () => { active = false; };
  }, [editor]);

  useEffect(() => {
    if (!draftId || !loaded.current) return;
    scheduleSave();
  }, [draftId, title, pageSettings, scheduleSave]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  const refreshDrafts = async () => {
    const response = await apiRequest<DraftSummary[]>('/admin/documents/editor/drafts');
    setDrafts(response.data);
  };

  const loadDraft = async (id: number) => {
    setShowDrafts(false);
    setSaveState('saving');
    try {
      const response = await apiRequest<EditorDraft>(`/admin/documents/editor/drafts/${id}`);
      setDraftId(response.data.id);
      setTitle(response.data.title);
      setPageSettings(response.data.pageSettings);
      latestContent.current = response.data.content;
      editor?.commands.setContent(response.data.content, { emitUpdate: false });
      loaded.current = true;
      setSaveState('saved');
      setFeedback('');
    } catch (error) {
      setSaveState('error');
      setFeedback(errorText(error));
    }
  };

  const createBlank = async () => {
    try {
      const response = await apiRequest<EditorDraft>('/admin/documents/editor/drafts', {
        method: 'POST',
        body: JSON.stringify({ title: 'Untitled document', content: EMPTY_CONTENT, pageSettings: DEFAULT_PAGE_SETTINGS }),
      });
      await loadDraft(response.data.id);
    } catch (error) {
      setSaveState('error');
      setFeedback(errorText(error));
    }
  };

  const duplicateDraft = async () => {
    if (!draftId) return;
    try {
      const response = await apiRequest<EditorDraft>(`/admin/documents/editor/drafts/${draftId}/duplicate`, { method: 'POST' });
      await loadDraft(response.data.id);
    } catch (error) {
      setFeedback(errorText(error));
    }
  };

  const deleteDraft = async () => {
    if (!draftId || !window.confirm('Delete this draft permanently?')) return;
    try {
      await apiRequest(`/admin/documents/editor/drafts/${draftId}`, { method: 'DELETE' });
      setDraftId(null);
      loaded.current = false;
      editor?.commands.setContent(EMPTY_CONTENT, { emitUpdate: false });
      latestContent.current = EMPTY_CONTENT;
      setTitle('Untitled document');
      setPageSettings(DEFAULT_PAGE_SETTINGS);
      await createBlank();
    } catch (error) {
      setFeedback(errorText(error));
    }
  };

  const openDraftList = async () => {
    try {
      await refreshDrafts();
      setShowDrafts(true);
    } catch (error) {
      setFeedback(errorText(error));
    }
  };

  const openIssueDialog = async () => {
    try {
      const [typeResponse, templateResponse] = await Promise.all([
        apiRequest<DocumentType[]>('/admin/documents/types'),
        apiRequest<DocumentTemplate[]>('/admin/documents/templates'),
      ]);
      setTypes(typeResponse.data.filter((type) => type.isApproved));
      setTemplates(templateResponse.data.filter((template) => template.isActive));
      setShowIssueDialog(true);
    } catch (error) {
      setFeedback(errorText(error));
    }
  };

  const saveAndSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draftId) return;
    try {
      await saveDraftNow();
      const response = await apiRequest<{ id: number; status: string }>('/admin/documents/editor/submit', {
        method: 'POST',
        body: JSON.stringify({
          draftId,
          documentTypeId: Number(issueFields.documentTypeId),
          templateId: Number(issueFields.templateId),
          recipientName: issueFields.recipientName,
          subject: issueFields.subject,
          expiresAt: issueFields.expiresAt
            ? new Date(`${issueFields.expiresAt}T23:59:59.000Z`).toISOString()
            : null,
        }),
      });
      setShowIssueDialog(false);
      setFeedback(response.message);
      setSaveState('saved');
    } catch (error) {
      setFeedback(errorText(error));
    }
  };

  const selectedType = useMemo(
    () => types.find((type) => type.id === Number(issueFields.documentTypeId)),
    [issueFields.documentTypeId, types],
  );
  const matchingTemplates = templates.filter((template) => template.documentTypeId === selectedType?.id);
  const wordCount = editor.getText().trim().split(/\s+/).filter(Boolean).length;

  const insertImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !editor) return;
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 4 * 1024 * 1024) {
      setFeedback('Choose a PNG or JPEG image smaller than 4 MB.');
      return;
    }
    const source = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Image could not be read.'));
      reader.onerror = () => reject(new Error('Image could not be read.'));
      reader.readAsDataURL(file);
    });
    editor.chain().focus().setImage({ src: source, alt: file.name }).run();
    setFeedback('');
  };

  const insertLink = () => {
    if (!editor) return;
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const href = window.prompt('Enter a web or email link');
    if (!href) return;
    if (!/^(https?:\/\/|mailto:)/i.test(href)) {
      setFeedback('Links must start with https://, http://, or mailto:.');
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  };

  const changeIndent = (delta: number) => {
    if (!editor) return;
    const type = editor.isActive('heading') ? 'heading' : 'paragraph';
    const current = Number(editor.getAttributes(type).indent) || 0;
    editor.chain().focus().updateAttributes(type, { indent: Math.max(0, Math.min(8, current + delta)) }).run();
  };

  const updatePageSetting = (key: keyof PageSettings, value: string) => {
    setPageSettings((current) => ({
      ...current,
      [key]: key === 'orientation' ? value : Math.max(10, Math.min(40, Number(value) || 10)),
    } as PageSettings));
  };

  const printDocument = () => {
    const pageStyle = document.createElement('style');
    pageStyle.textContent = `@media print { @page { size: A4 ${pageSettings.orientation.toLowerCase()}; margin: 0; } }`;
    document.head.append(pageStyle);
    const cleanup = () => {
      pageStyle.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
  };

  if (!editor) return <div className="py-16 text-center text-sm text-slate-500">Loading editor…</div>;

  return (
    <main className="hb-doc-editor -mx-4 -mt-5 min-h-[calc(100vh-3rem)] bg-[#e9eaec] text-slate-800 dark:bg-[#202224] dark:text-slate-100 sm:-mx-6 lg:-mx-8">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-3 py-2 backdrop-blur dark:border-white/10 dark:bg-[#141617]/95 sm:px-6">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3">
          <button type="button" className={toolbarButton} title="Back to Document Centre" aria-label="Back to Document Centre" onClick={onBack}><ArrowLeft className="h-4 w-4" /></button>
          <FileText className="hidden h-5 w-5 text-slate-500 sm:block" />
          <input
            aria-label="Document title"
            className="min-w-[180px] flex-1 border-b border-transparent bg-transparent px-1 py-1 text-base font-semibold outline-none hover:border-slate-300 focus:border-slate-500 dark:hover:border-white/20"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={180}
          />
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400" role="status">
            {saveState === 'saving' || saveState === 'creating' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : saveState === 'saved' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Save className="h-3.5 w-3.5 text-rose-600" />}
            {saveState === 'creating' ? 'Creating draft' : saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Save failed'}
          </span>
          <button type="button" className={toolbarButton} onClick={() => void openDraftList()} title="Open a saved document"><MoreHorizontal className="h-4 w-4" /><span className="hidden text-xs sm:inline">Open</span></button>
          <button type="button" className={toolbarButton} onClick={() => void createBlank()} title="Create a blank document"><FilePlus2 className="h-4 w-4" /><span className="hidden text-xs sm:inline">New</span></button>
          <button type="button" className={toolbarButton} onClick={printDocument} title="Download or print PDF"><Download className="h-4 w-4" /><span className="hidden text-xs sm:inline">PDF</span></button>
          <button type="button" className={toolbarButton} onClick={printDocument} title="Print"><Printer className="h-4 w-4" /></button>
          <button type="button" className={`${toolbarButton} border border-slate-300 px-3 font-semibold dark:border-white/20`} onClick={() => void openIssueDialog()} title="Submit through the official approval workflow">Submit official</button>
          <button type="button" className={toolbarButton} onClick={() => void duplicateDraft()} title="Duplicate this draft">Duplicate</button>
          <button type="button" className={toolbarButton} onClick={() => void deleteDraft()} title="Delete this draft">Delete</button>
        </div>
        <div className="mx-auto mt-2 flex max-w-[1500px] items-center gap-1 overflow-x-auto border-t border-slate-100 pt-2 dark:border-white/5">
          <EditorButton label="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 className="h-4 w-4" /></EditorButton>
          <EditorButton label="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 className="h-4 w-4" /></EditorButton>
          <span className="mx-1 h-5 border-l border-slate-200 dark:border-white/10" />
          <select aria-label="Paragraph style" className={selectClass} value={editor.isActive('heading', { level: 1 }) ? 'h1' : editor.isActive('heading', { level: 2 }) ? 'h2' : editor.isActive('heading', { level: 3 }) ? 'h3' : 'p'} onChange={(event) => {
            if (event.target.value === 'p') editor.chain().focus().setParagraph().run();
            else editor.chain().focus().toggleHeading({ level: Number(event.target.value.slice(1)) as 1 | 2 | 3 }).run();
          }}>
            <option value="p">Paragraph</option><option value="h1">Title</option><option value="h2">Heading</option><option value="h3">Subheading</option>
          </select>
          <select aria-label="Font family" className={`${selectClass} w-28`} defaultValue="Arial" onChange={(event) => editor.chain().focus().setMark('textStyle', { fontFamily: event.target.value }).run()}>
            <option>Arial</option><option>Georgia</option><option>Times New Roman</option><option>Verdana</option><option>Courier New</option>
          </select>
          <select aria-label="Font size" className={`${selectClass} w-16`} defaultValue="12pt" onChange={(event) => editor.chain().focus().setMark('textStyle', { fontSize: event.target.value }).run()}>
            {['8pt', '9pt', '10pt', '11pt', '12pt', '14pt', '16pt', '18pt', '24pt', '32pt', '48pt'].map((size) => <option key={size}>{size}</option>)}
          </select>
          <EditorButton label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></EditorButton>
          <EditorButton label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></EditorButton>
          <EditorButton label="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="h-4 w-4" /></EditorButton>
          <EditorButton label="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></EditorButton>
          <label className="relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-white/10" title="Text colour">
            <span className="text-sm font-bold text-slate-600 dark:text-slate-300">A</span><input aria-label="Text colour" type="color" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" onChange={(event) => editor.chain().focus().setColor(event.target.value).run()} />
          </label>
          <label className="relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-white/10" title="Highlight">
            <Highlighter className="h-4 w-4" /><input aria-label="Text highlight" type="color" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" onChange={(event) => editor.chain().focus().setHighlight({ color: event.target.value }).run()} />
          </label>
          <span className="mx-1 h-5 border-l border-slate-200 dark:border-white/10" />
          <EditorButton label="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft className="h-4 w-4" /></EditorButton>
          <EditorButton label="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter className="h-4 w-4" /></EditorButton>
          <EditorButton label="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight className="h-4 w-4" /></EditorButton>
          <select aria-label="Line spacing" className={selectClass} defaultValue="1.5" onChange={(event) => {
            const type = editor.isActive('heading') ? 'heading' : 'paragraph';
            editor.chain().focus().updateAttributes(type, { lineHeight: event.target.value }).run();
          }}>
            <option value="1">Single</option><option value="1.15">1.15</option><option value="1.5">1.5</option><option value="2">Double</option>
          </select>
          <EditorButton label="Decrease indent" onClick={() => changeIndent(-1)}><ChevronDown className="h-4 w-4 rotate-90" /></EditorButton>
          <EditorButton label="Increase indent" onClick={() => changeIndent(1)}><ChevronDown className="h-4 w-4 -rotate-90" /></EditorButton>
          <EditorButton label="Bulleted list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></EditorButton>
          <EditorButton label="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></EditorButton>
          <span className="mx-1 h-5 border-l border-slate-200 dark:border-white/10" />
          <EditorButton label="Insert table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 className="h-4 w-4" /></EditorButton>
          <EditorButton label="Insert image" onClick={() => imageInput.current?.click()}><ImagePlus className="h-4 w-4" /></EditorButton>
          <EditorButton label="Add or remove hyperlink" active={editor.isActive('link')} onClick={insertLink}><Link2 className="h-4 w-4" /></EditorButton>
          <EditorButton label="Insert page break" onClick={() => editor.chain().focus().insertContent({ type: 'pageBreak' }).run()}><FilePlus2 className="h-4 w-4" /></EditorButton>
          <button type="button" className={toolbarButton} onClick={() => setShowPageSetup(true)} title="Page size and margins"><span className="text-xs">A4</span><Clock3 className="h-3.5 w-3.5" /></button>
          {editor.isActive('image') && (
            <select aria-label="Selected image width" className={selectClass} defaultValue="100%" onChange={(event) => editor.chain().focus().updateAttributes('image', { width: event.target.value }).run()}>
              <option value="25%">Image 25%</option><option value="50%">Image 50%</option><option value="75%">Image 75%</option><option value="100%">Image 100%</option>
            </select>
          )}
          <input ref={imageInput} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(event) => void insertImage(event)} />
        </div>
      </header>

      {feedback && <div role="alert" className={`mx-auto mt-3 max-w-4xl rounded-lg px-4 py-2 text-sm ${saveState === 'error' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200'}`}>{feedback}</div>}

      <section className="min-h-[calc(100vh-8rem)] overflow-auto px-3 py-8 sm:px-8" aria-label="A4 document workspace">
        <div className="hb-doc-page mx-auto text-black">
          <EditorContent editor={editor} />
        </div>
      </section>

      <footer className="sticky bottom-0 z-20 flex h-9 items-center justify-between border-t border-slate-200 bg-white/95 px-4 text-[11px] text-slate-500 backdrop-blur dark:border-white/10 dark:bg-[#141617]/95 dark:text-slate-400">
        <span>A4 · {pageSettings.orientation.toLowerCase()} · Changes save automatically</span>
        <span>{wordCount} words</span>
      </footer>

      {showDrafts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowDrafts(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="editor-drafts-title" className="max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-[#17191b]">
            <div className="flex items-center justify-between"><h2 id="editor-drafts-title" className="text-lg font-semibold">Your documents</h2><button className={toolbarButton} type="button" onClick={() => setShowDrafts(false)} aria-label="Close"><X className="h-4 w-4" /></button></div>
            <div className="mt-4 divide-y divide-slate-200 dark:divide-white/10">
              {drafts.map((draft) => <button key={draft.id} type="button" className="flex w-full items-center justify-between gap-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/5" onClick={() => void loadDraft(draft.id)}><span className="font-medium">{draft.title || 'Untitled document'}</span><span className="text-xs text-slate-500">{new Date(draft.updatedAt).toLocaleString()}</span></button>)}
              {!drafts.length && <p className="py-8 text-center text-sm text-slate-500">No saved drafts yet.</p>}
            </div>
          </section>
        </div>
      )}

      {showPageSetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowPageSetup(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="page-setup-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#17191b]">
            <div className="mb-5 flex items-center justify-between"><h2 id="page-setup-title" className="text-lg font-semibold">Page setup</h2><button className={toolbarButton} type="button" onClick={() => setShowPageSetup(false)} aria-label="Close"><X className="h-4 w-4" /></button></div>
            <label className="mb-4 block text-sm">Paper size <input readOnly value="A4 · 210 × 297 mm" className={`${selectClass} mt-1 block w-full`} /></label>
            <label className="mb-4 block text-sm">Orientation
              <select className={`${selectClass} mt-1 block w-full`} value={pageSettings.orientation} onChange={(event) => updatePageSetting('orientation', event.target.value)}>
                <option value="PORTRAIT">Portrait</option><option value="LANDSCAPE">Landscape</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(['marginTop', 'marginRight', 'marginBottom', 'marginLeft'] as const).map((field) => <label key={field} className="text-sm capitalize">{field.replace('margin', '')} margin (mm)<input type="number" min="10" max="40" className={`${selectClass} mt-1 block w-full`} value={pageSettings[field]} onChange={(event) => updatePageSetting(field, event.target.value)} /></label>)}
            </div>
            <label className="mt-4 block text-sm">Header (optional)<input maxLength={180} className={`${selectClass} mt-1 block w-full`} value={pageSettings.headerText} onChange={(event) => setPageSettings((current) => ({ ...current, headerText: event.target.value }))} /></label>
            <label className="mt-3 block text-sm">Footer (optional)<input maxLength={180} className={`${selectClass} mt-1 block w-full`} value={pageSettings.footerText} onChange={(event) => setPageSettings((current) => ({ ...current, footerText: event.target.value }))} /></label>
            <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={pageSettings.showPageNumbers} onChange={(event) => setPageSettings((current) => ({ ...current, showPageNumbers: event.target.checked }))} />Show page numbers when printing</label>
            <button type="button" className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950" onClick={() => setShowPageSetup(false)}>Done</button>
          </section>
        </div>
      )}

      {showIssueDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowIssueDialog(false); }}>
          <form onSubmit={(event) => void saveAndSubmit(event)} className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#17191b]">
            <div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Submit official document</h2><p className="mt-1 text-xs text-slate-500">Your editable draft is saved separately. Official issuance adds reference and verification metadata.</p></div><button className={toolbarButton} type="button" onClick={() => setShowIssueDialog(false)} aria-label="Close"><X className="h-4 w-4" /></button></div>
            <label className="block text-sm">Approved category<select required className={`${selectClass} mt-1 block w-full`} value={issueFields.documentTypeId} onChange={(event) => setIssueFields((current) => ({ ...current, documentTypeId: event.target.value, templateId: '' }))}><option value="">Select category</option>{types.map((type) => <option key={type.id} value={type.id}>{type.displayName}</option>)}</select></label>
            <label className="block text-sm">Active template<select required disabled={!matchingTemplates.length} className={`${selectClass} mt-1 block w-full`} value={issueFields.templateId} onChange={(event) => setIssueFields((current) => ({ ...current, templateId: event.target.value }))}><option value="">Select template</option>{matchingTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
            <label className="block text-sm">Recipient name<input required maxLength={180} className={`${selectClass} mt-1 block w-full`} value={issueFields.recipientName} onChange={(event) => setIssueFields((current) => ({ ...current, recipientName: event.target.value }))} /></label>
            <label className="block text-sm">Document subject<input required maxLength={240} className={`${selectClass} mt-1 block w-full`} value={issueFields.subject} onChange={(event) => setIssueFields((current) => ({ ...current, subject: event.target.value }))} /></label>
            <label className="block text-sm">Expiry date (optional)<input type="date" className={`${selectClass} mt-1 block w-full`} value={issueFields.expiresAt} onChange={(event) => setIssueFields((current) => ({ ...current, expiresAt: event.target.value }))} /></label>
            <p className="text-xs text-slate-500">Submission follows the category's configured approval policy. References and QR verification are assigned by the existing issuance service.</p>
            <div className="flex justify-end gap-2"><button type="button" className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-white/15" onClick={() => setShowIssueDialog(false)}>Cancel</button><button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">Save and submit</button></div>
          </form>
        </div>
      )}
    </main>
  );
}
