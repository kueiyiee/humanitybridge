import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Search } from 'lucide-react';
import { apiRequest } from '../../services/api';
import { ResilientImage } from '../../components/ResilientImage';

interface CampaignItem {
  id: number;
  slug: string;
  title: string;
  summary: string;
  description: string;
  targetAmount: number;
  raisedAmount: number;
  currency: string;
  coverImageUrl: string | null;
  status: string;
  startDate: string;
  endDate: string;
}

export function CampaignsPage() {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['public-campaigns', status, search],
    queryFn: () =>
      apiRequest<CampaignItem[]>(
        `/campaigns?status=${encodeURIComponent(status)}&q=${encodeURIComponent(search)}`,
      ),
  });

  const campaigns = data?.data || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#16865D] dark:text-[#1FA977]">
          Coordinated Humanitarian Relief
        </p>
        <h1 className="mt-2 font-editorial text-4xl font-semibold text-[#0B1F3A] dark:text-white">
          Campaigns
        </h1>
        <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
          Every campaign links directly to verified humanitarian cases and updates progress strictly from confirmed
          payment gateway settlements.
        </p>
      </div>

      <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search campaigns..."
            aria-label="Search campaigns"
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-700 text-sm"
          />
        </div>
        <div className="flex gap-2">
          {['', 'ACTIVE', 'COMPLETED'].map((st) => (
            <button
              key={st || 'ALL'}
              type="button"
              onClick={() => setStatus(st)}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                status === st
                  ? 'bg-[#0B1F3A] dark:bg-[#00BCEB] text-white dark:text-[#071324]'
                  : 'bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              {st || 'All Campaigns'}
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
      ) : campaigns.length === 0 ? (
        <div className="mt-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D223D] p-12 text-center">
          <p className="text-sm text-[#748196] dark:text-slate-400">No campaigns found matching your selection.</p>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-8">
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
                  <p className="text-xs font-medium text-[#16865D] dark:text-[#1FA977]">{camp.status}</p>
                  <h2 className="mt-2 font-editorial text-xl font-semibold text-[#0B1F3A] dark:text-white">
                    {camp.title}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed flex-1">
                    {camp.summary}
                  </p>
                  <div className="mt-5">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-mono-tabular font-semibold">${camp.raisedAmount.toLocaleString()}</span>
                      <span className="font-mono-tabular text-[#748196] dark:text-slate-400">
                        of ${camp.targetAmount.toLocaleString()} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className="h-full bg-[#16865D] dark:bg-[#00BCEB]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <Link
                    to={`/campaigns/${camp.slug}`}
                    className="mt-5 block text-center py-2.5 rounded-lg bg-[#0B1F3A] dark:bg-[#00BCEB] text-white dark:text-[#071324] text-sm font-semibold hover:bg-[#123F69] transition-colors"
                  >
                    View Campaign
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface CampaignDetail extends CampaignItem {
  linkedCases: Array<{
    referenceCode: string;
    title: string;
    affectedCount: number;
    urgencyLevel: string;
    regionName: string;
  }>;
  recentConfirmedDonations: Array<{
    donationReference: string;
    amount: number;
    currency: string;
    donorName: string;
    confirmedAt: string;
  }>;
}

export function CampaignDetailsPage() {
  const { slug } = useParams();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['campaign-detail', slug],
    queryFn: () => apiRequest<CampaignDetail>(`/campaigns/${slug}`),
  });

  if (isLoading) return <div className="max-w-5xl mx-auto px-4 py-16 text-sm text-slate-500">Loading campaign...</div>;
  if (isError || !data?.data) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <h1 className="font-editorial text-2xl font-semibold">Campaign not found</h1>
        <Link to="/campaigns" className="mt-4 inline-block text-sm font-semibold text-[#123F69] dark:text-[#00BCEB]">
          Return to Campaigns
        </Link>
      </div>
    );
  }

  const c = data.data;
  const pct = Math.min(100, Math.round((c.raisedAmount / Math.max(1, c.targetAmount)) * 100));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      <Link
        to="/campaigns"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#748196] dark:text-slate-400 hover:text-[#0B1F3A] dark:hover:text-white mb-6"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        <span>Back to Campaigns</span>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
          <div className="aspect-[16/10] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <ResilientImage
              src={c.coverImageUrl}
              alt={c.title}
              className="w-full h-full object-cover"
              fallbackTitle={c.title}
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#16865D] dark:text-[#1FA977]">
              {c.status} Campaign
            </p>
            <h1 className="mt-2 font-editorial text-3xl sm:text-4xl font-semibold text-[#0B1F3A] dark:text-white">
              {c.title}
            </h1>
            <div className="mt-5 space-y-4 text-base text-slate-700 dark:text-slate-200 leading-relaxed">
              {c.description.split(/\n\n+/).map((p, idx) => (
                <p key={idx}>{p}</p>
              ))}
            </div>
          </div>

          {c.linkedCases.length > 0 && (
            <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
              <h2 className="font-editorial text-xl font-semibold mb-4">Linked Verified Cases</h2>
              <div className="space-y-3">
                {c.linkedCases.map((lc) => (
                  <Link
                    key={lc.referenceCode}
                    to={`/cases/${lc.referenceCode}`}
                    className="block p-4 rounded-xl bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 hover:border-[#00BCEB] transition-colors"
                  >
                    <p className="font-mono-tabular text-xs font-semibold text-[#123F69] dark:text-[#00BCEB]">
                      {lc.referenceCode} · {lc.regionName}
                    </p>
                    <p className="mt-1 font-medium text-[#0B1F3A] dark:text-white">{lc.title}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <p className="text-xs text-[#748196] dark:text-slate-400">Confirmed Funds Raised</p>
            <p className="mt-1 font-mono-tabular text-3xl font-semibold text-[#0B1F3A] dark:text-white">
              ${c.raisedAmount.toLocaleString()} {c.currency}
            </p>
            <p className="mt-1 text-xs font-mono-tabular text-[#748196] dark:text-slate-400">
              of ${c.targetAmount.toLocaleString()} goal ({pct}%)
            </p>
            <div className="mt-3 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div className="h-full bg-[#16865D] dark:bg-[#00BCEB]" style={{ width: `${pct}%` }} />
            </div>

            {c.status === 'ACTIVE' ? (
              <Link
                to={`/donate?campaign=${c.id}`}
                className="mt-6 block w-full text-center py-3 rounded-lg bg-[#0B1F3A] dark:bg-[#00BCEB] text-white dark:text-[#071324] text-sm font-semibold hover:bg-[#123F69] transition-colors"
              >
                Donate to Campaign
              </Link>
            ) : (
              <p className="mt-6 text-xs text-slate-600 dark:text-slate-400">
                This campaign is {c.status.toLowerCase()} and no longer accepting new pledges.
              </p>
            )}
          </div>

          <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-[#0B1F3A] dark:text-white mb-4">
              Recent Confirmed Contributions
            </h2>
            {c.recentConfirmedDonations.length === 0 ? (
              <p className="text-xs text-[#748196] dark:text-slate-400">No confirmed contributions recorded yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {c.recentConfirmedDonations.map((d) => (
                  <li key={d.donationReference} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-200">{d.donorName}</p>
                      <p className="font-mono-tabular text-[#748196] dark:text-slate-400">{d.donationReference}</p>
                    </div>
                    <span className="font-mono-tabular font-semibold text-[#16865D] dark:text-[#1FA977]">
                      ${d.amount.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
