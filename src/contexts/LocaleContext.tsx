import React, { createContext, useContext, useEffect, useState } from 'react';

export type AppLocale = 'en' | 'nus';

const DICTIONARY: Record<AppLocale, Record<string, string>> = {
  en: {
    heroHeadline: 'Every Story Matters. Every Life Deserves Dignity.',
    heroSub:
      'HumanityBridge helps communities document verified needs and connect with responsible, accountable support.',
    ctaStories: 'Explore our stories',
    ctaDifference: 'Support a community',
    donateNow: 'Donate Now',
  },
  // Thok Nath (Nuer) is selectable and persists as a locale. Public copy remains
  // on the English fallback until translations have been reviewed by fluent speakers.
  nus: {},
};

interface LocaleContextValue {
  locale: AppLocale;
  setLocale: (loc: AppLocale) => void;
  t: (key: string) => string;
  dir: 'ltr' | 'rtl';
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

function getInitialLocale(): AppLocale {
  if (typeof window === 'undefined') return 'en';
  try {
    return window.localStorage.getItem('hb-locale') === 'nus' ? 'nus' : 'en';
  } catch {
    return 'en';
  }
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(getInitialLocale);
  const dir = 'ltr';

  const setLocale = (nextLocale: AppLocale) => {
    setLocaleState(nextLocale);
    try {
      window.localStorage.setItem('hb-locale', nextLocale);
    } catch {
      // Locale selection still works for the current session if storage is unavailable.
    }
  };

  useEffect(() => {
    document.documentElement.lang = locale === 'nus' ? 'nus' : 'en-GB';
    document.documentElement.dir = dir;
  }, [locale, dir]);

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
