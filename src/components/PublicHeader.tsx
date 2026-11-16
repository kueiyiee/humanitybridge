import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ChevronDown, Menu, Moon, Sun, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../contexts/LocaleContext';
import { DASHBOARD_ROLES } from '../../packages/shared/types';

export function PublicHeader() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { t } = useLocale();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [involvedOpen, setInvolvedOpen] = useState(false);

  const dashboardPath =
    user?.role === DASHBOARD_ROLES.PLATFORM_ADMIN ? '/admin' : user ? '/coordinator' : '/login';

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 py-1 border-b-2 ${
      isActive
        ? 'text-[#0B1F3A] dark:text-[#00BCEB] border-[#00BCEB]'
        : 'text-[#152238]/80 dark:text-slate-300 border-transparent hover:text-[#0B1F3A] dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600'
    }`;

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#071324]/95 backdrop-blur border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
        {/* Zone 1: Single-line Brand Wordmark */}
        <Link
          to="/"
          className="font-editorial text-xl font-semibold tracking-tight text-[#0B1F3A] dark:text-white whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#00BCEB] rounded"
        >
          HumanityBridge
        </Link>

        {/* Zone 2: Accessible Single-Line Navigation with Dropdown Menus */}
        <nav aria-label="Primary Navigation" className="hidden lg:flex items-center gap-5">
          <NavLink to="/stories" className={navLinkClass}>
            Our Stories
          </NavLink>
          <NavLink to="/cases" className={navLinkClass}>
            People in Need
          </NavLink>
          <NavLink to="/campaigns" className={navLinkClass}>
            Campaigns
          </NavLink>
          <NavLink to="/impact" className={navLinkClass}>
            Impact Centre
          </NavLink>

          <div
            className="relative"
            onMouseEnter={() => setAboutOpen(true)}
            onMouseLeave={() => setAboutOpen(false)}
          >
            <button
              type="button"
              aria-expanded={aboutOpen}
              onClick={() => setAboutOpen((o) => !o)}
              className="flex items-center gap-1 text-sm font-medium text-[#152238]/80 dark:text-slate-300 hover:text-[#0B1F3A] dark:hover:text-white whitespace-nowrap shrink-0 py-1 focus-visible:outline-2 focus-visible:outline-[#00BCEB] rounded"
            >
              <span>About Us</span>
              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            {aboutOpen && (
              <div className="absolute left-0 top-full pt-2 w-52 z-50">
                <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1.5">
                  <Link to="/about" onClick={() => setAboutOpen(false)} className="block px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                    About HumanityBridge
                  </Link>
                  <Link to="/mission" onClick={() => setAboutOpen(false)} className="block px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                    Mission & Vision
                  </Link>
                  <Link to="/how-it-works" onClick={() => setAboutOpen(false)} className="block px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                    How It Works
                  </Link>
                  <Link to="/news" onClick={() => setAboutOpen(false)} className="block px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                    Community News
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div
            className="relative"
            onMouseEnter={() => setInvolvedOpen(true)}
            onMouseLeave={() => setInvolvedOpen(false)}
          >
            <button
              type="button"
              aria-expanded={involvedOpen}
              onClick={() => setInvolvedOpen((o) => !o)}
              className="flex items-center gap-1 text-sm font-medium text-[#152238]/80 dark:text-slate-300 hover:text-[#0B1F3A] dark:hover:text-white whitespace-nowrap shrink-0 py-1 focus-visible:outline-2 focus-visible:outline-[#00BCEB] rounded"
            >
              <span>Get Involved</span>
              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            {involvedOpen && (
              <div className="absolute left-0 top-full pt-2 w-52 z-50">
                <div className="bg-white dark:bg-[#0D223D] border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1.5">
                  <Link to="/get-involved" onClick={() => setInvolvedOpen(false)} className="block px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                    Ways to Contribute
                  </Link>
                  <Link to="/volunteer" onClick={() => setInvolvedOpen(false)} className="block px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                    Volunteer Registration
                  </Link>
                  <Link to="/partnerships" onClick={() => setInvolvedOpen(false)} className="block px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                    Partnership Enquiries
                  </Link>
                  <Link to="/contact" onClick={() => setInvolvedOpen(false)} className="block px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                    Contact Us
                  </Link>
                  <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
                  <Link to={dashboardPath} onClick={() => setInvolvedOpen(false)} className="block px-4 py-2 text-sm font-semibold text-[#123F69] dark:text-[#00BCEB] hover:bg-slate-50 dark:hover:bg-slate-800">
                    {user ? 'Open Portal Dashboard' : 'Coordinator / Admin Sign In'}
                  </Link>
                </div>
              </div>
            )}
          </div>
        </nav>

        {/* Zone 3: Theme Toggle + Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-2 focus-visible:outline-[#00BCEB]"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <Link
            to="/donate"
            className="px-4 py-2 rounded-lg bg-[#0B1F3A] dark:bg-[#00BCEB] text-white dark:text-[#071324] text-sm font-semibold hover:bg-[#123F69] dark:hover:bg-[#33ccf2] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00BCEB]"
          >
            {t('donateNow')}
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            className="lg:hidden p-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#071324] px-4 py-4 space-y-2">
          {[
            ['/', 'Home'],
            ['/stories', 'Our Stories'],
            ['/cases', 'People in Need'],
            ['/campaigns', 'Campaigns'],
            ['/impact', 'Impact Centre'],
            ['/about', 'About Us'],
            ['/how-it-works', 'How It Works'],
            ['/get-involved', 'Get Involved'],
            ['/news', 'Community News'],
            ['/contact', 'Contact'],
            [dashboardPath, user ? 'Open Dashboard' : 'Portal Sign In'],
          ].map(([to, label]) => (
            <Link
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className="block py-2.5 px-3 rounded-lg text-sm font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
