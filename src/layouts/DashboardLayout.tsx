import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronDown,
  EllipsisVertical,
  ExternalLink,
  LogOut,
  Moon,
  ShieldAlert,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { BrandLogo } from '../components/BrandLogo';
import { OverflowPopover } from '../components/OverflowPopover';
import { WorkspaceCommandMenu } from '../components/WorkspaceCommandMenu';
import { HumanitarianParticles } from '../components/HumanitarianParticles';

export interface DashboardNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  group?: string;
  permission?: string;
}

interface DashboardLayoutProps {
  title: string;
  roleLabel: string;
  navItems: DashboardNavItem[];
  activeTab: string;
  onSelectTab: (id: string) => void;
  notificationCount?: number;
  children: React.ReactNode;
}

export function DashboardLayout({
  title,
  roleLabel,
  navItems,
  activeTab,
  onSelectTab,
  notificationCount = 0,
  children,
}: DashboardLayoutProps) {
  const { user, permissions, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const visibleNavItems = navItems.filter((item) => !item.permission || permissions.includes(item.permission));
  const overviewItems = visibleNavItems.filter((item) => item.group === 'Overview');
  const groupedItems = new Map<string, DashboardNavItem[]>();

  for (const item of visibleNavItems) {
    if (item.group === 'Overview') continue;
    const group = item.group || 'Workspace';
    groupedItems.set(group, [...(groupedItems.get(group) || []), item]);
  }

  const activeItem = visibleNavItems.find((item) => item.id === activeTab);
  const settingsItem = visibleNavItems.find((item) => item.id === 'settings');
  const notificationsItem = visibleNavItems.find((item) => item.id === 'notifications');
  const initials = (user?.displayName || user?.email || 'U').slice(0, 1).toUpperCase();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const renderNavigationItem = (item: DashboardNavItem, inPopover = false) => {
    const active = activeTab === item.id;
    return (
      <button
        key={item.id}
        type="button"
        data-overflow-item={inPopover ? true : undefined}
        data-overflow-close={inPopover ? true : undefined}
        aria-current={active ? 'page' : undefined}
        onClick={() => onSelectTab(item.id)}
        className={`flex min-h-10 items-center gap-3 text-left text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#51745a] ${
          inPopover
            ? `w-full rounded-lg px-3 ${active ? 'bg-slate-100 text-slate-950 dark:bg-slate-800 dark:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white'}`
            : `w-auto whitespace-nowrap rounded-t-lg border-b-2 px-2 ${active ? 'border-[#24563a] text-slate-950 dark:border-cyan-300 dark:text-white' : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-950 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white'}`
        }`}
      >
        <span className="shrink-0" aria-hidden="true">{item.icon}</span>
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#24563a] dark:bg-cyan-300" aria-hidden="true" />}
      </button>
    );
  };

  const renderMobileNavigation = () => (
    <div className="space-y-3">
      <div className="rounded-lg bg-slate-50 px-3 py-2.5 dark:bg-slate-800/70">
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{user?.displayName || 'Account'}</p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
          {user?.mfaEnabled
            ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            : <ShieldAlert className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />}
          {user?.mfaEnabled ? 'MFA enabled' : 'MFA not enabled'}
        </div>
      </div>

      <nav aria-label={`${title} navigation`} className="space-y-3">
        {overviewItems.length > 0 && (
          <section aria-label="Overview">
            {overviewItems.map((item) => renderNavigationItem(item, true))}
          </section>
        )}
        {Array.from(groupedItems.entries()).map(([group, items]) => (
          <section key={group} aria-labelledby={`mobile-nav-${group.replace(/\W+/g, '-').toLowerCase()}`}>
            <h2
              id={`mobile-nav-${group.replace(/\W+/g, '-').toLowerCase()}`}
              className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400"
            >
              {group}
            </h2>
            <div className="space-y-0.5">
              {items.map((item) => renderNavigationItem(item, true))}
            </div>
          </section>
        ))}
      </nav>

      <div className="space-y-1 border-t border-slate-200 pt-3 dark:border-slate-800">
        <button
          type="button"
          data-overflow-item
          data-overflow-close
          onClick={toggleTheme}
          className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {theme === 'dark'
            ? <Sun className="h-4 w-4" aria-hidden="true" />
            : <Moon className="h-4 w-4" aria-hidden="true" />}
          {theme === 'dark' ? 'Light theme' : 'Dark theme'}
        </button>
        <button
          type="button"
          data-overflow-item
          data-overflow-close
          onClick={() => void handleLogout()}
          className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 dark:text-rose-300 dark:hover:bg-rose-950/30"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="hb-dashboard-shell relative isolate min-h-screen text-slate-900 dark:text-slate-100">
      <HumanitarianParticles />
      <header className="hb-topbar sticky top-0 z-50 border-b border-slate-200/70 bg-white/75 backdrop-blur-2xl dark:border-white/10 dark:bg-black/65">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:h-[68px] lg:px-8">
          <Link
            to="/"
            aria-label="HumanityBridge home"
            className="inline-flex shrink-0 items-center rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#51745a]"
          >
            <BrandLogo className="h-[40px] w-[120px]" />
          </Link>

          <div className="hidden min-w-0 shrink-0 md:block">
            <p className="max-w-[150px] truncate text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{roleLabel}</p>
            <p className="max-w-[150px] truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{activeItem?.label || title}</p>
          </div>

          <nav aria-label={`${title} navigation`} className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex xl:gap-2">
            {overviewItems.map((item) => renderNavigationItem(item))}
            {Array.from(groupedItems.entries()).map(([group, items]) => {
              const groupIsActive = items.some((item) => item.id === activeTab);
              return (
                <OverflowPopover
                  key={group}
                  label={`${group} navigation`}
                  trigger={(
                    <>
                      <span>{group}</span>
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                    </>
                  )}
                  triggerClassName={`inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[13px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#51745a] ${
                    groupIsActive
                      ? 'bg-slate-100 text-slate-950 dark:bg-slate-800 dark:text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                  }`}
                >
                  <div className="space-y-0.5">
                    <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{group}</p>
                    {items.map((item) => renderNavigationItem(item, true))}
                  </div>
                </OverflowPopover>
              );
            })}
          </nav>

          <div className="flex min-w-0 flex-1 justify-end px-1 xl:justify-center">
            <WorkspaceCommandMenu items={visibleNavItems} onSelect={onSelectTab} />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            {notificationsItem && (
              <button
                type="button"
                onClick={() => onSelectTab(notificationsItem.id)}
                aria-label={notificationCount > 0 ? `${notificationCount} unread notifications` : 'Notifications'}
                aria-current={activeTab === notificationsItem.id ? 'page' : undefined}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#51745a] dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
                {notificationCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 min-w-4 rounded-full bg-rose-600 px-1 text-center text-[9px] font-bold leading-4 text-white">
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="hidden h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#51745a] dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white lg:inline-flex"
            >
              {theme === 'dark'
                ? <Sun className="h-4 w-4" aria-hidden="true" />
                : <Moon className="h-4 w-4" aria-hidden="true" />}
            </button>

            <div className="hidden lg:block">
              <OverflowPopover
                label="Account menu"
                trigger={(
                  <>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white dark:bg-cyan-300 dark:text-slate-950">{initials}</span>
                    <span className="hidden min-w-0 text-left xl:block">
                      <span className="block max-w-[145px] truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{user?.displayName || 'Account'}</span>
                      <span className="block text-[10px] text-slate-500 dark:text-slate-400">{roleLabel}</span>
                    </span>
                    <ChevronDown className="hidden h-3.5 w-3.5 text-slate-500 xl:block" aria-hidden="true" />
                  </>
                )}
                triggerClassName="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#51745a] dark:hover:bg-slate-800"
              >
                <div className="space-y-3">
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{user?.displayName || 'Account'}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
                    <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {user?.mfaEnabled
                        ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                        : <ShieldAlert className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />}
                      {user?.mfaEnabled ? 'MFA enabled' : 'MFA not enabled'}
                    </p>
                  </div>
                  {settingsItem && (
                    <button
                      type="button"
                      data-overflow-item
                      data-overflow-close
                      onClick={() => onSelectTab(settingsItem.id)}
                      className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      Account settings
                    </button>
                  )}
                  <div className="border-t border-slate-200 pt-2 dark:border-slate-800">
                    <button
                      type="button"
                      data-overflow-item
                      data-overflow-close
                      onClick={() => void handleLogout()}
                      className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30"
                    >
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      Sign out
                    </button>
                  </div>
                </div>
              </OverflowPopover>
            </div>

            <div className="lg:hidden">
              <OverflowPopover
                label="Workspace navigation and account options"
                trigger={<EllipsisVertical className="h-5 w-5" aria-hidden="true" />}
                triggerClassName="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#51745a] dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {renderMobileNavigation()}
              </OverflowPopover>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-[1600px] p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8 lg:pb-8 xl:p-10">{children}</main>

      <nav className="hb-mobile-dock relative z-20 lg:hidden" aria-label={`${title} quick navigation`}>
        {visibleNavItems.slice(0, 4).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectTab(item.id)}
            aria-current={activeTab === item.id ? 'page' : undefined}
            className={activeTab === item.id ? 'is-active' : ''}
          >
            <span aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
        <button type="button" onClick={() => onSelectTab(notificationsItem?.id || settingsItem?.id || 'overview')}>
          <span aria-hidden="true"><EllipsisVertical className="h-4 w-4" /></span>
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}
