import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { PublicHeader } from '../components/PublicHeader';
import { PublicFooter } from '../components/PublicFooter';
import { apiRequest } from '../services/api';

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const { data } = useQuery({
    queryKey: ['public-settings'],
    queryFn: () => apiRequest<{ settings: Record<string, string> }>('/public/overview'),
    staleTime: 60_000,
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9FC] dark:bg-[#071324] text-[#152238] dark:text-slate-100">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter settings={data?.data?.settings} />
    </div>
  );
}
