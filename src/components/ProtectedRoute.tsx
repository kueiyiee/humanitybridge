import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { DashboardRole } from '../../packages/shared/types';

interface ProtectedRouteProps {
  allowedRoles: DashboardRole[];
  children: React.ReactNode;
}

export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F9FC] dark:bg-[#071324] text-slate-600 dark:text-slate-300">
        <div className="text-sm font-medium">Verifying secure session...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    const redirectTarget = user.role === 'COMMUNITY_COORDINATOR' ? '/coordinator' : '/admin';
    return <Navigate to={redirectTarget} replace />;
  }

  return <>{children}</>;
}
