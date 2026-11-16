import React from 'react';
import { Link } from 'react-router-dom';
import { useLocale, type AppLocale } from '../contexts/LocaleContext';

interface PublicFooterProps {
  settings?: Record<string, string>;
}

export function PublicFooter({ settings = {} }: PublicFooterProps) {
  const { locale, setLocale } = useLocale();

  return (
    <footer className="bg-[#0B1F3A] dark:bg-[#050E1B] text-slate-200 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          <div>
            <p className="font-editorial text-2xl font-semibold text-white">HumanityBridge</p>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              {settings.org_tagline || 'Together for a Dignified and Hopeful Tomorrow.'}
            </p>
            <p className="mt-4 text-xs text-slate-400">
              {settings.office_region || 'Configurable Regional Coordination Desk'}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {settings.contact_email || 'contact@humanitybridge.example'}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Humanitarian Platform</h3>
            <ul className="space-y-2 text-sm text-slate-300">
              <li><Link to="/stories" className="hover:text-[#00BCEB] transition-colors">Our Stories</Link></li>
              <li><Link to="/cases" className="hover:text-[#00BCEB] transition-colors">People in Need</Link></li>
              <li><Link to="/campaigns" className="hover:text-[#00BCEB] transition-colors">Active Campaigns</Link></li>
              <li><Link to="/impact" className="hover:text-[#00BCEB] transition-colors">Impact Centre</Link></li>
              <li><Link to="/news" className="hover:text-[#00BCEB] transition-colors">Community News</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Organisation & Participation</h3>
            <ul className="space-y-2 text-sm text-slate-300">
              <li><Link to="/about" className="hover:text-[#00BCEB] transition-colors">About Us</Link></li>
              <li><Link to="/mission" className="hover:text-[#00BCEB] transition-colors">Mission & Vision</Link></li>
              <li><Link to="/how-it-works" className="hover:text-[#00BCEB] transition-colors">How It Works</Link></li>
              <li><Link to="/volunteer" className="hover:text-[#00BCEB] transition-colors">Volunteer Registration</Link></li>
              <li><Link to="/partnerships" className="hover:text-[#00BCEB] transition-colors">Partnership Enquiries</Link></li>
              <li><Link to="/contact" className="hover:text-[#00BCEB] transition-colors">Contact Us</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Governance & Safeguarding</h3>
            <ul className="space-y-2 text-sm text-slate-300">
              <li><Link to="/policies/privacy" className="hover:text-[#00BCEB] transition-colors">Privacy Policy</Link></li>
              <li><Link to="/policies/terms" className="hover:text-[#00BCEB] transition-colors">Terms & Conditions</Link></li>
              <li><Link to="/policies/safeguarding" className="hover:text-[#00BCEB] transition-colors">Safeguarding Policy</Link></li>
              <li><Link to="/policies/transparency" className="hover:text-[#00BCEB] transition-colors">Donation Transparency</Link></li>
              <li><Link to="/faq" className="hover:text-[#00BCEB] transition-colors">Frequently Asked Questions</Link></li>
            </ul>

            <div className="mt-5">
              <label htmlFor="footer-locale" className="block text-xs text-slate-400 mb-1.5">
                Language / Region
              </label>
              <select
                id="footer-locale"
                value={locale}
                onChange={(e) => setLocale(e.target.value as AppLocale)}
                className="w-full bg-[#123F69]/60 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#00BCEB]"
              >
                <option value="en">English (Primary)</option>
                <option value="nus">Thok Naath / Nuer (Framework)</option>
                <option value="ar">العربية / Arabic (RTL)</option>
                <option value="am">አማርኛ / Amharic</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-400">
          <p>
            © {new Date().getUTCFullYear()} HumanityBridge. {settings.registration_notice || 'Configurable legal registration notice.'}
          </p>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hover:text-white transition-colors">Staff & Coordinator Portal</Link>
            <span aria-hidden="true">·</span>
            <Link to="/policies/safeguarding" className="hover:text-white transition-colors">Report Safeguarding Concern</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
