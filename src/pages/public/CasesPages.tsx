import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, QrCode, Search, ShieldCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { apiRequest } from '../../services/api';

interface PublicCase {
  id: number;
  referenceCode: string;
  title: string;
  publicSummary: string;
  assistanceNeeded: string;
  affectedCount: number;
  urgencyLevel: string;
  estimatedCostUsd: number;
  status: string;
  verifiedAt: string | null;
  categoryName: string;
  categorySlug: string;
  regionName: string;
  country: string;
}

export function PeopleInNeedPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [urgency, setUrgency] = useState('');

  const { data: taxData } = useQuery({
    queryKey: ['taxonomy'],
    queryFn: () =>
      apiRequest<{ caseCategories: Array<{ id: number; slug: string; name: string }> }>('/meta/taxonomy'),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['public-cases', category, urgency, search],
    queryFn: () =>
      apiRequest<PublicCase[]>(
        `/cases?category=${encodeURIComponent(category)}&urgency=${encodeURIComponent(urgency)}&q=${encodeURIComponent(search)}`,
      ),
  });

  const cases = data?.data || [];
  const categories = taxData?.data?.caseCategories || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#123F69] dark:text-[#00BCEB]">
          Verified Needs Directory
        </p>
        <h1 className="mt-2 font-editorial text-4xl font-semibold text-[#0B1F3A] dark:text-white">
          People in Need
        </h1>
        <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
          Each case below has passed administrative verification and safeguarding review. Private beneficiary contact
          details and precise household locations are strictly withheld for safety.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-6 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by reference (e.g. HB-CASE-2026-101) or keyword..."
            aria-label="Search verified cases"
            className="hb-themed-input w-full rounded-xl border py-3 pl-10 pr-4 text-sm"
          />
        </div>
        <div className="md:col-span-3">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Filter by category"
            className="hb-themed-select w-full rounded-xl border px-3 py-3 text-sm"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-3">
          <select
            value={urgency}
            onChange={(e) => setUrgency(e.target.value)}
            aria-label="Filter by urgency"
            className="w-full py-2.5 px-3 rounded-lg bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-700 text-sm"
          >
            <option value="">All Urgency Levels</option>
            <option value="CRITICAL">Critical Priority</option>
            <option value="HIGH">High Priority</option>
            <option value="MEDIUM">Medium Priority</option>
            <option value="LOW">Standard Priority</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-56 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : cases.length === 0 ? (
        <div className="hb-empty-state mt-10 rounded-2xl border p-10 text-center sm:p-14">
          <p className="text-sm text-[#748196] dark:text-slate-400">
            No verified public cases match your search criteria.
          </p>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          {cases.map((item) => (
            <article
              key={item.id}
              className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#748196] dark:text-slate-400">
                  <span className="font-mono-tabular font-semibold text-[#123F69] dark:text-[#00BCEB]">
                    {item.referenceCode}
                  </span>
                  <span>
                    {item.categoryName} · {item.regionName}, {item.country}
                  </span>
                </div>
                <h2 className="mt-3 font-editorial text-xl font-semibold text-[#0B1F3A] dark:text-white">
                  {item.title}
                </h2>
                <p className="mt-2.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {item.publicSummary}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="text-xs text-slate-600 dark:text-slate-300 space-x-3 tabular-nums">
                  <span>{item.affectedCount.toLocaleString()} people affected</span>
                  <span aria-hidden="true">·</span>
                  <span>Est. ${Number(item.estimatedCostUsd || 0).toLocaleString()}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold">{item.urgencyLevel}</span>
                </div>
                <Link
                  to={`/cases/${item.referenceCode}`}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0B1F3A] dark:text-[#00BCEB] hover:underline whitespace-nowrap"
                >
                  <span>Inspect Case</span>
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

interface CaseDetail extends PublicCase {
  isChildRelated: boolean;
  confirmedDonationsUsd: number;
  distributedAssistanceUsd: number;
}

export function CaseDetailsPage() {
  const { reference } = useParams();
  const [showQr, setShowQr] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['case-detail', reference],
    queryFn: () => apiRequest<CaseDetail>(`/cases/${reference}`),
  });

  if (isLoading) {
    return <div className="max-w-4xl mx-auto px-4 py-16 text-sm text-slate-500">Loading verified case record...</div>;
  }

  if (isError || !data?.data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="font-editorial text-2xl font-semibold">Case record not found</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Only verified public humanitarian cases appear in the public directory.
        </p>
        <Link to="/cases" className="mt-6 inline-block text-sm font-semibold text-[#123F69] dark:text-[#00BCEB]">
          Return to People in Need
        </Link>
      </div>
    );
  }

  const c = data.data;
  const verificationUrl = `${window.location.origin}/cases/${c.referenceCode}`;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      <Link
        to="/cases"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#748196] dark:text-slate-400 hover:text-[#0B1F3A] dark:hover:text-white mb-6"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        <span>Back to People in Need</span>
      </Link>

      <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono-tabular text-xs font-semibold text-[#16865D] dark:text-[#1FA977]">
              VERIFIED PUBLIC RECORD · {c.referenceCode}
            </p>
            <h1 className="mt-2 font-editorial text-2xl sm:text-4xl font-semibold text-[#0B1F3A] dark:text-white">
              {c.title}
            </h1>
            <p className="mt-2 text-sm text-[#748196] dark:text-slate-400">
              {c.categoryName} · {c.regionName}, {c.country} · Verified{' '}
              {c.verifiedAt ? new Date(c.verifiedAt).toLocaleDateString() : 'Recently'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowQr((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-[#0B1F3A] dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <QrCode className="w-4 h-4" aria-hidden="true" />
            <span>{showQr ? 'Hide QR Verification' : 'QR Verification Badge'}</span>
          </button>
        </div>

        {showQr && (
          <div className="mt-6 p-5 rounded-xl bg-[#F7F9FC] dark:bg-[#071324] border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-5">
            <div className="bg-white p-3 rounded-lg">
              <QRCodeSVG value={verificationUrl} size={112} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#0B1F3A] dark:text-white">
                Public Case Verification Code
              </h2>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 max-w-md leading-relaxed">
                Scan this QR code to verify case <span className="font-mono-tabular font-semibold">{c.referenceCode}</span>{' '}
                directly on HumanityBridge without exposing any confidential beneficiary identity or private contact records.
              </p>
            </div>
          </div>
        )}

        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4 py-5 border-y border-slate-100 dark:border-slate-800">
          <div>
            <p className="text-xs text-[#748196] dark:text-slate-400">Affected Individuals</p>
            <p className="mt-1 font-mono-tabular text-xl font-semibold">{c.affectedCount.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-[#748196] dark:text-slate-400">Estimated Need</p>
            <p className="mt-1 font-mono-tabular text-xl font-semibold">${Number(c.estimatedCostUsd).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-[#748196] dark:text-slate-400">Confirmed Support</p>
            <p className="mt-1 font-mono-tabular text-xl font-semibold text-[#16865D] dark:text-[#1FA977]">
              ${c.confirmedDonationsUsd.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#748196] dark:text-slate-400">Funds Distributed</p>
            <p className="mt-1 font-mono-tabular text-xl font-semibold">${c.distributedAssistanceUsd.toLocaleString()}</p>
          </div>
        </div>

        <div className="mt-8 space-y-6">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#748196] dark:text-slate-400">
              Situation Summary
            </h2>
            <p className="mt-2 text-base text-slate-700 dark:text-slate-200 leading-relaxed">{c.publicSummary}</p>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#748196] dark:text-slate-400">
              Required Assistance
            </h2>
            <p className="mt-2 text-base text-slate-700 dark:text-slate-200 leading-relaxed">{c.assistanceNeeded}</p>
          </div>
        </div>

        <div className="mt-8 p-4 rounded-xl bg-[#F7F9FC] dark:bg-[#071324] border border-slate-200 dark:border-slate-800 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-[#16865D] shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Privacy Protection: Personal phone numbers, precise GPS coordinates, and internal verification documents
            are stored exclusively in restricted administrative vaults.
            {c.isChildRelated && ' Guardian consent and child safeguarding restrictions are enforced on this record.'}
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            to={`/donate?case=${encodeURIComponent(c.referenceCode)}`}
            className="px-6 py-3 rounded-lg bg-[#0B1F3A] dark:bg-[#00BCEB] text-white dark:text-[#071324] text-sm font-semibold hover:bg-[#123F69] transition-colors"
          >
            Contribute to This Case
          </Link>
          <Link
            to="/policies/safeguarding"
            className="px-6 py-3 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Report a Safeguarding Concern
          </Link>
        </div>
      </div>
    </div>
  );
}
