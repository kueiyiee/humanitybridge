import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Search, ShieldCheck } from 'lucide-react';
import { apiRequest } from '../../services/api';
import { ResilientImage } from '../../components/ResilientImage';
import { renderStoryBody } from '../../utils/storyContent';

interface StoryItem {
  id: number;
  slug: string;
  title: string;
  regionName: string;
  excerpt: string;
  coverImageUrl: string | null;
  coverAltText: string | null;
  anonymousPublication: boolean;
  publishedAt: string | null;
  categoryName: string;
  categorySlug: string;
  media?: Array<{ url: string; altText: string; caption: string | null }>;
}

export function OurStoriesPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  const { data: taxData } = useQuery({
    queryKey: ['taxonomy'],
    queryFn: () =>
      apiRequest<{ storyCategories: Array<{ id: number; slug: string; name: string }> }>('/meta/taxonomy'),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['public-stories', category, search],
    queryFn: () =>
      apiRequest<StoryItem[]>(
        `/stories?category=${encodeURIComponent(category)}&q=${encodeURIComponent(search)}`,
      ),
  });

  const stories = data?.data || [];
  const categories = taxData?.data?.storyCategories || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#123F69] dark:text-[#00BCEB]">
          Editorial Dispatches
        </p>
        <h1 className="mt-2 font-editorial text-4xl font-semibold text-[#0B1F3A] dark:text-white">
          Our Stories
        </h1>
        <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
          Every story published on HumanityBridge carries explicit consent, safeguarding review, and verified
          community context.
        </p>
      </div>

      <div className="mt-8 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, region, or keyword..."
            aria-label="Search humanitarian stories"
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-[#00BCEB]"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCategory('')}
            className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors ${
              category === ''
                ? 'bg-[#0B1F3A] dark:bg-[#00BCEB] text-white dark:text-[#071324]'
                : 'bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.slug)}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                category === cat.slug
                  ? 'bg-[#0B1F3A] dark:bg-[#00BCEB] text-white dark:text-[#071324]'
                  : 'bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-80 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : stories.length === 0 ? (
        <div className="mt-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D223D] p-12 text-center">
          <p className="text-sm text-[#748196] dark:text-slate-400">
            No published stories match your current filters.
          </p>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-8">
          {stories.map((story) => (
            <article
              key={story.id}
              className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col"
            >
              <div className="aspect-[4/3] overflow-hidden bg-slate-100 dark:bg-slate-900">
                <ResilientImage
                  src={story.coverImageUrl}
                  alt={story.coverAltText || story.title}
                  className="w-full h-full object-cover"
                  fallbackTitle={story.title}
                />
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <div className="text-xs text-[#748196] dark:text-slate-400 flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-[#123F69] dark:text-[#00BCEB]">{story.categoryName}</span>
                  <span aria-hidden="true">·</span>
                  <span>{story.regionName}</span>
                </div>
                <h2 className="mt-2 font-editorial text-xl font-semibold text-[#0B1F3A] dark:text-white">
                  {story.title}
                </h2>
                <p className="mt-2.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed flex-1">
                  {story.excerpt}
                </p>
                <Link
                  to={`/stories/${story.slug}`}
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0B1F3A] dark:text-[#00BCEB] hover:underline"
                >
                  <span>Read Story</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

interface StoryDetail extends StoryItem {
  body: string;
  authorName: string;
  isMinorSubject: boolean;
}

export function StoryDetailsPage() {
  const { slug } = useParams();
  const [shareMessage, setShareMessage] = useState('');
  const { data, isLoading, isError } = useQuery({
    queryKey: ['story-detail', slug],
    queryFn: () => apiRequest<StoryDetail>(`/stories/${slug}`),
  });

  useEffect(() => {
    const story = data?.data;
    if (!story) return;
    const previousTitle = document.title;
    const tags = [
      ['name', 'description', story.excerpt],
      ['property', 'og:title', story.title],
      ['property', 'og:description', story.excerpt],
      ['property', 'og:type', 'article'],
      ['property', 'og:url', new URL(`/stories/${story.slug}`, window.location.origin).href],
      ...(story.coverImageUrl
        ? [['property', 'og:image', new URL(story.coverImageUrl, window.location.origin).href]]
        : []),
    ];
    const previous = tags.map(([attribute, name]) => {
      let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`);
      const created = !element;
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, name);
        document.head.appendChild(element);
      }
      const oldContent = element.getAttribute('content');
      return { element, created, oldContent, content: tags.find((tag) => tag[1] === name)?.[2] || '' };
    });
    const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const createdCanonical = !canonical;
    const canonicalLink = canonical || document.createElement('link');
    if (createdCanonical) {
      canonicalLink.rel = 'canonical';
      document.head.appendChild(canonicalLink);
    }
    const previousCanonical = canonicalLink.href;
    canonicalLink.href = new URL(`/stories/${story.slug}`, window.location.origin).href;
    document.title = `${story.title} | HumanityBridge`;
    previous.forEach(({ element, content }) => element.setAttribute('content', content));
    return () => {
      document.title = previousTitle;
      previous.forEach(({ element, created, oldContent }) => {
        if (created) element.remove();
        else if (oldContent === null) element.removeAttribute('content');
        else element.setAttribute('content', oldContent);
      });
      if (createdCanonical) canonicalLink.remove();
      else canonicalLink.href = previousCanonical;
    };
  }, [data?.data]);

  if (isLoading) {
    return <div className="max-w-3xl mx-auto px-4 py-16 text-sm text-slate-500">Loading story...</div>;
  }

  if (isError || !data?.data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="font-editorial text-2xl font-semibold">Story unavailable</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          This story may not be published or consent may have been withdrawn.
        </p>
        <Link to="/stories" className="mt-6 inline-block text-sm font-semibold text-[#123F69] dark:text-[#00BCEB]">
          Return to Our Stories
        </Link>
      </div>
    );
  }

  const story = data.data;
  const shareStory = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: story.title, text: story.excerpt, url: window.location.href });
        setShareMessage('Story shared.');
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setShareMessage('Story link copied.');
      }
    } catch (error) {
      setShareMessage(error instanceof Error ? error.message : 'Sharing is not available in this browser.');
    }
  };

  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <Link
        to="/stories"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#748196] dark:text-slate-400 hover:text-[#0B1F3A] dark:hover:text-white mb-6"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        <span>Back to Our Stories</span>
      </Link>

      <div className="text-xs text-[#748196] dark:text-slate-400 flex flex-wrap items-center gap-2">
        <span className="font-semibold text-[#123F69] dark:text-[#00BCEB]">{story.categoryName}</span>
        <span aria-hidden="true">·</span>
        <span>{story.regionName}</span>
        {story.publishedAt && (
          <>
            <span aria-hidden="true">·</span>
            <span>Published {new Date(story.publishedAt).toLocaleDateString()}</span>
          </>
        )}
      </div>

      <h1 className="mt-3 font-editorial text-3xl sm:text-5xl font-semibold text-[#0B1F3A] dark:text-white leading-tight">
        {story.title}
      </h1>

      <p className="mt-4 text-sm text-[#748196] dark:text-slate-400">
        Documented by {story.authorName}
      </p>

      {story.coverImageUrl && (
        <figure className="mt-8">
          <div className="aspect-[16/10] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <ResilientImage
              src={story.coverImageUrl}
              alt={story.coverAltText || story.title}
              className="w-full h-full object-cover"
              fallbackTitle={story.title}
            />
          </div>
          <figcaption className="mt-2.5 text-xs italic text-[#748196] dark:text-slate-400">
            {story.regionName} · Published with documented media and narrative consent.
          </figcaption>
        </figure>
      )}
      {story.media && story.media.length > 0 && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2" aria-label="Story image gallery">
          {story.media.map((image, index) => (
            <figure key={`${story.id}-${index}`} className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
              <ResilientImage src={image.url} alt={image.altText} className="w-full aspect-[4/3] object-cover" fallbackTitle={story.title} />
              {image.caption && <figcaption className="px-3 py-2 text-xs text-slate-500">{image.caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}

      <div className="mt-8 p-4 rounded-xl bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#16865D] dark:text-[#1FA977] shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Safeguarding Notice: Explicit consent for publication was verified prior to release.
          {story.isMinorSubject && ' Minor-related safeguarding protocols applied with guardian consent and identity protection.'}
        </p>
      </div>

      <div className="mt-8 space-y-5 max-w-prose text-base sm:text-lg leading-relaxed text-[#152238] dark:text-slate-200">
        {renderStoryBody(story.body)}
      </div>
      <div className="mt-8 flex items-center gap-3">
        <button type="button" onClick={() => void shareStory()} className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium">
          Share story
        </button>
        {shareMessage && <span role="status" className="text-xs text-slate-500">{shareMessage}</span>}
      </div>
    </article>
  );
}
