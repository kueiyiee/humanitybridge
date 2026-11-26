import React from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PublicHeader } from '../components/PublicHeader';
import { PublicFooter } from '../components/PublicFooter';
import { HumanitarianParticles } from '../components/HumanitarianParticles';
import { PageTransition } from '../components/motion/MotionPrimitives';
import { apiRequest } from '../services/api';

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { data } = useQuery({
    queryKey: ['public-settings'],
    queryFn: () => apiRequest<{ settings: Record<string, string> }>('/public/overview'),
    staleTime: 60_000,
  });

  return (
    <div className="hb-public-shell relative min-h-screen flex flex-col overflow-x-clip text-[var(--color-text)]">
      <a className="hb-skip-link" href="#main-content">Skip to main content</a>
      <HumanitarianParticles />
      <PublicHeader />
      <main id="main-content" tabIndex={-1} className="relative z-10 flex-1">
        <PageTransition key={location.pathname}>{children}</PageTransition>
      </main>
      <PublicFooter settings={data?.data?.settings} />
    </div>
  );
}
