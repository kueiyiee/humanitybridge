import React from 'react';
import { Link } from 'react-router-dom';
import { useLocale, type AppLocale } from '../contexts/LocaleContext';
import { BrandLogo } from './BrandLogo';

interface PublicFooterProps {
  settings?: Record<string, string>;
}

const linkClass = 'text-sm text-[#d5dfd6] transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d7c08c]';

export function PublicFooter({ settings = {} }: PublicFooterProps) {
  const { locale, setLocale } = useLocale();

  return (
    <footer className="bg-[#193d2b] text-[#eaf0e9]">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-14 lg:px-10">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_0.8fr_1fr_1fr] lg:gap-12">
          <div>
            <Link to="/" aria-label="HumanityBridge home" className="inline-flex rounded-sm focus-visible:outline">
              <BrandLogo className="h-[48px] w-[144px] drop-shadow-[0_0_2px_rgba(255,255,255,0.9)]" />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-6 text-[#d5dfd6]">
              Connecting community voices with reviewed humanitarian needs and accountable support.
            </p>
            <div className="mt-5 space-y-1.5 text-xs leading-5 text-[#bdcbbf]">
              {settings.office_region && <p>{settings.office_region}</p>}
              {settings.contact_email ? (
                <a className="block underline decoration-white/30 underline-offset-2 hover:text-white" href={`mailto:${settings.contact_email}`}>
                  {settings.contact_email}
                </a>
              ) : (
                <p>Regional contact information is being configured.</p>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-white">Explore</h2>
            <ul className="mt-4 space-y-3">
              <li><Link to="/stories" className={linkClass}>Stories</Link></li>
              <li><Link to="/cases" className={linkClass}>People in Need</Link></li>
              <li><Link to="/campaigns" className={linkClass}>Campaigns</Link></li>
              <li><Link to="/impact" className={linkClass}>Impact Centre</Link></li>
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-white">Organisation</h2>
            <ul className="mt-4 space-y-3">
              <li><Link to="/about" className={linkClass}>About Us</Link></li>
              <li><Link to="/mission" className={linkClass}>Mission and Vision</Link></li>
              <li><Link to="/volunteer" className={linkClass}>Volunteer</Link></li>
              <li><Link to="/partnerships" className={linkClass}>Partnerships</Link></li>
              <li><Link to="/contact" className={linkClass}>Contact</Link></li>
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-white">Governance</h2>
            <ul className="mt-4 space-y-3">
              <li><Link to="/policies/privacy" className={linkClass}>Privacy Policy</Link></li>
              <li><Link to="/policies/terms" className={linkClass}>Terms and Conditions</Link></li>
              <li><Link to="/policies/safeguarding" className={linkClass}>Safeguarding Policy</Link></li>
              <li><Link to="/policies/transparency" className={linkClass}>Donation Transparency</Link></li>
              <li><Link to="/faq" className={linkClass}>FAQs</Link></li>
            </ul>
            <div className="mt-6">
              <label htmlFor="footer-locale" className="mb-2 block text-xs text-[#bdcbbf]">
                Language
              </label>
              <select
                id="footer-locale"
                value={locale}
                onChange={(event) => setLocale(event.target.value as AppLocale)}
                className="min-h-10 w-full rounded-lg border border-white/20 bg-[#244b35] px-3 text-xs text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#d7c08c]"
              >
                <option value="en">English</option>
                <option value="nus">Thok Naath / Nuer</option>
                <option value="ar">العربية / Arabic</option>
                <option value="am">አማርኛ / Amharic</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-white/15 pt-5 text-xs text-[#bdcbbf] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getUTCFullYear()} HumanityBridge.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/policies/safeguarding" className={linkClass}>Report a Safeguarding Concern</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
