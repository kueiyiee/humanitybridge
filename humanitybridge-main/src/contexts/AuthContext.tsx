import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { AuthUser } from '../../packages/shared/types';
import { apiRequest } from '../services/api';

interface AuthContextValue {
  user: (AuthUser & { organization?: string | null; bio?: string | null }) | null;
  permissions: string[];
  loading: boolean;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthContextValue['user']>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const res = await apiRequest<{
        user: AuthContextValue['user'];
        permissions: string[];
      }>('/auth/me');
      setUser(res.data.user);
      setPermissions(res.data.permissions || []);
    } catch {
      setUser(null);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const logout = useCallback(async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      setPermissions([]);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, permissions, loading, refreshSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
