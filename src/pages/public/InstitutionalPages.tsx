import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { apiRequest } from '../../services/api';
import { ResilientImage } from '../../components/ResilientImage';

export function AboutUsPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-12">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#123F69] dark:text-[#00BCEB]">
          Who We Are
        </p>
        <h1 className="mt-2 font-editorial text-4xl font-semibold text-[#0B1F3A] dark:text-white">
          About HumanityBridge
        </h1>
        <p className="mt-4 text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
          HumanityBridge is a humanitarian storytelling, community assistance, and social-impact technology platform
          built to connect vulnerable communities with compassionate supporters while rigorously protecting dignity,
          consent, and financial integrity.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          ['Dignity & Consent', 'Stories and cases are published only when informed, documented consent is recorded and verified.'],
          ['Two-Layer Privacy', 'Confidential contact records and sensitive documents are strictly separated from public impact directories.'],
          ['Auditable Accountability', 'Every confirmed contribution and disbursement passes through verifiable gateway and audit trails.'],
        ].map(([title, body]) => (
          <div key={title} className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h2 className="font-editorial text-xl font-semibold text-[#0B1F3A] dark:text-white">{title}</h2>
            <p className="mt-2.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{body}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-4">
        <Link to="/mission" className="px-5 py-2.5 rounded-lg bg-[#0B1F3A] dark:bg-[#00BCEB] text-white dark:text-[#071324] text-sm font-semibold">
          Explore Mission & Vision
        </Link>
        <Link to="/how-it-works" className="px-5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold">
          How Verification Works
        </Link>
      </div>
    </div>
  );
}

export function MissionVisionPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-[#16865D] dark:text-[#1FA977]">
          Purpose & Values
        </p>
        <h1 className="mt-2 font-editorial text-4xl font-semibold text-[#0B1F3A] dark:text-white">
          Mission & Vision
        </h1>
      </div>

      <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-8 space-y-6">
        <div>
          <h2 className="font-editorial text-2xl font-semibold text-[#0B1F3A] dark:text-white">Core Mission</h2>
          <p className="mt-2 text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            To connect vulnerable communities with opportunities, resources, and compassionate assistance while preserving
            human dignity, privacy, transparency, and accountability.
          </p>
        </div>
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
          <h2 className="font-editorial text-2xl font-semibold text-[#0B1F3A] dark:text-white">Guiding Values</h2>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm font-medium text-slate-700 dark:text-slate-200">
            {[
              'Human Dignity',
              'Compassion',
              'Integrity',
              'Transparency',
              'Accountability',
              'Community Empowerment',
              'Inclusion',
              'Trust',
              'Responsible Humanitarian Action',
            ].map((val) => (
              <div key={val} className="p-3.5 rounded-lg bg-[#F7F9FC] dark:bg-[#071324] border border-slate-200 dark:border-slate-800">
                {val}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function HowItWorksPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-10">
      <div className="max-w-2xl">
        <h1 className="font-editorial text-4xl font-semibold text-[#0B1F3A] dark:text-white">
          How HumanityBridge Works
        </h1>
        <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
          Humanitarian verification and transparent resource delivery follow four disciplined stages.
        </p>
      </div>

      <div className="space-y-4">
        {[
          ['01. Community Discovery & Documentation', 'Authorized Community Coordinators work alongside local committees to document verified community needs while keeping personal contact information in private records.'],
          ['02. Administrative & Safeguarding Verification', 'Platform Administrators inspect evidence, verify guardian or beneficiary consent, redact identifying details when required, and issue a public QR-verifiable reference.'],
          ['03. Direct & Verified Support', 'Supporters contribute to verified cases or campaigns. Funds update totals only after signed payment gateway verification.'],
          ['04. Field Delivery & Impact Reporting', 'Coordinators log field visits and assistance delivered, creating a transparent chain from contribution to community outcome.'],
        ].map(([title, desc]) => (
          <div key={title} className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h2 className="font-editorial text-xl font-semibold text-[#0B1F3A] dark:text-white">{title}</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GetInvolvedPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-10">
      <div className="max-w-2xl">
        <h1 className="font-editorial text-4xl font-semibold text-[#0B1F3A] dark:text-white">
          Get Involved
        </h1>
        <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
          Join HumanityBridge as a contributor, skilled volunteer, community coordinator applicant, or organisational partner.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="font-editorial text-xl font-semibold">Volunteer Your Skills</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Contribute medical, engineering, translation, or logistics expertise to regional programs.
            </p>
          </div>
          <Link to="/volunteer" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[#123F69] dark:text-[#00BCEB]">
            <span>Apply as Volunteer</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="font-editorial text-xl font-semibold">Organisational Partnerships</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Collaborate with HumanityBridge as an NGO, foundation, medical mission, or academic institution.
            </p>
          </div>
          <Link to="/partnerships" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[#123F69] dark:text-[#00BCEB]">
            <span>Submit Partnership Enquiry</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="font-editorial text-xl font-semibold">Community Coordinator Portal</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Regional leaders can apply for an authorised coordinator account subject to administrative vetting.
            </p>
          </div>
          <Link to="/login?tab=register" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[#123F69] dark:text-[#00BCEB]">
            <span>Apply for Coordinator Access</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

interface ArticleItem {
  id: number;
  slug: string;
  title: string;
  summary: string;
  body?: string;
  coverImageUrl: string | null;
  publishedAt: string;
  categoryName: string;
}

export function NewsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['public-articles'],
    queryFn: () => apiRequest<ArticleItem[]>('/articles'),
  });
  const articles = data?.data || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-2xl mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#123F69] dark:text-[#00BCEB]">
          Publications & Briefs
        </p>
        <h1 className="mt-2 font-editorial text-4xl font-semibold text-[#0B1F3A] dark:text-white">
          Community News
        </h1>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {[1, 2].map((i) => (
            <div key={i} className="h-72 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <p className="text-sm text-[#748196]">No community news publications are available yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {articles.map((art) => (
            <article key={art.id} className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col">
              <div className="aspect-[16/9] bg-slate-100 dark:bg-slate-900">
                <ResilientImage src={art.coverImageUrl} alt={art.title} className="w-full h-full object-cover" fallbackTitle={art.title} />
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <p className="text-xs text-[#748196] dark:text-slate-400">
                  {art.categoryName} · {new Date(art.publishedAt).toLocaleDateString()}
                </p>
                <h2 className="mt-2 font-editorial text-2xl font-semibold text-[#0B1F3A] dark:text-white">{art.title}</h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 flex-1">{art.summary}</p>
                <Link to={`/news/${art.slug}`} className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#123F69] dark:text-[#00BCEB]">
                  <span>Read Publication</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function NewsDetailsPage() {
  const { slug } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ['public-article', slug],
    queryFn: () => apiRequest<ArticleItem>(`/articles/${slug}`),
  });

  if (isLoading) return <div className="max-w-3xl mx-auto px-4 py-16 text-sm">Loading article...</div>;
  if (!data?.data) return <div className="max-w-3xl mx-auto px-4 py-16">Article not found.</div>;

  const art = data.data;
  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <Link to="/news" className="inline-flex items-center gap-1.5 text-sm text-[#748196] mb-6">
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Community News</span>
      </Link>
      <p className="text-xs text-[#748196]">{art.categoryName} · {new Date(art.publishedAt).toLocaleDateString()}</p>
      <h1 className="mt-2 font-editorial text-3xl sm:text-4xl font-semibold text-[#0B1F3A] dark:text-white">{art.title}</h1>
      <div className="mt-6 space-y-4 text-base text-slate-700 dark:text-slate-200 leading-relaxed">
        {(art.body || art.summary).split(/\n\n+/).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </article>
  );
}

export function FAQPage() {
  const faqs = [
    ['How are humanitarian cases verified?', 'Every submitted case is reviewed by a Platform Administrator who inspects supporting evidence, checks consent records, and redacts any identifying contact details before public listing.'],
    ['Are beneficiary phone numbers or addresses ever published?', 'No. Private contact names, phone numbers, and exact household coordinates remain strictly inside access-controlled administrative vaults.'],
    ['How does HumanityBridge verify donations?', 'Contributions create an intent and are confirmed solely when a signed gateway settlement callback is received and verified idempotently.'],
    ['Can a Community Coordinator approve their own submission?', 'Never. Role permissions strictly separate field intake (COMMUNITY_COORDINATOR) from verification, publication, and financial governance (PLATFORM_ADMIN).'],
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-8">
      <h1 className="font-editorial text-4xl font-semibold text-[#0B1F3A] dark:text-white">
        Frequently Asked Questions
      </h1>
      <div className="space-y-4">
        {faqs.map(([q, a]) => (
          <div key={q} className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h2 className="font-editorial text-lg font-semibold text-[#0B1F3A] dark:text-white">{q}</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
