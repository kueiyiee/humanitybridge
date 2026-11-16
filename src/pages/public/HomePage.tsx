import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { apiRequest } from '../../services/api';
import { useLocale } from '../../contexts/LocaleContext';
import { ResilientImage } from '../../components/ResilientImage';

interface OverviewResponse {
  statistics: {
    peopleSupported: number;
    verifiedCases: number;
    activeCampaigns: number;
    completedProjects: number;
  };
  featuredStories: Array<{
    id: number;
    slug: string;
    title: string;
    regionName: string;
    excerpt: string;
    coverImageUrl: string | null;
    publishedAt: string | null;
    categoryName: string;
  }>;
  featuredCampaigns: Array<{
    id: number;
    slug: string;
    title: string;
    summary: string;
    targetAmount: number;
    raisedAmount: number;
    currency: string;
    coverImageUrl: string | null;
    status: string;
  }>;
}

export function HomePage() {
  const { t } = useLocale();
  const { data, isLoading } = useQuery({
    queryKey: ['public-overview'],
    queryFn: () => apiRequest<OverviewResponse>('/public/overview'),
  });

  const stats = data?.data?.statistics;
  const stories = data?.data?.featuredStories || [];
  const campaigns = data?.data?.featuredCampaigns || [];

  const hasAnyStats =
    stats &&
    (stats.peopleSupported > 0 ||
      stats.verifiedCases > 0 ||
      stats.activeCampaigns > 0 ||
      stats.completedProjects > 0);

  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-[#0B1F3A] text-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-xs font-semibold tracking-widest uppercase text-[#00BCEB] mb-4">
                HumanityBridge · Humanitarian Storytelling & Verified Assistance
              </p>
              <h1 className="font-editorial text-4xl sm:text-5xl lg:text-[3.25rem] font-semibold leading-[1.12] tracking-tight text-white max-w-xl">
                {t('heroHeadline')}
              </h1>
              <p className="mt-5 text-base sm:text-lg text-slate-200 leading-relaxed max-w-xl">
                {t('heroSub')}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  to="/stories"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#00BCEB] text-[#071324] text-sm font-semibold hover:bg-[#33ccf2] transition-colors whitespace-nowrap"
                >
                  <span>{t('ctaStories')}</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
                <Link
                  to="/donate"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-slate-500 text-white text-sm font-semibold hover:bg-white/10 transition-colors whitespace-nowrap"
                >
                  <span>{t('ctaDifference')}</span>
                </Link>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative h-72 sm:h-96 lg:h-full min-h-[340px] rounded-xl overflow-hidden border border-white/10">
                <ResilientImage
                  src="/src/assets/images/hero_community_water_1794840710503.jpg"
                  alt="Community engineers and local residents standing beside a solar-powered clean water hub"
                  className="w-full h-full object-cover"
                  fallbackTitle="Community Clean Water Initiative"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#071324]/80 via-transparent to-transparent pointer-events-none" />
                <p className="absolute bottom-4 left-4 right-4 text-xs text-slate-200">
                  Community-managed solar clean water infrastructure · Verified Field Program
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Database-Driven Impact Statistics */}
      <section className="bg-white dark:bg-[#0D223D] border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {isLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
              ))}
            </div>
          ) : !hasAnyStats ? (
            <div className="py-4 text-center text-sm text-[#748196] dark:text-slate-400">
              Verified impact metrics will appear here automatically once humanitarian cases and campaigns are approved.
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              <div>
                <p className="font-mono-tabular text-3xl sm:text-4xl font-semibold text-[#0B1F3A] dark:text-white">
                  {stats.peopleSupported.toLocaleString()}
                </p>
                <p className="mt-1 text-sm text-[#748196] dark:text-slate-400">People Supported</p>
              </div>
              <div>
                <p className="font-mono-tabular text-3xl sm:text-4xl font-semibold text-[#0B1F3A] dark:text-white">
                  {stats.verifiedCases.toLocaleString()}
                </p>
                <p className="mt-1 text-sm text-[#748196] dark:text-slate-400">Verified Humanitarian Cases</p>
              </div>
              <div>
                <p className="font-mono-tabular text-3xl sm:text-4xl font-semibold text-[#0B1F3A] dark:text-white">
                  {stats.activeCampaigns.toLocaleString()}
                </p>
                <p className="mt-1 text-sm text-[#748196] dark:text-slate-400">Active Campaigns</p>
              </div>
              <div>
                <p className="font-mono-tabular text-3xl sm:text-4xl font-semibold text-[#16865D] dark:text-[#1FA977]">
                  {stats.completedProjects.toLocaleString()}
                </p>
                <p className="mt-1 text-sm text-[#748196] dark:text-slate-400">Completed Projects</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Featured Humanitarian Stories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#123F69] dark:text-[#00BCEB]">
              Verified Community Voices
            </p>
            <h2 className="mt-2 font-editorial text-3xl font-semibold text-[#0B1F3A] dark:text-white">
              Featured Humanitarian Stories
            </h2>
          </div>
          <Link
            to="/stories"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#123F69] dark:text-[#00BCEB] hover:underline whitespace-nowrap"
          >
            <span>Browse all stories</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>

        {stories.length === 0 ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D223D] p-10 text-center">
            <p className="text-sm text-[#748196] dark:text-slate-400">
              No published stories are currently available. Approved community stories appear here after editorial and consent verification.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {stories.map((story) => (
              <article
                key={story.id}
                className="group bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col"
              >
                <div className="aspect-[4/3] overflow-hidden bg-slate-100 dark:bg-slate-900">
                  <ResilientImage
                    src={story.coverImageUrl}
                    alt={story.title}
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    fallbackTitle={story.title}
                  />
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <div className="text-xs text-[#748196] dark:text-slate-400 flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-[#123F69] dark:text-[#00BCEB]">{story.categoryName}</span>
                    <span aria-hidden="true">·</span>
                    <span>{story.regionName}</span>
                    {story.publishedAt && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{new Date(story.publishedAt).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>
                  <h3 className="mt-2 font-editorial text-xl font-semibold text-[#0B1F3A] dark:text-white leading-snug">
                    {story.title}
                  </h3>
                  <p className="mt-2.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed flex-1">
                    {story.excerpt}
                  </p>
                  <Link
                    to={`/stories/${story.slug}`}
                    className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0B1F3A] dark:text-[#00BCEB] hover:underline"
                  >
                    <span>Read More</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Featured Active Campaigns */}
      <section className="bg-white dark:bg-[#0D223D]/50 border-y border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#16865D] dark:text-[#1FA977]">
                Accountable Direct Support
              </p>
              <h2 className="mt-2 font-editorial text-3xl font-semibold text-[#0B1F3A] dark:text-white">
                Featured Humanitarian Campaigns
              </h2>
            </div>
            <Link
              to="/campaigns"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#123F69] dark:text-[#00BCEB] hover:underline whitespace-nowrap"
            >
              <span>View all campaigns</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>

          {campaigns.length === 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D223D] p-10 text-center">
              <p className="text-sm text-[#748196] dark:text-slate-400">
                No active fundraising campaigns are published right now.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {campaigns.map((camp) => {
                const pct = Math.min(100, Math.round((camp.raisedAmount / Math.max(1, camp.targetAmount)) * 100));
                return (
                  <article
                    key={camp.id}
                    className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col"
                  >
                    <div className="aspect-[4/3] overflow-hidden bg-slate-100 dark:bg-slate-900">
                      <ResilientImage
                        src={camp.coverImageUrl}
                        alt={camp.title}
                        className="w-full h-full object-cover"
                        fallbackTitle={camp.title}
                      />
                    </div>
                    <div className="p-6 flex-1 flex flex-col">
                      <p className="text-xs font-medium text-[#16865D] dark:text-[#1FA977]">
                        {camp.status} · Verified Campaign
                      </p>
                      <h3 className="mt-2 font-editorial text-xl font-semibold text-[#0B1F3A] dark:text-white">
                        {camp.title}
                      </h3>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed flex-1">
                        {camp.summary}
                      </p>

                      <div className="mt-5">
                        <div className="flex items-baseline justify-between text-xs mb-1.5">
                          <span className="font-mono-tabular font-semibold text-[#0B1F3A] dark:text-white">
                            ${camp.raisedAmount.toLocaleString()} confirmed
                          </span>
                          <span className="font-mono-tabular text-[#748196] dark:text-slate-400">
                            Target ${camp.targetAmount.toLocaleString()} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-[#16865D] dark:bg-[#00BCEB] rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-5 flex items-center gap-3">
                        <Link
                          to={`/campaigns/${camp.slug}`}
                          className="flex-1 text-center py-2.5 px-4 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold text-[#0B1F3A] dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          View Campaign
                        </Link>
                        <Link
                          to={`/donate?campaign=${camp.id}`}
                          className="py-2.5 px-4 rounded-lg bg-[#0B1F3A] dark:bg-[#00BCEB] text-white dark:text-[#071324] text-sm font-semibold hover:bg-[#123F69] transition-colors whitespace-nowrap"
                        >
                          Support
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* How HumanityBridge Works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-2xl mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#123F69] dark:text-[#00BCEB]">
            Operational Methodology
          </p>
          <h2 className="mt-2 font-editorial text-3xl font-semibold text-[#0B1F3A] dark:text-white">
            How HumanityBridge Works
          </h2>
          <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
            Every case passes through human verification, safeguarding review, and reconciled disbursement tracking.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            ['01. Discover', 'Learn about community needs documented by authorized Community Coordinators on the ground.'],
            ['02. Verify', 'Platform Administrators inspect evidence, confirm safeguarding consent, and assign public references.'],
            ['03. Support', 'Contributors fund verified campaigns or cases through transparent, idempotently reconciled gateways.'],
            ['04. Transform', 'Field coordinators record delivered assistance and publish progress updates with dignity preserved.'],
          ].map(([heading, desc]) => (
            <div
              key={heading}
              className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6"
            >
              <h3 className="font-editorial text-lg font-semibold text-[#0B1F3A] dark:text-white">{heading}</h3>
              <p className="mt-2.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Impact & Transparency */}
      <section className="bg-white dark:bg-[#0D223D] border-y border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#16865D] dark:text-[#1FA977] mb-3">
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              <span>Privacy & Financial Accountability</span>
            </div>
            <h2 className="font-editorial text-3xl font-semibold text-[#0B1F3A] dark:text-white">
              Transparency Without Compromising Human Dignity
            </h2>
            <p className="mt-4 text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
              HumanityBridge maintains a strict architectural boundary between private beneficiary dossiers and public
              impact records. Telephone numbers, home addresses, and confidential evidence files are isolated in
              access-controlled vaults—never published online—while every confirmed contribution is tracked in an
              auditable financial ledger.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <Link
                to="/impact"
                className="px-5 py-2.5 rounded-lg bg-[#123F69] text-white text-sm font-semibold hover:bg-[#0B1F3A] transition-colors"
              >
                Explore Impact Centre
              </Link>
              <Link
                to="/policies/safeguarding"
                className="px-5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold text-[#0B1F3A] dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Read Safeguarding Charter
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              ['Consent-First Stories', 'Separate, timestamped consent for narrative, photos, and identity.'],
              ['Mandatory Human Review', 'No automated AI approval of cases or eligibility.'],
              ['Idempotent Ledger', 'Payments count only after verified provider callbacks.'],
              ['Child Safeguarding', 'Guardian consent and strict redaction of identifying details.'],
            ].map(([title, copy]) => (
              <div
                key={title}
                className="p-5 rounded-xl bg-[#F7F9FC] dark:bg-[#071324] border border-slate-200 dark:border-slate-800"
              >
                <h3 className="text-sm font-semibold text-[#0B1F3A] dark:text-white">{title}</h3>
                <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="bg-[#0B1F3A] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="font-editorial text-3xl sm:text-4xl font-semibold text-white">
            Together, We Can Make a Difference.
          </h2>
          <p className="mt-4 text-base text-slate-300 max-w-2xl mx-auto">
            Support verified humanitarian cases, volunteer regional skills, or partner with HumanityBridge to bring
            transparent assistance to communities in need.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/get-involved"
              className="px-6 py-3 rounded-lg bg-[#00BCEB] text-[#071324] text-sm font-semibold hover:bg-[#33ccf2] transition-colors"
            >
              Become Part of the Change
            </Link>
            <Link
              to="/cases"
              className="px-6 py-3 rounded-lg border border-slate-500 text-white text-sm font-semibold hover:bg-white/10 transition-colors"
            >
              View Verified Cases
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
