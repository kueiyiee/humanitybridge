import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ExternalLink, LogOut, Menu, Moon, ShieldAlert, ShieldCheck, Sun, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export interface DashboardNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}
interface DashboardLayoutProps {
  title: string;
  roleLabel: string;
  navItems: DashboardNavItem[];
  activeTab: string;
  onSelectTab: (id: string) => void;
  children: React.ReactNode;
}

export function DashboardLayout({ title, roleLabel, navItems, activeTab, onSelectTab, children }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const renderNavigation = (mobile = false) => (
    <nav aria-label={title} className="flex-1 overflow-y-auto px-3 py-4">
      <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Workspace</p>
      <div className="space-y-1">
        {navItems.map((item) => {
          const active = activeTab === item.id;
          return (
            <button key={item.id} type="button" aria-current={active ? 'page' : undefined}
              onClick={() => { onSelectTab(item.id); if (mobile) setSidebarOpen(false); }}
              className={`hb-nav-item ${active ? 'hb-nav-item-active' : ''}`}>
              <span className="shrink-0" aria-hidden="true">{item.icon}</span>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {active && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </nav>
  );

  const sidebarContent = (mobile = false) => (
    <>
      <div className="flex h-[76px] items-center justify-between border-b border-slate-200/80 px-5 dark:border-slate-800">
        <Link to="/" className="flex min-w-0 items-center gap-3" onClick={() => mobile && setSidebarOpen(false)}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm dark:bg-cyan-400 dark:text-slate-950">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-bold tracking-tight text-slate-950 dark:text-white">HumanityBridge</span>
            <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.17em] text-slate-400">Humanitarian platform</span>
          </span>
        </Link>
        {mobile && <button type="button" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" className="hb-icon-button"><X className="h-5 w-5" /></button>}
      </div>
      <div className="border-b border-slate-200/80 px-5 py-4 dark:border-slate-800">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">{roleLabel}</p>
        <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{user?.displayName || 'Account'}</p>
        <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
      </div>
      {renderNavigation(mobile)}
      <div className="space-y-2 border-t border-slate-200/80 p-3 dark:border-slate-800">
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-900/70">
          {user?.mfaEnabled ? <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /> : <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />}
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold text-slate-800 dark:text-slate-200">{user?.mfaEnabled ? 'MFA protected' : 'MFA not enabled'}</span>
            <span className="block text-[10px] text-slate-500 dark:text-slate-400">{user?.mfaEnabled ? 'Authenticator verification active' : 'Enable MFA in account settings'}</span>
          </span>
        </div>
        <Link to="/" onClick={() => mobile && setSidebarOpen(false)} className="hb-sidebar-action"><ExternalLink className="h-4 w-4" />View public website</Link>
        <button type="button" onClick={handleLogout} className="hb-sidebar-action text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30"><LogOut className="h-4 w-4" />Sign out securely</button>
      </div>
    </>
  );

  return (
    <div className="hb-dashboard-shell min-h-screen text-slate-900 dark:text-slate-100">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[276px] flex-col border-r border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950 lg:flex">{sidebarContent()}</aside>
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button type="button" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]" />
          <aside className="relative flex h-full w-[min(86vw,320px)] flex-col border-r border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">{sidebarContent(true)}</aside>
        </div>
      )}
      <div className="min-h-screen min-w-0 lg:pl-[276px]">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between gap-3 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation" className="hb-icon-button lg:hidden"><Menu className="h-5 w-5" /></button>
            <div className="min-w-0">
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">{title}</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{navItems.find((item) => item.id === activeTab)?.label || 'Workspace'}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className={`hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold sm:inline-flex ${user?.mfaEnabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'}`}>
              {user?.mfaEnabled ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}{user?.mfaEnabled ? 'MFA enabled' : 'Secure your account'}
            </span>
            <button type="button" onClick={toggleTheme} aria-label="Toggle colour theme" className="hb-icon-button">{theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
            <div className="hidden h-8 w-px bg-slate-200 dark:bg-slate-800 sm:block" />
            <div className="hidden min-w-0 sm:block"><p className="max-w-[180px] truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{user?.displayName}</p><p className="max-w-[180px] truncate text-[10px] text-slate-500 dark:text-slate-400">{user?.email}</p></div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white dark:bg-cyan-400 dark:text-slate-950">{(user?.displayName || user?.email || 'U').slice(0, 1).toUpperCase()}</span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8 xl:p-10">{children}</main>
      </div>
    </div>
  );
}
