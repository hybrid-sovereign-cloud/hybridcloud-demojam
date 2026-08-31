import React from 'react';
import { ToggleGroup, ToggleGroupItem } from '@patternfly/react-core';
import { useTranslation } from './index';
import { AppLocale, setStoredLocale } from './index';

export interface LanguageToggleProps {
  /** Compact masthead styling */
  isCompact?: boolean;
  className?: string;
}

/** EN / FR language toggle — defaults to English; persists choice in localStorage. */
export function LanguageToggle({ isCompact, className }: LanguageToggleProps): React.ReactElement {
  const { t, i18n } = useTranslation();
  const locale: AppLocale = i18n.language?.startsWith('fr') ? 'fr' : 'en';

  const setLocale = (next: AppLocale) => {
    if (next === locale) return;
    setStoredLocale(next);
    void i18n.changeLanguage(next);
  };

  return (
    <ToggleGroup
      aria-label={t('lang.switchTo')}
      className={className ?? (isCompact ? 'sc-lang-toggle sc-lang-toggle--compact' : 'sc-lang-toggle')}
    >
      <ToggleGroupItem
        text={t('lang.en')}
        buttonId="locale-en"
        isSelected={locale === 'en'}
        onChange={() => setLocale('en')}
        aria-label="English"
      />
      <ToggleGroupItem
        text={t('lang.fr')}
        buttonId="locale-fr"
        isSelected={locale === 'fr'}
        onChange={() => setLocale('fr')}
        aria-label="Français"
      />
    </ToggleGroup>
  );
}
