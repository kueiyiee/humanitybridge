import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  Gift,
  HandHeart,
  HeartHandshake,
  MapPin,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { apiRequest } from '../../services/api';
import { useLocale } from '../../contexts/LocaleContext';
import { ResilientImage } from '../../components/ResilientImage';
import heroWater from '../../assets/images/hero_community_water_1794840710503.jpg';

interface PublicCase {
  id: number;
  referenceCode: string;
  title: string;
  publicSummary: string;
  assistanceNeeded: string;
  urgencyLevel: string;
  estimatedCostUsd: number;
  verifiedAt: string | null;
  categoryName: string;
  regionName: string;
  country: string;
}

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

const steps = [
  {
    number: '01',
    title: 'Identify',
    description: 'Explore needs identified with local communities.',
    icon: BookOpen,
  },
  {
    number: '02',
    title: 'Assess',
    description: 'Authorised reviewers assess each case and its safeguarding requirements.',
    icon: ShieldCheck,
  },
  {
    number: '03',
    title: 'Connect',
    description: 'Direct support through the organisation’s approved channels.',
    icon: HandHeart,
  },
  {
    number: '04',
    title: 'Report',
    description: 'Coordinators document assistance and provide accountable updates.',
    icon: UsersRound,
  },
];

const principles = [
  {
    title: 'Consent-led stories',
    description: 'People choose how their experiences and images are shared.',
  },
  {
    title: 'Human review',
    description: 'Authorised reviewers assess cases before public listing.',
  },
  {
    title: 'Financial records',
    description: 'Published contribution totals rely on confirmed records.',
  },
  {
    title: 'Community safeguarding',
    description: 'Private details are protected, with added care for children.',
  },
];

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: { label: string; to: string };
}) {
  return (
    <div className="mb-9 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#52745d]">{eyebrow}</p>
        <h2 className="mt-3 font-editorial text-3xl font-semibold leading-tight tracking-tight text-[#183b2b] sm:text-4xl">
          {title}
        </h2>
        {description && <p className="mt-3 max-w-xl text-base leading-7 text-[#59675d]">{description}</p>}
      </div>
      {action && (
        <Link
          to={action.to}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-semibold text-[#24583b] transition-colors hover:text-[#173d29] focus-visible:outline"
        >
          {action.label}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#e5e5dc] bg-white/80 px-6 py-10 text-center text-sm leading-6 text-[#657168] sm:px-10">
      {children}
    </div>
  );
}

function SectionError({ children }: { children: React.ReactNode }) {
  return (
    <EmptyState>
      <span role="status">{children}</span>
    </EmptyState>
  );
}

export function HomePage() {
  const { t } = useLocale();
  const { data: overviewResult, isLoading: overviewLoading, isError: overviewError } = useQuery({
    queryKey: ['public-overview'],
    queryFn: () => apiRequest<OverviewResponse>('/public/overview'),
  });
  const { data: caseResult, isLoading: casesLoading, isError: casesError } = useQuery({
    queryKey: ['homepage-public-cases'],
    queryFn: () => apiRequest<PublicCase[]>('/cases'),
  });

  const overview = overviewResult?.data;
  const stats = overview?.statistics;
  const stories = overview?.featuredStories || [];
  const campaigns = overview?.featuredCampaigns || [];
  const cases = caseResult?.data || [];
  const visibleMetrics = [
    { label: 'Verified cases', value: stats?.verifiedCases ?? 0 },
    { label: 'Active campaigns', value: stats?.activeCampaigns ?? 0 },
    { label: 'Completed cases and programmes', value: stats?.completedProjects ?? 0 },
  ].filter((metric) => metric.value > 0);

  return (
    <div className="hb-home bg-[#f8f7f1] text-[#26382d]">
      <section className="overflow-hidden bg-[#f1f0e7]">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-2 lg:gap-16 lg:px-10 lg:py-20">
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#d6dfd3] bg-white/70 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.15em] text-[#416348]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#b38b45]" aria-hidden="true" />
              HumanityBridge · Local stories, accountable support
            </p>
            <h1 className="mt-7 font-editorial text-[2.65rem] font-semibold leading-[1.08] tracking-tight text-[#183b2b] sm:text-6xl">
              {t('heroHeadline')}
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-[#56645a] sm:text-lg sm:leading-8">
              {t('heroSub')}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/stories"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#20583a] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#17472e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#20583a]"
              >
                {t('ctaStories')}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                to="/cases"
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-[#b8c5b8] bg-white/60 px-5 text-sm font-semibold text-[#294633] transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#20583a]"
              >
                {t('ctaDifference')}
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#d9ded3] pt-5 text-xs font-medium text-[#57695b]">
              <span className="inline-flex items-center gap-1.5">
                <BadgeCheck className="h-4 w-4 text-[#52745d]" aria-hidden="true" />
                Human review
              </span>
              <span>Consent-led storytelling</span>
              <span>Accountable assistance</span>
            </div>
          </div>

          <div className="relative min-h-[330px] overflow-hidden rounded-[1.4rem] bg-[#d7dfd1] shadow-[0_24px_70px_-38px_rgba(27,54,36,0.55)] sm:min-h-[470px]">
            <img
              src={heroWater}
              alt="Community members gathered around a solar-powered clean water point"
              className="absolute inset-0 h-full w-full object-cover"
              fetchPriority="high"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#142c20]/75 via-[#142c20]/25 to-transparent px-6 pb-6 pt-20 sm:px-8 sm:pb-8">
              <p className="max-w-sm text-lg font-medium leading-snug text-white sm:text-xl">
                Stronger futures begin with communities leading the way.
              </p>
            </div>
            <div className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 text-xs font-semibold text-[#31513a] shadow-sm sm:right-6 sm:top-6">
              <HeartHandshake className="h-4 w-4 text-[#b18a48]" aria-hidden="true" />
              With communities, not for them
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Published programme figures" className="border-y border-[#e4e4d9] bg-white">
        <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8 lg:px-10">
          {overviewLoading ? (
            <div className="grid gap-4 sm:grid-cols-3" aria-label="Loading published figures">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-16 animate-pulse rounded-lg bg-[#f2f2eb]" />
              ))}
            </div>
          ) : overviewError ? (
            <p role="status" className="py-2 text-center text-sm text-[#68756b]">
              Current programme figures are temporarily unavailable.
            </p>
          ) : visibleMetrics.length ? (
            <div className="grid gap-6 sm:grid-cols-3 sm:divide-x sm:divide-[#e8e8df]">
              {visibleMetrics.map((metric) => (
                <div key={metric.label} className="text-center sm:px-5">
                  <p className="font-editorial text-3xl font-semibold tabular-nums text-[#244b33]">
                    {metric.value.toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-[#718076]">{metric.label}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-2 text-center text-sm leading-6 text-[#68756b]">
              Verified programme figures will appear here as work is reviewed and published.
            </p>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
        <SectionHeading
          eyebrow="Community voices"
          title="Stories of resilience, shared with dignity"
          description="Community experiences shared with informed consent and respect."
          action={{ label: 'All stories', to: '/stories' }}
        />
        {overviewLoading ? (
          <div className="grid gap-5 md:grid-cols-3" aria-label="Loading stories">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-80 animate-pulse rounded-2xl bg-[#e9e9df]" />
            ))}
          </div>
        ) : overviewError ? (
          <SectionError>Stories are temporarily unavailable. Please try again later.</SectionError>
        ) : stories.length === 0 ? (
          <EmptyState>New community stories will appear here after publication and consent review.</EmptyState>
        ) : (
          <div className="grid gap-5 md:grid-cols-3">
            {stories.map((story) => (
              <article key={story.id} className="group flex flex-col overflow-hidden rounded-2xl border border-[#e5e5dc] bg-white">
                <div className="aspect-[8/5] overflow-hidden bg-[#e8e8de]">
                  <ResilientImage
                    src={story.coverImageUrl}
                    alt={story.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.025]"
                    fallbackTitle={story.title}
                  />
                </div>
                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#68776b]">
                    <span className="font-semibold text-[#52745d]">{story.categoryName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                      {story.regionName}
                    </span>
                    {story.publishedAt && (
                      <>
                        <span aria-hidden="true">·</span>
                        <time dateTime={story.publishedAt} className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                          {new Date(story.publishedAt).toLocaleDateString()}
                        </time>
                      </>
                    )}
                  </div>
                  <h3 className="mt-3 font-editorial text-xl font-semibold leading-snug text-[#223b2b]">{story.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-6 text-[#657168]">{story.excerpt}</p>
                  <Link
                    to={`/stories/${story.slug}`}
                    className="mt-5 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#28583c] hover:text-[#173d29] focus-visible:outline"
                  >
                    Read story <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="border-y border-[#e6e5db] bg-[#f1f0e7]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
          <SectionHeading
            eyebrow="Public case directory"
            title="Where support can make a difference"
            description="Explore needs reviewed by authorised staff. Personal contact details and precise locations remain private."
            action={{ label: 'People in need', to: '/cases' }}
          />
          {casesLoading ? (
            <div className="grid gap-5 md:grid-cols-2" aria-label="Loading public cases">
              {[1, 2].map((item) => (
                <div key={item} className="h-52 animate-pulse rounded-2xl bg-white/70" />
              ))}
            </div>
          ) : casesError ? (
            <SectionError>Public case information is temporarily unavailable. Please try again later.</SectionError>
          ) : cases.length === 0 ? (
            <EmptyState>There are no public cases to display at this time. New listings will appear after review and approval.</EmptyState>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {cases.slice(0, 4).map((item) => (
                <article key={item.id} className="flex flex-col rounded-2xl border border-[#e4e5da] bg-white p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3b6847]">
                      <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                      Reviewed public case
                    </span>
                    <span className="rounded-full bg-[#f3f2eb] px-3 py-1 text-xs font-medium text-[#667266]">
                      {item.categoryName}
                    </span>
                  </div>
                  <h3 className="mt-4 font-editorial text-xl font-semibold leading-snug text-[#223b2b]">{item.title}</h3>
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-[#68776b]">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    {item.regionName}, {item.country}
                  </p>
                  <p className="mt-3 flex-1 text-sm leading-6 text-[#657168]">{item.publicSummary}</p>
                  <Link
                    to={`/cases/${item.referenceCode}`}
                    className="mt-5 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#28583c] hover:text-[#173d29] focus-visible:outline"
                  >
                    View case <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
        <SectionHeading
          eyebrow="Current programmes"
          title="Community programmes, built for lasting impact"
          description="Explore active initiatives and review confirmed progress before contributing."
          action={{ label: 'All campaigns', to: '/campaigns' }}
        />
        {overviewLoading ? (
          <div className="grid gap-5 md:grid-cols-3" aria-label="Loading campaigns">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-80 animate-pulse rounded-2xl bg-[#e9e9df]" />
            ))}
          </div>
        ) : overviewError ? (
          <SectionError>Programme information is temporarily unavailable. Please try again later.</SectionError>
        ) : campaigns.length === 0 ? (
          <EmptyState>There are no active campaigns at present. Published programmes will appear here when available.</EmptyState>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((campaign) => {
              const target = Number(campaign.targetAmount) || 0;
              const confirmed = Number(campaign.raisedAmount) || 0;
              const progress = target > 0 ? Math.min(100, Math.round((confirmed / target) * 100)) : 0;
              const currency = (campaign.currency || 'USD').toUpperCase();
              const formatMoney = (value: number) =>
                new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);

              return (
                <article key={campaign.id} className="flex flex-col overflow-hidden rounded-2xl border border-[#e5e5dc] bg-white">
                  <div className="aspect-[8/5] overflow-hidden bg-[#e8e8de]">
                    <ResilientImage
                      src={campaign.coverImageUrl}
                      alt={campaign.title}
                      className="h-full w-full object-cover"
                      fallbackTitle={campaign.title}
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-5 sm:p-6">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#55745d]">Active programme</p>
                    <h3 className="mt-2 font-editorial text-xl font-semibold leading-snug text-[#223b2b]">{campaign.title}</h3>
                    <p className="mt-2 flex-1 text-sm leading-6 text-[#657168]">{campaign.summary}</p>
                    <div className="mt-5">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
                        <span className="font-semibold text-[#294b34]">
                          {formatMoney(confirmed)} confirmed
                        </span>
                        {target > 0 && <span className="text-[#718076]">of {formatMoney(target)}</span>}
                      </div>
                      {target > 0 && (
                        <div
                          className="mt-2 h-2 overflow-hidden rounded-full bg-[#e9ebe3]"
                          role="progressbar"
                          aria-label={`${campaign.title} confirmed contributions`}
                          aria-valuemin={0}
                          aria-valuemax={target}
                          aria-valuenow={Math.min(confirmed, target)}
                        >
                          <div className="h-full rounded-full bg-[#658567]" style={{ width: `${progress}%` }} />
                        </div>
                      )}
                    </div>
                    <Link
                      to={`/campaigns/${campaign.slug}`}
                      className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#b9c9b9] px-4 text-sm font-semibold text-[#28583c] transition-colors hover:bg-[#f4f6f1] focus-visible:outline"
                    >
                      View programme <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="border-y border-[#e4e5da] bg-white">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
          <SectionHeading
            eyebrow="A considered process"
            title="From identified need to accountable action"
            description="A transparent process that keeps communities, safeguarding and follow-up at its centre."
          />
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(({ number, title, description, icon: Icon }) => (
              <li key={number} className="rounded-2xl border border-[#e5e6dc] bg-[#fbfbf8] p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <span className="font-mono-tabular text-sm font-semibold text-[#a1814b]">{number}</span>
                  <Icon className="h-5 w-5 text-[#54745b]" aria-hidden="true" />
                </div>
                <h3 className="mt-5 font-editorial text-lg font-semibold text-[#294633]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#667269]">{description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="hb-trust-section mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10" aria-labelledby="trust-care-heading">
        <div className="hb-trust-panel">
          <div className="hb-trust-intro">
            <p className="hb-trust-eyebrow">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Trust and care
            </p>
            <h2 id="trust-care-heading" className="hb-trust-heading">
              Every action must be accountable.
            </h2>
            <p className="hb-trust-summary">
              Clear safeguards, careful review and reliable records guide how HumanityBridge works with communities.
            </p>
            <nav aria-label="Trust and safeguarding resources" className="hb-trust-links">
              <Link to="/impact" className="hb-trust-link">
                Explore our accountability framework <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link to="/policies/safeguarding" className="hb-trust-link">
                Read our safeguarding policy <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </nav>
          </div>
          <ul className="hb-trust-principles">
            {principles.map((principle, index) => (
              <li key={principle.title} className="hb-trust-principle">
                <span className="hb-trust-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <div className="min-w-0">
                  <h3>{principle.title}</h3>
                  <p>{principle.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      </section>

      <section
        aria-labelledby="our-beginning-heading"
        className="border-y border-[#e4e5da] bg-[#f1f0e7] dark:border-[#354738] dark:bg-[#141e17]"
      >
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
          <div className="grid gap-10">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#52745d]">
                Our beginning · A gift rooted in service
              </p>
              <h2
                id="our-beginning-heading"
                className="mt-4 max-w-2xl font-editorial text-3xl font-semibold leading-tight tracking-tight text-[#183b2b] sm:text-4xl lg:text-5xl"
              >
                A Technology Gift Inspired by Community Service.
              </h2>
              <div className="mt-7 max-w-2xl space-y-4 text-[15px] leading-7 text-[#59675d]">
                <p>
                  HumanityBridge was conceived and developed by Kuei Poch Kuei, a fourth-year Computer Science student at Dilla University, and presented to Paul Ruot Bayoch Gtaluak as a technology gift inspired by community service.
                </p>
                <p>
                  The gift recognises Paul’s commitment to listening to community members, identifying humanitarian needs, and documenting circumstances so that people can be connected with appropriate support.
                </p>
                <p>
                  The initiative was formally communicated and presented on Monday, 16 November 2026, at 2:55 p.m.
                </p>
                <p>
                  The platform provides a structured environment for documenting community needs, managing reviewed humanitarian cases, and connecting people with individuals and organisations willing to help.
                </p>
                <p>
                  Its purpose is straightforward: help communities make their needs visible while ensuring that assistance is handled with dignity, care, and accountability.
                </p>
              </div>

              <div className="mt-8 border-l border-[#bca36e] pl-5 sm:pl-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8b7041]">
                  Initiative milestone
                </p>
                <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <time dateTime="2026-11-16T14:55" className="font-editorial text-xl font-semibold text-[#294633] sm:text-2xl">
                    Monday, 16 November 2026
                  </time>
                  <span className="text-sm font-semibold tabular-nums text-[#8b7041]">2:55 PM</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-[#657168]">
                  Initiative communicated and HumanityBridge presented as a technology gift.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <article className="rounded-2xl border border-[#e2e2d7] bg-white p-6 shadow-[0_12px_36px_-28px_rgba(15,23,42,0.28)] sm:p-7">
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#edf1e8] text-[#416348]">
                    <Gift className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8b7041]">
                      Initiator and technology creator
                    </p>
                    <h3 className="mt-2 font-editorial text-2xl font-semibold leading-tight text-[#203c2a]">
                      Kuei Poch Kuei
                    </h3>
                    <p className="mt-2 text-sm font-medium leading-6 text-[#45594a]">
                      Fourth-year Computer Science Student, Dilla University
                    </p>
                  </div>
                </div>
                <p className="mt-5 text-sm leading-6 text-[#657168]">
                  The individual who conceived, developed, and presented HumanityBridge as a technology gift in recognition of community service.
                </p>
                <div className="mt-5 grid gap-3 border-t border-[#ecece4] pt-5 sm:grid-cols-2">
                  <a
                    href="https://www.kueiyiee.tech"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group rounded-xl border border-[#e5e5dc] p-4 transition-colors hover:border-[#9eaf9d] hover:bg-[#f8f9f5] focus-visible:outline"
                  >
                    <span className="block text-xs font-bold uppercase tracking-wide text-[#294633]">
                      KUEIYIEE TECHNOLOGIES
                    </span>
                    <span className="mt-1 flex items-center justify-between gap-2 text-xs text-[#68776b]">
                      Official Technology Company
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-[#52745d]" aria-hidden="true" />
                    </span>
                  </a>
                  <a
                    href="https://kuei-portfolio.vercel.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group rounded-xl border border-[#e5e5dc] p-4 transition-colors hover:border-[#9eaf9d] hover:bg-[#f8f9f5] focus-visible:outline"
                  >
                    <span className="block text-xs font-bold uppercase tracking-wide text-[#294633]">
                      Personal Portfolio
                    </span>
                    <span className="mt-1 flex items-center justify-between gap-2 text-xs text-[#68776b]">
                      Professional Portfolio
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-[#52745d]" aria-hidden="true" />
                    </span>
                  </a>
                </div>
              </article>

              <article className="rounded-2xl border border-[#e2e2d7] bg-white p-6 shadow-[0_12px_36px_-28px_rgba(15,23,42,0.28)] sm:p-7">
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f2eee3] text-[#8b7041]">
                    <HeartHandshake className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8b7041]">
                      Community-service inspiration
                    </p>
                    <h3 className="mt-2 font-editorial text-2xl font-semibold leading-tight text-[#203c2a]">
                      Paul Ruot Bayoch Gtaluak
                    </h3>
                    <p className="mt-2 text-sm font-medium leading-6 text-[#45594a]">
                      Community-Service Inspiration and Recipient of the Gift
                    </p>
                  </div>
                </div>
                <p className="mt-5 text-sm leading-6 text-[#657168]">
                  Recognised for his commitment to listening to community members, identifying humanitarian needs, and documenting circumstances to help connect people with support.
                </p>
              </article>
            </div>
          </div>

          <aside
            aria-labelledby="technology-creator-contact-heading"
            className="mt-10 rounded-[1.5rem] bg-[#1e4932] p-6 text-white sm:p-9 lg:mt-14 lg:flex lg:items-center lg:justify-between lg:gap-10 lg:p-10"
          >
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#d7c08c]">
                Professional contact
              </p>
              <h3
                id="technology-creator-contact-heading"
                className="mt-3 font-editorial text-2xl font-semibold leading-tight sm:text-3xl"
              >
                Connect with the Technology Creator
              </h3>
              <p className="mt-3 text-sm leading-6 text-[#e2e8df] sm:text-base">
                Interested in the development of HumanityBridge, technology partnerships, software engineering, digital transformation, or related initiatives?
              </p>
              <p className="mt-2 text-sm leading-6 text-[#e2e8df]">
                Visit KUEIYIEE TECHNOLOGIES or explore Kuei Poch Kuei’s professional portfolio to learn more and find the appropriate contact channels.
              </p>
              <p className="mt-3 text-xs leading-5 text-[#d4dfd4]">
                These professional links are for technology-related enquiries; HumanityBridge donations and humanitarian enquiries remain separate.
              </p>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:mt-0 lg:shrink-0 lg:flex-col xl:flex-row">
              <a
                href="https://www.kueiyiee.tech"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#f1e7ce] px-5 text-sm font-semibold text-[#294633] transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Visit KUEIYIEE TECHNOLOGIES
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                href="https://kuei-portfolio.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/40 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Explore Professional Portfolio
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </aside>
        </div>
      </section>

      <section className="bg-[#1e4932] text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-7 px-5 py-14 sm:px-8 sm:py-16 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#d7c08c]">Take part</p>
            <h2 className="mt-3 font-editorial text-3xl font-semibold leading-tight sm:text-4xl">
              Help turn community needs into meaningful action.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#e2e8df] sm:text-base">
              Your time, expertise, and partnerships can help communities access responsible support.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              to="/cases"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#f1e7ce] px-5 text-sm font-semibold text-[#294633] transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Find a case to support <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              to="/get-involved"
              className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/40 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Get involved
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
