import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env';

export type SupportedLocale = 'en' | 'nus' | 'ar' | 'am';

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: 'English',
  nus: 'Nuer (Thok Naath)',
  ar: 'Arabic',
  am: 'Amharic',
};

/**
 * AI-assisted draft translation service.
 * IMPORTANT SAFEGUARD: Machine translations are strictly advisory drafts requiring
 * human editorial verification before publication. Never used for case eligibility or approval.
 */
export async function generateTranslationDraft(input: {
  title: string;
  excerpt: string;
  body: string;
  targetLocale: SupportedLocale;
}): Promise<{
  targetLocale: SupportedLocale;
  requiresHumanReview: true;
  translatedTitle: string;
  translatedExcerpt: string;
  translatedBody: string;
  providerStatus: 'GEMINI_DRAFT' | 'UNCONFIGURED';
}> {
  if (!env.geminiApiKey) {
    return {
      targetLocale: input.targetLocale,
      requiresHumanReview: true,
      translatedTitle: `[${LOCALE_LABELS[input.targetLocale]} Draft Pending Translator] ${input.title}`,
      translatedExcerpt: input.excerpt,
      translatedBody: input.body,
      providerStatus: 'UNCONFIGURED',
    };
  }

  const ai = new GoogleGenAI({ apiKey: env.geminiApiKey });
  const targetLang = LOCALE_LABELS[input.targetLocale];
  const prompt = `Translate the following humanitarian community story faithfully and respectfully into ${targetLang}. Preserve dignified tone and do not add or invent facts. Return strict JSON with keys: translatedTitle, translatedExcerpt, translatedBody.\n\nTitle: ${input.title}\nExcerpt: ${input.excerpt}\nBody:\n${input.body}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });

  const parsed = JSON.parse(response.text || '{}');
  return {
    targetLocale: input.targetLocale,
    requiresHumanReview: true,
    translatedTitle: parsed.translatedTitle || input.title,
    translatedExcerpt: parsed.translatedExcerpt || input.excerpt,
    translatedBody: parsed.translatedBody || input.body,
    providerStatus: 'GEMINI_DRAFT',
  };
}
