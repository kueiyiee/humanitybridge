import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { PublicHeader } from '../components/PublicHeader';
import { PublicFooter } from '../components/PublicFooter';
import { HumanitarianParticles } from '../components/HumanitarianParticles';
import { apiRequest } from '../services/api';

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const { data } = useQuery({
    queryKey: ['public-settings'],
    queryFn: () => apiRequest<{ settings: Record<string, string> }>('/public/overview'),
    staleTime: 60_000,
  });

  return (
    <div className="hb-public-shell relative min-h-screen flex flex-col overflow-x-hidden text-[var(--color-text)]">
      <HumanitarianParticles />
      <PublicHeader />
      <main className="relative z-10 flex-1">{children}</main>
      <PublicFooter settings={data?.data?.settings} />
    </div>
  );
}
