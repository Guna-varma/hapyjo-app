/**
 * i18n – English / Kinyarwanda.
 * Use t(key) for all user-facing strings; keys live in locales/en.ts and locales/rn.ts.
 */

import { en, type EnKeys } from '@/locales/en';
import { rn } from '@/locales/rn';

export type Locale = 'en' | 'rn';

const translations: Record<Locale, Record<string, string>> = {
  en: { ...en },
  rn: { ...rn },
};

export function getTranslation(locale: Locale, key: EnKeys | string): string {
  const dict = translations[locale];
  if (!dict) return translations.en[key as EnKeys] ?? key;
  return dict[key] ?? translations.en[key as EnKeys] ?? key;
}

export function createT(locale: Locale) {
  return (key: EnKeys | string) => getTranslation(locale, key);
}

export { en, rn };
export type { EnKeys };
