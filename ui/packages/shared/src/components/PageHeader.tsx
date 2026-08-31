import React from 'react';
import { Title, Breadcrumb, BreadcrumbItem } from '@patternfly/react-core';
import { LanguageToggle, isEmbeddedConsolePlugin } from '../i18n';

export interface PageHeaderCrumb {
  label: string;
  to?: string;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: PageHeaderCrumb[];
  actions?: React.ReactNode;
  /** Show EN/FR toggle in the header actions (default: hidden in OCP console plugin). */
  showLanguageToggle?: boolean;
}

/** OpenShift ListPage-style title row: breadcrumbs, title left, actions right */
export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
  showLanguageToggle,
}: PageHeaderProps): React.ReactElement {
  const showLang = showLanguageToggle ?? !isEmbeddedConsolePlugin();

  return (
    <div className="sc-page-header">
      <div className="sc-page-header__titles">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumb className="sc-breadcrumbs">
            {breadcrumbs.map((c, i) => (
              <BreadcrumbItem
                key={`${c.label}-${i}`}
                to={c.to}
                isActive={i === breadcrumbs.length - 1}
              >
                {c.label}
              </BreadcrumbItem>
            ))}
          </Breadcrumb>
        )}
        <Title headingLevel="h1" size="2xl">
          {title}
        </Title>
        {subtitle && <div className="sc-page-header__subtitle">{subtitle}</div>}
      </div>
      {(actions || showLang) && (
        <div className="sc-page-header__actions">
          {actions}
          {showLang ? <LanguageToggle isCompact /> : null}
        </div>
      )}
    </div>
  );
}
