import React, { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, CalendarDays, MapPin } from 'lucide-react';
import { CMS_CONTENT_SECTIONS, type CmsContentType } from '../../../packages/shared/types';
import { apiRequest } from '../../services/api';

type CmsPublicRecord = {
  id: number;
  type: CmsContentType;
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string;
  body: {
    type: 'doc';
    content?: Array<{
      type: string;
      text?: string;
      attrs?: Record<string, unknown>;
      marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
      content?: CmsPublicRecord['body']['content'];
    }>;
  };
  category: string | null;
  location: string | null;
  coverImageUrl: string | null;
  coverAltText: string | null;
  attachments: Array<{ url: string; name: string; mimeType: string }>;
  externalUrl: string | null;
  publishedAt: string | null;
  authorName: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
};

function isSafeLink(value: string): boolean {
  if (value.startsWith('/api/v1/media/public/')) return true;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function renderText(node: NonNullable<CmsPublicRecord['body']['content']>[number], key: string): React.ReactNode {
  let content: React.ReactNode = node.text || '';
  for (const mark of node.marks || []) {
    if (mark.type === 'bold') content = <strong key={`${key}-bold`}>{content}</strong>;
    else if (mark.type === 'italic') content = <em key={`${key}-italic`}>{content}</em>;
    else if (mark.type === 'underline') content = <u key={`${key}-underline`}>{content}</u>;
    else if (mark.type === 'strike') content = <s key={`${key}-strike`}>{content}</s>;
    else if (mark.type === 'code') content = <code key={`${key}-code`} className="rounded bg-slate-100 px-1 dark:bg-white/10">{content}</code>;
    else if (mark.type === 'link') {
      const href = String(mark.attrs?.href || '');
      if (isSafeLink(href)) content = <a key={`${key}-link`} href={href} rel="noreferrer" target="_blank" className="underline underline-offset-2">{content}</a>;
    } else if (mark.type === 'highlight') {
      const color = String(mark.attrs?.color || '#fef08a');
      content = <mark key={`${key}-highlight`} style={{ backgroundColor: color }}>{content}</mark>;
    } else if (mark.type === 'textStyle') {
      const color = String(mark.attrs?.color || '');
      if (/^#[0-9a-f]{3,8}$/i.test(color)) content = <span key={`${key}-color`} style={{ color }}>{content}</span>;
    }
  }
  return content;
}

function renderNode(node: NonNullable<CmsPublicRecord['body']['content']>[number], key: string): React.ReactNode {
  if (node.type === 'text') return renderText(node, key);
  const children = (node.content || []).map((child, index) => (
    <React.Fragment key={`${key}-${index}`}>{renderNode(child, `${key}-${index}`)}</React.Fragment>
  ));
  if (node.type === 'doc' || node.type === 'listItem' || node.type === 'tableCell' || node.type === 'tableHeader') {
    if (node.type === 'tableCell' || node.type === 'tableHeader') {
      return node.type === 'tableHeader' ? <th className="border border-slate-300 px-3 py-2 text-left dark:border-slate-600">{children}</th> :
        <td className="border border-slate-300 px-3 py-2 dark:border-slate-600">{children}</td>;
    }
    return <>{children}</>;
  }
  if (node.type === 'paragraph') return <p className="my-4 leading-7">{children}</p>;
  if (node.type === 'heading') {
    const level = Math.min(3, Math.max(1, Number(node.attrs?.level) || 2));
    const className = level === 1 ? 'my-6 text-3xl font-semibold' : level === 2 ? 'my-5 text-2xl font-semibold' : 'my-4 text-xl font-semibold';
    if (level === 1) return <h1 className={className}>{children}</h1>;
    if (level === 2) return <h2 className={className}>{children}</h2>;
    return <h3 className={className}>{children}</h3>;
  }
  if (node.type === 'bulletList') return <ul className="my-4 list-disc space-y-2 pl-6">{children}</ul>;
  if (node.type === 'orderedList') return <ol className="my-4 list-decimal space-y-2 pl-6">{children}</ol>;
  if (node.type === 'blockquote') return <blockquote className="my-5 border-l-4 border-slate-300 pl-4 italic dark:border-slate-600">{children}</blockquote>;
  if (node.type === 'codeBlock') return <pre className="my-4 overflow-x-auto rounded-lg bg-slate-100 p-4 text-sm dark:bg-white/10"><code>{children}</code></pre>;
  if (node.type === 'horizontalRule') return <hr className="my-6 border-slate-200 dark:border-slate-700" />;
  if (node.type === 'hardBreak') return <br />;
  if (node.type === 'image') {
    const src = String(node.attrs?.src || '');
    if (!isSafeLink(src)) return null;
    return <img src={src} alt={String(node.attrs?.alt || '')} className="my-6 max-h-[34rem] max-w-full rounded-xl object-contain" loading="lazy" />;
  }
  if (node.type === 'table') return <div className="my-5 overflow-x-auto"><table className="w-full border-collapse">{children}</table></div>;
  if (node.type === 'tableRow') return <tr>{children}</tr>;
  return <>{children}</>;
}

function RichContent({ body }: { body: CmsPublicRecord['body'] }) {
  return (
    <div className="cms-rich-content text-slate-700 dark:text-slate-200">
      {(body.content || []).map((node, index) => <React.Fragment key={index}>{renderNode(node, `node-${index}`)}</React.Fragment>)}
    </div>
  );
}

function usePageMetadata(title?: string | null, description?: string | null) {
  useEffect(() => {
    if (title) document.title = `${title} | HumanityBridge`;
    if (!description) return;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const created = !meta;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }
    meta.content = description;
    return () => {
      if (created) meta?.remove();
    };
  }, [title, description]);
}

function PublishedDate({ value }: { value: string | null }) {
  if (!value) return null;
  return <time dateTime={value} className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{new Date(value).toLocaleDateString()}</time>;
}

export function CmsContentListingPage({ type }: { type: CmsContentType }) {
  const section = CMS_CONTENT_SECTIONS[type];
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['public-cms-content', type],
    queryFn: () => apiRequest<CmsPublicRecord[]>(`/cms-content/${type}`),
  });
  const records = data?.data || [];
  usePageMetadata(section.label, `Latest ${section.label.toLowerCase()} from HumanityBridge.`);

  return (
    <main className="mx-auto min-h-[65vh] max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <header className="mb-9 max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">HumanityBridge · Public information</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900 dark:text-white">{section.label}</h1>
      </header>
      {isLoading ? <p role="status" className="py-12 text-center text-slate-500">Loading published content…</p> :
        isError ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error instanceof Error ? error.message : 'Published content is temporarily unavailable.'}</p> :
          records.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600 dark:border-slate-800 dark:bg-[#0D223D] dark:text-slate-300">There are no published items in this section yet.</p> :
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {records.map((record) => (
                <article key={record.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#0D223D]">
                  {record.coverImageUrl && <img src={record.coverImageUrl} alt={record.coverAltText || record.title} className="aspect-[16/9] w-full object-cover" loading="lazy" />}
                  <div className="p-5">
                    <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                      {record.category && <span className="font-semibold">{record.category}</span>}
                      <PublishedDate value={record.publishedAt} />
                    </div>
                    <h2 className="mt-3 text-xl font-semibold text-slate-900 dark:text-white">{record.title}</h2>
                    {record.subtitle && <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">{record.subtitle}</p>}
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-400">{record.summary || 'Read the full update.'}</p>
                    <Link to={`/${section.path}/${record.slug}`} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-900 hover:underline dark:text-white">Read more <ArrowRight className="h-4 w-4" /></Link>
                  </div>
                </article>
              ))}
            </div>}
    </main>
  );
}

export function CmsContentDetailPage({ type }: { type: CmsContentType }) {
  const { slug } = useParams<{ slug: string }>();
  const section = CMS_CONTENT_SECTIONS[type];
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['public-cms-content', type, slug],
    queryFn: () => apiRequest<CmsPublicRecord>(`/cms-content/${type}/${encodeURIComponent(slug || '')}`),
    enabled: Boolean(slug),
  });
  const record = data?.data;
  usePageMetadata(record?.seoTitle || record?.title, record?.seoDescription || record?.summary);

  if (isLoading) return <main className="mx-auto min-h-[65vh] max-w-4xl px-5 py-16 text-center text-slate-500">Loading published content…</main>;
  if (isError || !record) return <main className="mx-auto min-h-[65vh] max-w-4xl px-5 py-16"><p role="alert" className="rounded-xl border border-slate-200 p-6 text-center text-slate-600 dark:border-slate-800 dark:text-slate-300">{error instanceof Error ? error.message : 'This published item could not be found.'}</p></main>;

  return (
    <main className="mx-auto min-h-[65vh] max-w-4xl px-5 py-10 sm:px-8 sm:py-16">
      <Link to={`/${section.path}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:underline dark:text-slate-300"><ArrowLeft className="h-4 w-4" /> All {section.label.toLowerCase()}</Link>
      <article className="mt-7">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
          {record.category && <span className="font-semibold">{record.category}</span>}
          <PublishedDate value={record.publishedAt} />
          {record.location && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{record.location}</span>}
          {record.authorName && <span>By {record.authorName}</span>}
        </div>
        <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-5xl">{record.title}</h1>
        {record.subtitle && <p className="mt-4 text-xl leading-8 text-slate-600 dark:text-slate-300">{record.subtitle}</p>}
        {record.coverImageUrl && <img src={record.coverImageUrl} alt={record.coverAltText || record.title} className="mt-8 max-h-[34rem] w-full rounded-2xl object-cover" />}
        {record.summary && <p className="mt-8 border-l-2 border-slate-300 pl-5 text-lg leading-8 text-slate-600 dark:border-slate-600 dark:text-slate-300">{record.summary}</p>}
        <div className="mt-8"><RichContent body={record.body} /></div>
        {record.attachments.length > 0 && (
          <section className="mt-10 border-t border-slate-200 pt-6 dark:border-slate-800">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Related files</h2>
            <ul className="mt-3 space-y-2">
              {record.attachments.filter((file) => isSafeLink(file.url)).map((file) => <li key={file.url}><a href={file.url} target="_blank" rel="noreferrer" className="text-sm font-medium underline underline-offset-2">{file.name}</a></li>)}
            </ul>
          </section>
        )}
        {record.externalUrl && isSafeLink(record.externalUrl) && <a href={record.externalUrl} target="_blank" rel="noreferrer" className="mt-8 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700">More information <ArrowRight className="h-4 w-4" /></a>}
      </article>
    </main>
  );
}
