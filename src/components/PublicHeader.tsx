import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ArrowUpRight, Check, EllipsisVertical, Globe2, HeartHandshake, Moon, Sun } from 'lucide-react';
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
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!languageMenuOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!languageMenuRef.current?.contains(event.target as Node)) setLanguageMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLanguageMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [languageMenuOpen]);

  const chooseLocale = (nextLocale: AppLocale) => {
    setLocale(nextLocale);
    setLanguageMenuOpen(false);
  };

  const iconButtonClass =
    'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--hb-glass-border)] bg-[var(--hb-glass)] text-[var(--hb-muted)] shadow-sm backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--hb-accent)] hover:bg-[var(--hb-glass-strong)] hover:text-[var(--hb-text-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--hb-accent)]';

  return (
    <header className="hb-topbar sticky top-0 z-50 border-b border-slate-200/70 bg-white/75 text-slate-900 backdrop-blur-2xl dark:border-white/10 dark:bg-black/65 dark:text-slate-100">
      <div className="mx-auto flex h-[64px] max-w-[1480px] items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6 xl:h-[76px] xl:px-8">
        <Link
          to="/"
          className="inline-flex min-w-0 shrink items-center rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--hb-accent)]"
          aria-label="HumanityBridge home"
        >
          <BrandLogo className="h-[39px] w-[122px] sm:h-[42px] sm:w-[132px] xl:h-[46px] xl:w-[148px]" />
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

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <div className="relative" ref={languageMenuRef}>
            <button
              type="button"
              onClick={() => setLanguageMenuOpen((open) => !open)}
              aria-label="Choose language"
              aria-haspopup="menu"
              aria-expanded={languageMenuOpen}
              aria-controls="hb-language-menu"
              title={locale === 'en' ? 'Language: English (British)' : 'Language: Thok Nath'}
              className={iconButtonClass}
            >
              <Globe2 className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
            {languageMenuOpen && (
              <div
                id="hb-language-menu"
                role="menu"
                aria-label="Choose website language"
                className="absolute right-0 top-[calc(100%+12px)] z-[70] w-56 overflow-hidden rounded-2xl border border-[var(--hb-glass-border)] bg-[var(--hb-glass-strong)] p-2 text-[var(--hb-text)] shadow-2xl shadow-black/15 backdrop-blur-2xl"
              >
                <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--hb-muted)]">
                  Website language
                </p>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={locale === 'en'}
                  onClick={() => chooseLocale('en')}
                  className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-semibold transition-colors hover:bg-[var(--hb-glass)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hb-accent)]"
                >
                  <span>English (British)</span>
                  {locale === 'en' && <Check className="h-4 w-4 text-[var(--hb-accent-strong)]" aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={locale === 'nus'}
                  onClick={() => chooseLocale('nus')}
                  className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-semibold transition-colors hover:bg-[var(--hb-glass)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--hb-accent)]"
                >
                  <span>Thok Nath (Nuer)</span>
                  {locale === 'nus' && <Check className="h-4 w-4 text-[var(--hb-accent-strong)]" aria-hidden="true" />}
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className={iconButtonClass}
          >
            {theme === 'dark'
              ? <Sun className="h-[18px] w-[18px]" aria-hidden="true" />
              : <Moon className="h-[18px] w-[18px]" aria-hidden="true" />}
          </button>

          <div className="flex shrink-0 items-center gap-1.5">
            <Link
              to="/donate"
              aria-label="Donate to HumanityBridge"
              title="Donate to HumanityBridge"
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-[var(--hb-glass-border)] bg-[var(--hb-primary)] px-3 sm:gap-2 sm:px-4 xl:px-5 text-[12px] sm:text-[13px] font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--hb-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--hb-accent)] dark:text-slate-950"
            >
              <HeartHandshake className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{t('donateNow')}</span>
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

              </div>
            </OverflowPopover>
          </div>
        </div>
      </div>
    </header>
  );
}
