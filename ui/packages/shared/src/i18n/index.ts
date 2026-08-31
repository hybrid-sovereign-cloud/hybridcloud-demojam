import i18n from 'i18next';
import {
  initReactI18next,
  useTranslation as useI18nextTranslation,
  UseTranslationOptions,
} from 'react-i18next';
import en from './locales/en.json';
import fr from './locales/fr.json';

export const LOCALE_STORAGE_KEY = 'sovereign-ui-locale';
export type AppLocale = 'en' | 'fr';

export function getStoredLocale(): AppLocale {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return stored === 'fr' ? 'fr' : 'en';
}

export function setStoredLocale(locale: AppLocale): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  document.documentElement.lang = locale;
}

/** True when rendered inside an OpenShift Console dynamic plugin route. */
export function isEmbeddedConsolePlugin(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/hybridsovereign');
}

const GLOBAL_I18N_KEY = '__HYBRIDSOVEREIGN_I18N__';

type SovereignWindow = Window & {
  [GLOBAL_I18N_KEY]?: typeof i18n;
};

function getGlobalI18n(): typeof i18n | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as SovereignWindow)[GLOBAL_I18N_KEY];
}

function setGlobalI18n(instance: typeof i18n): void {
  if (typeof window === 'undefined') return;
  (window as SovereignWindow)[GLOBAL_I18N_KEY] = instance;
}

/** Idempotent i18n bootstrap — safe to call from dashboards and console plugins. */
export function initI18n(locale?: AppLocale): typeof i18n {
  const lng = locale ?? getStoredLocale();
  const existing = getGlobalI18n();
  if (existing) {
    if (existing.language !== lng) {
      void existing.changeLanguage(lng);
    }
    return existing;
  }

  i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
    },
    lng,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
    react: {
      useSuspense: false,
    },
  });
  setGlobalI18n(i18n);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng;
  }
  return i18n;
}

/** Ensures translations are loaded before returning the react-i18next hook. */
export function useTranslation(ns?: string, options?: UseTranslationOptions<string>) {
  const i18nInstance = initI18n();
  return useI18nextTranslation(ns, { ...options, i18n: i18nInstance });
}

if (typeof window !== 'undefined') {
  initI18n();
}

export { i18n };
export { SovereignI18nProvider } from './SovereignI18nProvider';
export type { SovereignI18nProviderProps } from './SovereignI18nProvider';
export { LanguageToggle } from './LanguageToggle';
export type { LanguageToggleProps } from './LanguageToggle';
