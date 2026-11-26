import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { m } from 'motion/react';
import {
  Bell,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Ellipsis,
  LogOut,
  Menu,
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
import { motionTokens, PageTransition } from '../components/motion/MotionPrimitives';

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
  footerStatus?: React.ReactNode;
  variant?: 'admin' | 'default';
  children: React.ReactNode;
}

const COLLAPSED_STORAGE_KEY = 'hb_admin_sidebar_collapsed';

function getInitialSidebarState() {
  try {
    return window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function DashboardLayout({
  title,
  roleLabel,
  navItems,
  activeTab,
  onSelectTab,
  notificationCount = 0,
  footerStatus,
  variant = 'default',
  children,
}: DashboardLayoutProps) {
  const { user, permissions, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileNavigationOpen, setMobileNavigationOpen] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(getInitialSidebarState);
  const visibleNavItems = navItems.filter((item) => !item.permission || permissions.includes(item.permission));
  const overviewItems = visibleNavItems.filter((item) => item.group === 'Overview');
  const groupedItems = new Map<string, DashboardNavItem[]>();

  for (const item of visibleNavItems) {
    if (item.group === 'Overview') continue;
    const group = item.group || 'Workspace';
    groupedItems.set(group, [...(groupedItems.get(group) || []), item]);
  }

  const notificationsItem = visibleNavItems.find((item) => item.id === 'notifications');
  const initials = (user?.displayName || user?.email || 'U').slice(0, 1).toUpperCase();
  const adminVariant = variant === 'admin';
  const isSidebarCollapsed = adminVariant && sidebarCollapsed;

  React.useEffect(() => {
    if (!adminVariant) return;
    try {
      window.localStorage.setItem(COLLAPSED_STORAGE_KEY, String(sidebarCollapsed));
    } catch {
      // The sidebar remains usable for the current session.
    }
  }, [adminVariant, sidebarCollapsed]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const selectTab = (id: string) => {
    onSelectTab(id);
    setMobileNavigationOpen(false);
  };

  const renderNavigationItem = (item: DashboardNavItem, inPopover = false) => {
    const active = activeTab === item.id;
    return (
      <button
        key={item.id}
        type="button"
        data-overflow-item={inPopover ? true : undefined}
        data-overflow-close={inPopover ? true : undefined}
        aria-label={isSidebarCollapsed && !inPopover && !mobileNavigationOpen ? item.label : undefined}
        aria-current={active ? 'page' : undefined}
        title={isSidebarCollapsed && !inPopover && !mobileNavigationOpen ? item.label : undefined}
        onClick={() => selectTab(item.id)}
        className={`hb-sidebar-nav-item ${active ? 'is-active' : ''} ${isSidebarCollapsed && !inPopover && !mobileNavigationOpen ? 'is-collapsed' : ''} ${inPopover ? 'is-popover-item' : ''}`}
      >
        <span className="hb-sidebar-nav-icon" aria-hidden="true">{item.icon}</span>
        <span className="hb-sidebar-nav-label">{item.label}</span>
        {item.id === 'notifications' && notificationCount > 0 && (
          <span className="hb-sidebar-nav-count">{notificationCount > 99 ? '99+' : notificationCount}</span>
        )}
        {active && (
          <m.span
            className="hb-sidebar-active-marker"
            initial={{ opacity: 0, scale: 0.65 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: motionTokens.duration.quick, ease: motionTokens.ease }}
            aria-hidden="true"
          />
        )}
      </button>
    );
  };

  const renderSidebarNavigation = (inPopover = false) => (
    <nav aria-label={`${title} navigation`} className="hb-sidebar-navigation">
      {overviewItems.length > 0 && (
        <section className="hb-sidebar-section" aria-label="Executive">
          {(!isSidebarCollapsed || mobileNavigationOpen) && <p className="hb-sidebar-section-label">Executive</p>}
          {overviewItems.map((item) => renderNavigationItem(item, inPopover))}
        </section>
      )}
      {Array.from(groupedItems.entries()).map(([group, items]) => (
        <section className="hb-sidebar-section" key={group} aria-label={group}>
          {(!isSidebarCollapsed || mobileNavigationOpen) && <p className="hb-sidebar-section-label">{group}</p>}
          {items.map((item) => renderNavigationItem(item, inPopover))}
        </section>
      ))}
    </nav>
  );

  return (
    <div className={`hb-dashboard-shell hb-admin-console relative isolate min-h-screen overflow-x-clip text-[var(--hb-text)] ${adminVariant ? 'is-admin-console' : ''} ${isSidebarCollapsed ? 'is-sidebar-collapsed' : ''}`}>
      <HumanitarianParticles />

      {mobileNavigationOpen && (
        <button
          type="button"
          className="hb-sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNavigationOpen(false)}
        />
      )}

      <aside className={`hb-console-sidebar ${mobileNavigationOpen ? 'is-mobile-open' : ''}`} aria-label={`${title} sidebar`}>
        <div className="hb-sidebar-brand">
          <Link to="/" aria-label="HumanityBridge home" className="hb-sidebar-logo">
            <BrandLogo className="h-10 w-[132px]" />
          </Link>
          <div className="hb-sidebar-identity">
            <p>{title}</p>
            <span>{roleLabel}</span>
          </div>
          <button
            type="button"
            className="hb-mobile-sidebar-close"
            aria-label="Close navigation"
            onClick={() => setMobileNavigationOpen(false)}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="hb-sidebar-scroll">
          {renderSidebarNavigation()}
        </div>

        <div className="hb-sidebar-footer">
          {footerStatus}
          <div className="hb-sidebar-admin-card">
            <span className="hb-sidebar-admin-avatar">{initials}</span>
            <span className="hb-sidebar-admin-copy">
              <strong>{user?.displayName || 'Administrator'}</strong>
              <small>Secure workspace</small>
            </span>
            {user?.mfaEnabled
              ? <ShieldCheck className="h-4 w-4 shrink-0" aria-label="MFA enabled" />
              : <ShieldAlert className="h-4 w-4 shrink-0" aria-label="MFA not enabled" />}
          </div>
          <div className="hb-sidebar-footer-actions">
            <button type="button" onClick={() => void handleLogout()} aria-label="Sign out" title="Sign out">
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {!isSidebarCollapsed && <span>Sign out</span>}
            </button>
          </div>
          {adminVariant && (
            <button
              type="button"
              className="hb-sidebar-collapse"
              onClick={() => setSidebarCollapsed((current) => !current)}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isSidebarCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
              {!isSidebarCollapsed && <span>Collapse menu</span>}
            </button>
          )}
        </div>
      </aside>

      <div className="hb-console-main">
        <header className="hb-topbar hb-console-topbar">
          <div className="hb-topbar-inner">
            <button
              type="button"
              className="hb-mobile-nav-trigger"
              aria-label="Open navigation"
              aria-expanded={mobileNavigationOpen}
              onClick={() => setMobileNavigationOpen(true)}
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="hb-topbar-breadcrumb">
              <span>{roleLabel}</span>
              <ChevronDown className="h-3 w-3 -rotate-90" aria-hidden="true" />
              <strong>{visibleNavItems.find((item) => item.id === activeTab)?.label || title}</strong>
            </div>

            <WorkspaceCommandMenu items={visibleNavItems} onSelect={selectTab} />

            <div className="hb-topbar-actions">
              {notificationsItem && (
                <button
                  type="button"
                  onClick={() => selectTab(notificationsItem.id)}
                  aria-label={notificationCount > 0 ? `${notificationCount} unread notifications` : 'Notifications'}
                  aria-current={activeTab === notificationsItem.id ? 'page' : undefined}
                  className="hb-topbar-icon-button"
                >
                  <Bell className="h-[17px] w-[17px]" aria-hidden="true" />
                  {notificationCount > 0 && <span className="hb-notification-pulse">{notificationCount > 99 ? '99+' : notificationCount}</span>}
                </button>
              )}
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                className="hb-topbar-icon-button"
              >
                {theme === 'dark' ? <Sun className="h-[17px] w-[17px]" aria-hidden="true" /> : <Moon className="h-[17px] w-[17px]" aria-hidden="true" />}
              </button>

              <div className="hb-account-menu">
                <OverflowPopover
                  label="Account menu"
                  trigger={(
                    <>
                      <span className="hb-account-avatar">{initials}</span>
                      <span className="hidden min-w-0 text-left xl:block">
                        <span className="block max-w-[145px] truncate text-xs font-semibold text-[var(--hb-text-strong)]">{user?.displayName || 'Account'}</span>
                        <span className="block text-[10px] text-[var(--hb-muted)]">{roleLabel}</span>
                      </span>
                      <ChevronDown className="hidden h-3.5 w-3.5 text-[var(--hb-muted)] xl:block" aria-hidden="true" />
                    </>
                  )}
                  triggerClassName="hb-account-trigger"
                >
                  <div className="space-y-3">
                    <div className="px-3 py-2">
                      <p className="truncate text-sm font-semibold text-[var(--hb-text-strong)]">{user?.displayName || 'Account'}</p>
                      <p className="truncate text-xs text-[var(--hb-muted)]">{user?.email}</p>
                      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--hb-muted)]">
                        {user?.mfaEnabled
                          ? <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          : <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />}
                        {user?.mfaEnabled ? 'MFA enabled' : 'MFA not enabled'}
                      </p>
                    </div>
                    <div className="border-t border-[var(--hb-border)] pt-2">
                      <button type="button" data-overflow-item data-overflow-close onClick={() => void handleLogout()} className="hb-sidebar-nav-item is-popover-item">
                        <LogOut className="h-4 w-4" aria-hidden="true" />
                        <span>Sign out</span>
                      </button>
                    </div>
                  </div>
                </OverflowPopover>
              </div>

            </div>
          </div>
        </header>

        <main className="hb-console-content relative z-10 mx-auto w-full max-w-[1640px] p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8 lg:pb-10 xl:p-10">
          <PageTransition key={activeTab}>{children}</PageTransition>
        </main>
      </div>

      <nav className="hb-mobile-dock lg:hidden" aria-label={`${title} quick navigation`}>
        {visibleNavItems.slice(0, 4).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectTab(item.id)}
            aria-current={activeTab === item.id ? 'page' : undefined}
            className={activeTab === item.id ? 'is-active' : ''}
          >
            <span aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
        <button type="button" onClick={() => setMobileNavigationOpen(true)} aria-label="Open all workspace sections">
          <span aria-hidden="true"><Ellipsis className="h-4 w-4" /></span>
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}
