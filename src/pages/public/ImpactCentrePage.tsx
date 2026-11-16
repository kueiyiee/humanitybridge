import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { apiRequest } from '../../services/api';

interface ImpactData {
  regionalImpact: Array<{
    regionName: string;
    country: string;
    verifiedCases: number;
    peopleSupported: number;
  }>;
  categoryBreakdown: Array<{
    categoryName: string;
    caseCount: number;
    peopleCount: number;
  }>;
  financialSummary: {
    confirmedDonationsUsd: number;
    confirmedDonationCount: number;
    distributedAssistanceUsd: number;
  };
}

export function ImpactCentrePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['public-impact'],
    queryFn: () => apiRequest<ImpactData>('/impact'),
  });

  const impact = data?.data;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#123F69] dark:text-[#00BCEB]">
          Live Relational Accountability
        </p>
        <h1 className="mt-2 font-editorial text-4xl font-semibold text-[#0B1F3A] dark:text-white">
          Impact Centre
        </h1>
        <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
          Aggregated regional impact and verified financial accountability figures derived directly from HumanityBridge
          database records. Precise beneficiary locations remain strictly concealed.
        </p>
      </div>

      {isLoading || !impact ? (
        <div className="h-64 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6">
              <p className="text-xs text-[#748196] dark:text-slate-400">Confirmed Donations</p>
              <p className="mt-2 font-mono-tabular text-3xl font-semibold text-[#0B1F3A] dark:text-white">
                ${impact.financialSummary.confirmedDonationsUsd.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                Across {impact.financialSummary.confirmedDonationCount} verified settlements
              </p>
            </div>
            <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6">
              <p className="text-xs text-[#748196] dark:text-slate-400">Assistance Distributed</p>
              <p className="mt-2 font-mono-tabular text-3xl font-semibold text-[#16865D] dark:text-[#1FA977]">
                ${impact.financialSummary.distributedAssistanceUsd.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Direct verified disbursements
              </p>
            </div>
            <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6">
              <p className="text-xs text-[#748196] dark:text-slate-400">Active Regions Covered</p>
              <p className="mt-2 font-mono-tabular text-3xl font-semibold text-[#0B1F3A] dark:text-white">
                {impact.regionalImpact.filter((r) => Number(r.verifiedCases) > 0).length}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Aggregated community zones
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6">
              <h2 className="font-editorial text-xl font-semibold mb-4">People Supported by Region</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={impact.regionalImpact}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
                    <XAxis dataKey="regionName" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="peopleSupported" name="People Supported" fill="#0B1F3A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl p-6">
              <h2 className="font-editorial text-xl font-semibold mb-4">Assistance Sector Distribution</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={impact.categoryBreakdown} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="categoryName" type="category" width={150} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="peopleCount" name="People Reached" fill="#16865D" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="font-editorial text-lg font-semibold">Aggregated Regional Breakdown</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#F7F9FC] dark:bg-[#071324] text-xs text-[#748196] dark:text-slate-400">
                  <tr>
                    <th className="px-6 py-3 font-medium">Community Corridor</th>
                    <th className="px-6 py-3 font-medium">Country</th>
                    <th className="px-6 py-3 font-medium text-right">Verified Cases</th>
                    <th className="px-6 py-3 font-medium text-right">People Supported</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {impact.regionalImpact.map((r) => (
                    <tr key={r.regionName}>
                      <td className="px-6 py-3.5 font-medium">{r.regionName}</td>
                      <td className="px-6 py-3.5 text-slate-600 dark:text-slate-300">{r.country}</td>
                      <td className="px-6 py-3.5 text-right font-mono-tabular">{Number(r.verifiedCases)}</td>
                      <td className="px-6 py-3.5 text-right font-mono-tabular font-semibold">
                        {Number(r.peopleSupported).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
