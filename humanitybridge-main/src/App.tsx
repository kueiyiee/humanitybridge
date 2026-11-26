import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { LocaleProvider } from './contexts/LocaleContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicLayout } from './layouts/PublicLayout';
import { DASHBOARD_ROLES } from '../packages/shared/types';

import { HomePage } from './pages/public/HomePage';
import { OurStoriesPage, StoryDetailsPage } from './pages/public/StoriesPages';
import { PeopleInNeedPage, CaseDetailsPage } from './pages/public/CasesPages';
import { CampaignsPage, CampaignDetailsPage } from './pages/public/CampaignsPages';
import { DonatePage } from './pages/public/DonatePage';
import { ImpactCentrePage } from './pages/public/ImpactCentrePage';
import {
  AboutUsPage,
  FAQPage,
  GetInvolvedPage,
  HowItWorksPage,
  MissionVisionPage,
  NewsDetailsPage,
  NewsPage,
} from './pages/public/InstitutionalPages';
import { ContactPage, PartnershipPage, VolunteerPage } from './pages/public/ParticipationPages';
import {
  PrivacyPolicyPage,
  SafeguardingPolicyPage,
  TermsPage,
  TransparencyPolicyPage,
} from './pages/public/PolicyPages';
import {
  ForgotPasswordPage,
  LoginPage,
  ResetPasswordPage,
  VerifyEmailPage,
} from './pages/public/AuthPages';

const AdminDashboard = lazy(() =>
  import('./pages/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })),
);
const CoordinatorDashboard = lazy(() =>
  import('./pages/coordinator/CoordinatorDashboard').then((m) => ({ default: m.CoordinatorDashboard })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function RouteLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center text-sm text-[#748196]">
      Loading workspace...
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <LocaleProvider>
            <AuthProvider>
              <BrowserRouter>
                <Suspense fallback={<RouteLoader />}>
                  <Routes>
                    {/* Public Website Routes */}
                    <Route path="/" element={<PublicLayout><HomePage /></PublicLayout>} />
                    <Route path="/stories" element={<PublicLayout><OurStoriesPage /></PublicLayout>} />
                    <Route path="/stories/:slug" element={<PublicLayout><StoryDetailsPage /></PublicLayout>} />
                    <Route path="/cases" element={<PublicLayout><PeopleInNeedPage /></PublicLayout>} />
                    <Route path="/cases/:reference" element={<PublicLayout><CaseDetailsPage /></PublicLayout>} />
                    <Route path="/campaigns" element={<PublicLayout><CampaignsPage /></PublicLayout>} />
                    <Route path="/campaigns/:slug" element={<PublicLayout><CampaignDetailsPage /></PublicLayout>} />
                    <Route path="/donate" element={<PublicLayout><DonatePage /></PublicLayout>} />
                    <Route path="/impact" element={<PublicLayout><ImpactCentrePage /></PublicLayout>} />
                    <Route path="/about" element={<PublicLayout><AboutUsPage /></PublicLayout>} />
                    <Route path="/mission" element={<PublicLayout><MissionVisionPage /></PublicLayout>} />
                    <Route path="/how-it-works" element={<PublicLayout><HowItWorksPage /></PublicLayout>} />
                    <Route path="/get-involved" element={<PublicLayout><GetInvolvedPage /></PublicLayout>} />
                    <Route path="/volunteer" element={<PublicLayout><VolunteerPage /></PublicLayout>} />
                    <Route path="/partnerships" element={<PublicLayout><PartnershipPage /></PublicLayout>} />
                    <Route path="/news" element={<PublicLayout><NewsPage /></PublicLayout>} />
                    <Route path="/news/:slug" element={<PublicLayout><NewsDetailsPage /></PublicLayout>} />
                    <Route path="/contact" element={<PublicLayout><ContactPage /></PublicLayout>} />
                    <Route path="/faq" element={<PublicLayout><FAQPage /></PublicLayout>} />
                    <Route path="/policies/privacy" element={<PublicLayout><PrivacyPolicyPage /></PublicLayout>} />
                    <Route path="/policies/terms" element={<PublicLayout><TermsPage /></PublicLayout>} />
                    <Route path="/policies/safeguarding" element={<PublicLayout><SafeguardingPolicyPage /></PublicLayout>} />
                    <Route path="/policies/transparency" element={<PublicLayout><TransparencyPolicyPage /></PublicLayout>} />

                    {/* Authentication Routes */}
                    <Route path="/login" element={<PublicLayout><LoginPage /></PublicLayout>} />
                    <Route path="/forgot-password" element={<PublicLayout><ForgotPasswordPage /></PublicLayout>} />
                    <Route path="/reset-password" element={<PublicLayout><ResetPasswordPage /></PublicLayout>} />
                    <Route path="/verify-email" element={<PublicLayout><VerifyEmailPage /></PublicLayout>} />

                    {/* Exactly Two Role-Based Protected Dashboards */}
                    <Route
                      path="/admin"
                      element={
                        <ProtectedRoute allowedRole={DASHBOARD_ROLES.PLATFORM_ADMIN}>
                          <AdminDashboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/coordinator"
                      element={
                        <ProtectedRoute allowedRole={DASHBOARD_ROLES.COMMUNITY_COORDINATOR}>
                          <CoordinatorDashboard />
                        </ProtectedRoute>
                      }
                    />

                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </AuthProvider>
          </LocaleProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
