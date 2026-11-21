import React, { createContext, useContext, useState } from 'react';

export type AppLocale = 'en' | 'nus';

const DICTIONARY: Record<AppLocale, Record<string, string>> = {
  en: {
    heroHeadline: 'Every Story Matters. Every Life Deserves Hope.',
    heroSub:
      'HumanityBridge connects vulnerable communities with compassionate individuals and meaningful assistance. Together, we can turn stories into action and build a more dignified future.',
    ctaStories: 'Explore Our Stories',
    ctaDifference: 'Make a Difference',
    donateNow: 'Donate Now',
  },
  // Nuer (Thok Nath) uses the Google Translate language code `nus`.
  // Keep English fallback until each public-facing string has been reviewed by a fluent speaker.
  nus: {},

};

interface LocaleContextValue {
  locale: AppLocale;
  setLocale: (loc: AppLocale) => void;
  t: (key: string) => string;
  dir: 'ltr' | 'rtl';
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<AppLocale>('en');
  const dir = 'ltr';
  const t = (key: string) => DICTIONARY[locale]?.[key] || DICTIONARY.en[key] || key;

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t, dir }}>
      <div dir={dir}>{children}</div>
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}
