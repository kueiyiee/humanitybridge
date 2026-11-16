import React, { createContext, useContext, useState } from 'react';

export type AppLocale = 'en' | 'nus' | 'ar' | 'am';

const DICTIONARY: Record<AppLocale, Record<string, string>> = {
  en: {
    heroHeadline: 'Every Story Matters. Every Life Deserves Hope.',
    heroSub:
      'HumanityBridge connects vulnerable communities with compassionate individuals and meaningful assistance. Together, we can turn stories into action and build a more dignified future.',
    ctaStories: 'Explore Our Stories',
    ctaDifference: 'Make a Difference',
    donateNow: 'Donate Now',
  },
  nus: {
    heroHeadline: 'Every Story Matters. Every Life Deserves Hope.',
    heroSub:
      'HumanityBridge connects vulnerable communities with compassionate individuals and meaningful assistance (Thok Naath locale preview — editorial translations underway).',
    ctaStories: 'Explore Our Stories',
    ctaDifference: 'Make a Difference',
    donateNow: 'Donate Now',
  },
  ar: {
    heroHeadline: 'كل قصة مهمة. كل حياة تستحق الأمل.',
    heroSub:
      'تربط HumanityBridge المجتمعات المحتاجة بالأفراد المتعاطفين والمساعدات الموثوقة بكرامة وشفافية.',
    ctaStories: 'استكشف قصصنا',
    ctaDifference: 'اصنع فرقاً',
    donateNow: 'تبرع الآن',
  },
  am: {
    heroHeadline: 'እያንዳንዱ ታሪክ ዋጋ አለው። እያንዳንዱ ሕይወት ተስፋ ይገባዋል።',
    heroSub:
      'HumanityBridge ተጋላጭ ማህበረሰቦችን ከርኅሩኅ ሰዎች እና ከተረጋገጠ ሰብዓዊ ድጋፍ ጋር በክብር እና በግልጽነት ያገናኛል።',
    ctaStories: 'ታሪኮቻችንን ይመልከቱ',
    ctaDifference: 'ለውጥ ያምጡ',
    donateNow: 'አሁን ይለግሱ',
  },
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
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
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
