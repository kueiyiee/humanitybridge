import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { EllipsisVertical, Moon, Sun } from 'lucide-react';
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
  return `inline-flex min-h-10 items-center whitespace-nowrap border-b-2 px-0.5 text-[13px] font-semibold transition-colors focus-visible:outline ${
    isActive
      ? 'border-[#24563a] text-[#173c2a] dark:border-cyan-300 dark:text-white'
      : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-950 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white'
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

  const languageSelector = (id: string) => (
    <label className="block" htmlFor={id}>
      <span className="mb-1.5 block text-[11px] font-semibold text-slate-500 dark:text-slate-400">Language</span>
      <select
        id={id}
        value={locale}
        onChange={(event) => setLocale(event.currentTarget.value as AppLocale)}
        className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus-visible:ring-2 focus-visible:ring-[#51745a] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
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
      <div className="mx-auto flex h-[60px] max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:h-16 lg:px-8">
        <Link
          to="/"
          className="inline-flex shrink-0 items-center rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#51745a]"
          aria-label="HumanityBridge home"
        >
          <BrandLogo className="h-[40px] w-[120px]" />
        </Link>

        <nav aria-label="Primary navigation" className="hidden min-w-0 flex-1 items-center justify-center gap-5 lg:flex xl:gap-7">
          {publicLinks.map(({ to, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => publicNavClass(isActive)}>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          {languageSelector('desktop-language')}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#51745a] dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            {theme === 'dark'
              ? <Sun className="h-4 w-4" aria-hidden="true" />
              : <Moon className="h-4 w-4" aria-hidden="true" />}
          </button>
          <Link
            to="/donate"
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#24563a] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#183f2b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#51745a] dark:bg-cyan-300 dark:text-slate-950 dark:hover:bg-cyan-200"
          >
            {t('donateNow')}
          </Link>
        </div>

        <div className="lg:hidden">
          <OverflowPopover
            label="More navigation options"
            trigger={<EllipsisVertical className="h-5 w-5" aria-hidden="true" />}
            triggerClassName="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#51745a] dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <div className="space-y-3">
              <section aria-labelledby="public-navigation-heading">
                <h2 id="public-navigation-heading" className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  Explore
                </h2>
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
                  className="flex min-h-11 items-center rounded-lg bg-[#24563a] px-3 text-sm font-semibold text-white transition-colors hover:bg-[#183f2b] dark:bg-cyan-300 dark:text-slate-950 dark:hover:bg-cyan-200"
                >
                  {t('donateNow')}
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
