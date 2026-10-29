// Tiny typed i18n: t('tonight.deal'), t('tonight.greeting', { name }),
// tn('recipes.count', 3) for plurals (`_one` / `_other` keys).
// Adding a language = one more dictionary typed as Dictionary.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { en, type Dictionary } from './en.ts';
import { fr } from './fr.ts';
import { APP_NAME } from '../brand.ts';

export type Locale = 'en' | 'fr';
export const LOCALES: Locale[] = ['en', 'fr'];
/** Each language in its own name, for the language pickers. */
export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', fr: 'Français' };
const DICTIONARIES: Record<Locale, Dictionary> = { en, fr };
const STORAGE_KEY = 'dineamite.locale';

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : T[K] extends readonly unknown[]
      ? never
      : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<typeof en>;
type PluralBase<K extends string> = K extends `${infer B}_one` ? B : never;
export type PluralKey = PluralBase<MessageKey>;

type Vars = Record<string, string | number>;

function lookup(dict: Dictionary, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dict);
}

function interpolate(s: string, vars?: Vars): string {
  const all: Vars = { app: APP_NAME, ...vars };
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in all ? String(all[k]) : m));
}

export function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'fr') return saved;
  } catch {
    // storage unavailable
  }
  // French first: English only for people who chose it.
  return 'fr';
}

interface I18n {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: MessageKey, vars?: Vars) => string;
  tn: (key: PluralKey, count: number, vars?: Vars) => string;
  list: (key: 'plan.days' | 'plan.daysLong') => readonly string[];
  formatTime: (d: Date | string) => string;
  formatRelative: (d: Date | string) => string;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    document.documentElement.lang = l;
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // storage unavailable
    }
  }, []);

  const value = useMemo<I18n>(() => {
    const dict = DICTIONARIES[locale];
    const plural = new Intl.PluralRules(locale);
    const t = (key: MessageKey, vars?: Vars) => {
      const s = lookup(dict, key) ?? lookup(en, key);
      return typeof s === 'string' ? interpolate(s, vars) : key;
    };
    const tn = (key: PluralKey, count: number, vars?: Vars) => {
      const form = plural.select(count) === 'one' ? 'one' : 'other';
      return t(`${key}_${form}` as MessageKey, { count, ...vars });
    };
    const list = (key: 'plan.days' | 'plan.daysLong') => lookup(dict, key) as readonly string[];
    const timeFmt = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });
    const rel = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const formatTime = (d: Date | string) => timeFmt.format(new Date(d));
    const formatRelative = (d: Date | string) => {
      const hours = Math.round((new Date(d).getTime() - Date.now()) / 3_600_000);
      return Math.abs(hours) >= 24 ? rel.format(Math.round(hours / 24), 'day') : rel.format(hours, 'hour');
    };
    return { locale, setLocale, t, tn, list, formatTime, formatRelative };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n outside I18nProvider');
  return ctx;
}
