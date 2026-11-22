import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ArrowUpRight, EllipsisVertical, Moon, Sun } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { OverflowPopover } from './OverflowPopover';
import { useTheme } from '../contexts/ThemeContext';
import { useLocale, type AppLocale } from '../contexts/LocaleContext';

const publicLinks = [
  { to: '/stories', label: 'Stories' },
  { to: '/cases', label: 'People in Need' },
  { to: '/campaigns', label: 'Campaigns' },
  { to: '/impact', label: 'Impact Centre' },
  { to: '/about', label: 'About Us' },
  { to: '/get-involved', label: 'Get Involved' },
];

function publicNavClass(isActive: boolean) {
  return `hb-public-nav-link group relative inline-flex min-h-11 items-center whitespace-nowrap px-2 text-[13px] font-semibold tracking-[0.01em] transition-colors duration-200 focus-visible:rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--hb-accent)] after:absolute after:inset-x-2 after:bottom-1 after:h-[2px] after:origin-left after:rounded-full after:bg-[var(--hb-accent-strong)] after:transition-transform after:duration-200 ${
    isActive
      ? 'text-[var(--hb-text-strong)] after:scale-x-100'
      : 'text-[var(--hb-muted)] after:scale-x-0 hover:text-[var(--hb-text-strong)] group-hover:after:scale-x-100'
  }`;
}

function MobileNavClass(isActive: boolean) {
  return `flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-slate-100 text-slate-950 dark:bg-slate-800 dark:text-white'
      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white'
  }`;
}

export function PublicHeader() {
  const { theme, toggleTheme } = useTheme();
  const { locale, setLocale, t } = useLocale();

  const languageSelector = (id: string, compact = false) => (
    <label className={compact ? 'block shrink-0' : 'block'} htmlFor={id}>
      <span className={compact ? 'sr-only' : 'mb-1.5 block text-[11px] font-semibold text-slate-500 dark:text-slate-400'}>
        Language
      </span>
      <select
        id={id}
        value={locale}
        onChange={(event) => setLocale(event.currentTarget.value as AppLocale)}
        aria-label="Select language"
        className={compact
          ? 'h-10 w-[10.5rem] rounded-full border border-[var(--hb-border)] bg-[var(--hb-glass)] px-3 text-[12px] font-semibold text-[var(--hb-text)] outline-none transition hover:bg-[var(--hb-glass-strong)] focus-visible:ring-2 focus-visible:ring-[var(--hb-accent)]'
          : 'min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--hb-accent)] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'}
      >
        <option value="en">English</option>
        <option value="nus">Thok Nath (Nuer) · review in progress</option>
      </select>
    </label>
  );

  const themeToggle = (
    <button
      type="button"
      onClick={toggleTheme}
      data-overflow-item
      data-overflow-close
      className="inline-flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {theme === 'dark'
        ? <Sun className="h-4 w-4" aria-hidden="true" />
        : <Moon className="h-4 w-4" aria-hidden="true" />}
      {theme === 'dark' ? 'Light theme' : 'Dark theme'}
    </button>
  );

  return (
    <header className="hb-topbar sticky top-0 z-50 border-b border-slate-200/70 bg-white/75 text-slate-900 backdrop-blur-2xl dark:border-white/10 dark:bg-black/65 dark:text-slate-100">
      <div className="mx-auto flex h-[64px] max-w-[1480px] items-center justify-between gap-4 px-4 sm:px-6 xl:h-[76px] xl:px-8">
        <Link
          to="/"
          className="inline-flex shrink-0 items-center rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--hb-accent)]"
          aria-label="HumanityBridge home"
        >
          <BrandLogo className="h-[42px] w-[132px] xl:h-[46px] xl:w-[148px]" />
        </Link>

        <nav
          aria-label="Primary navigation"
          className="hidden min-w-0 flex-1 items-center justify-center gap-1 xl:flex 2xl:gap-2"
        >
          {publicLinks.map(({ to, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => publicNavClass(isActive)}>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-2 xl:flex">
          {languageSelector('desktop-language', true)}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--hb-border)] bg-[var(--hb-glass)] text-[var(--hb-muted)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--hb-glass-strong)] hover:text-[var(--hb-text-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--hb-accent)]"
          >
            {theme === 'dark'
              ? <Sun className="h-4 w-4" aria-hidden="true" />
              : <Moon className="h-4 w-4" aria-hidden="true" />}
          </button>
          <Link
            to="/donate"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[var(--hb-glass-border)] bg-[var(--hb-primary)] px-5 text-[13px] font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--hb-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--hb-accent)] dark:text-slate-950"
          >
            {t('donateNow')}
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="xl:hidden">
          <OverflowPopover
            label="More navigation options"
            trigger={<EllipsisVertical className="h-5 w-5" aria-hidden="true" />}
            triggerClassName="hb-menu-trigger inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--hb-glass-border)] bg-[var(--hb-glass)] text-[var(--hb-text)] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--hb-glass-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--hb-accent)]"
            panelClassName="hb-navigation-popover"
          >
            <div className="space-y-3">
              <section aria-labelledby="public-navigation-heading">
                <div className="mb-2 border-b border-[var(--hb-border)] px-3 pb-3 pt-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--hb-accent-strong)]">HumanityBridge</p>
                  <h2 id="public-navigation-heading" className="mt-1 text-base font-semibold tracking-tight text-[var(--hb-text-strong)]">
                    Explore
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--hb-muted)]">Navigate our stories, support pathways and community impact.</p>
                </div>
                <nav aria-label="Public navigation" className="space-y-0.5">
                  {publicLinks.map(({ to, label }) => (
                    <NavLink
                      key={to}
                      to={to}
                      data-overflow-item
                      data-overflow-close
                      className={({ isActive }) => MobileNavClass(isActive)}
                    >
                      {label}
                    </NavLink>
                  ))}
                </nav>
              </section>
              <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
                <Link
                  to="/donate"
                  data-overflow-item
                  data-overflow-close
                  className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--hb-primary)] px-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--hb-primary-hover)] dark:text-slate-950"
                >
                  {t('donateNow')}
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
              <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
                {languageSelector('mobile-language')}
                {themeToggle}
              </div>
            </div>
          </OverflowPopover>
        </div>
      </div>
    </header>
  );
}
