import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { apiRequest } from '../../services/api';
import { ResilientImage } from '../../components/ResilientImage';
import { BrandLogo } from '../../components/BrandLogo';

export function AboutUsPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-12">
      <div className="max-w-3xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          <BrandLogo className="h-[41px] w-[123px] shrink-0 sm:h-[46px] sm:w-[138px]" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#123F69] dark:text-[#00BCEB]">
              Who We Are
            </p>
            <h1 className="mt-2 font-editorial text-4xl font-semibold text-[#0B1F3A] dark:text-white">
              About HumanityBridge
            </h1>
          </div>
        </div>
        <p className="mt-4 text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
          HumanityBridge is a humanitarian storytelling, community assistance, and social-impact technology platform
          built to connect vulnerable communities with compassionate supporters while rigorously protecting dignity,
          consent, and financial integrity.
        </p>
      </div>

      <section className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D223D] p-7 sm:p-10">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#16865D] dark:text-[#1FA977]">
            Our Beginning · A Gift Rooted in Service
          </p>
          <h2 className="mt-3 font-editorial text-3xl sm:text-4xl font-semibold leading-tight text-[#0B1F3A] dark:text-white">
            A technology gift in recognition of community service.
          </h2>
          <p className="mt-5 text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            HumanityBridge began as a personal gift from <strong className="text-[#0B1F3A] dark:text-white">Kuei Poch Kuei</strong>,
            a fourth-year Computer Science student at Dilla University, to <strong className="text-[#0B1F3A] dark:text-white">Paul Ruot Bayoch Gtaluak</strong>.
            The gift was conceived in recognition of Paul's sustained dedication to serving the community and his commitment
            to listening to people, understanding the challenges they face, identifying those in need and documenting their circumstances.
          </p>
          <p className="mt-4 text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            On Monday, 16 November 2026, at 2:55 p.m., Kuei communicated the initiative to Paul and presented HumanityBridge
            as a gift intended to help organise, strengthen and facilitate this important work. The platform provides a
            structured way to register people in need, document their circumstances, organise cases and connect them with
            well-wishers, individuals and organisations willing to contribute.
          </p>
          <p className="mt-4 text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            At its heart, HumanityBridge is more than a technology project. It is a practical tool created to support a
            service-driven vision: listening to the community, documenting genuine needs and connecting people who need
            assistance with those willing to provide it.
          </p>
          <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl bg-[#F7F9FC] dark:bg-[#071324] p-5">
              <p className="text-xs uppercase tracking-wider text-[#748196] dark:text-slate-400">Initiated and gifted by</p>
              <p className="mt-2 text-lg font-semibold text-[#0B1F3A] dark:text-white">Kuei Poch Kuei</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Fourth-year Computer Science student, Dilla University</p>
            </div>
            <div className="rounded-xl bg-[#F7F9FC] dark:bg-[#071324] p-5">
              <p className="text-xs uppercase tracking-wider text-[#748196] dark:text-slate-400">Gift presented to</p>
              <p className="mt-2 text-lg font-semibold text-[#0B1F3A] dark:text-white">Paul Ruot Bayoch Gtaluak</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Community-service inspiration and intended beneficiary of the gift</p>
            </div>
          </div>
          <p className="mt-5 text-xs text-[#748196] dark:text-slate-400">
            Initiative communicated: Monday, 16 November 2026 · 2:55 p.m.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          ['Dignity & Consent', 'Stories and cases are published only when informed, documented consent is recorded and verified.'],
          ['Two-Layer Privacy', 'Confidential contact records and sensitive documents are strictly separated from public impact directories.'],
          ['Auditable Accountability', 'External bank transfers are recorded with supporting evidence and reviewed before organisational receipts are issued.'],
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
  const values = [
    'Human Dignity',
    'Compassion',
    'Integrity',
    'Transparency',
    'Accountability',
    'Community Empowerment',
    'Inclusion',
    'Trust',
    'Responsible Humanitarian Action',
  ];

  return (
    <main className="hb-institutional-page mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <header className="hb-mission-hero relative overflow-hidden rounded-[1.75rem] border px-6 py-9 sm:px-10 sm:py-12 lg:px-14">
        <p className="hb-eyebrow">Purpose, direction and principles</p>
        <h1 className="hb-page-title mt-3 max-w-3xl text-4xl sm:text-5xl">Mission &amp; Vision</h1>
        <p className="hb-page-description mt-4 max-w-2xl text-base leading-7 sm:text-lg">
          A clear commitment to human dignity, community-led action and responsible support.
        </p>
        <div className="hb-mission-hero-mark" aria-hidden="true">HB</div>
      </header>

      <section className="mt-7 grid gap-5 lg:grid-cols-2" aria-label="Mission and vision statements">
        <article className="hb-statement-panel">
          <span className="hb-statement-kicker">01 / Our mission</span>
          <h2 className="hb-statement-title">Connect people with meaningful support.</h2>
          <p className="hb-statement-copy">
            To connect vulnerable communities with opportunities, resources, and compassionate assistance while preserving
            human dignity, privacy, transparency, and accountability.
          </p>
        </article>
        <article className="hb-statement-panel hb-statement-panel-alt">
          <span className="hb-statement-kicker">02 / Our vision</span>
          <h2 className="hb-statement-title">A future where every community can be heard.</h2>
          <p className="hb-statement-copy">
            To help build inclusive communities where genuine needs are recognised, people are treated with respect,
            and responsible support reaches those who need it through trusted, transparent connections.
          </p>
        </article>
      </section>

      <section className="mt-12 sm:mt-16" aria-labelledby="hb-guiding-values">
        <div className="max-w-2xl">
          <p className="hb-eyebrow">The principles behind our work</p>
          <h2 id="hb-guiding-values" className="hb-section-title mt-2">Guiding values</h2>
          <p className="hb-page-description mt-3">
            These principles shape how we listen, document needs, protect personal information and remain accountable.
          </p>
        </div>
        <ul className="hb-values-list mt-7">
          {values.map((value, index) => (
            <li key={value} className="hb-value-item">
              <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <strong>{value}</strong>
            </li>
          ))}
        </ul>
      </section>
    </main>
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
          ['01. Community Discovery & Documentation', 'Authorised Community Coordinators work alongside local committees to document community needs while keeping personal contact information in private records.'],
          ['02. Administrative & Safeguarding Verification', 'Platform Administrators inspect evidence, verify guardian or beneficiary consent, redact identifying details when required, and issue a public QR-verifiable reference.'],
          ['03. Direct & Accountable Support', 'Supporters may arrange contributions outside the platform through independently confirmed organisational channels. Staff record completed external bank transfers and submit supporting evidence for administrative review. HumanityBridge does not process online payments.'],
          ['04. Field Delivery & Impact Reporting', 'Coordinators log field visits and assistance delivered, creating a transparent record of support and community outcomes.'],
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
          Join HumanityBridge as a contributor, community coordinator applicant, or organisational partner.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
    ['Does HumanityBridge process online payments?', 'No. HumanityBridge does not accept online payments or collect card details. Contributions are arranged externally through independently confirmed organisational channels; completed bank transfers may then be recorded and reviewed by authorised staff.'],
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
