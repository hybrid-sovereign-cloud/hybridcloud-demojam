import React from 'react';
import { Button, FormSelect, FormSelectOption, Title } from '@patternfly/react-core';
import { TopologyIcon } from '@patternfly/react-icons';
import { useTranslation } from '../i18n';
import { K8sResource } from '../types';

export interface NamespaceContextBarProps {
  namespace: string;
  entityName?: string;
  billingId?: string;
  resourceCount?: number;
  healthyPercent?: number;
  onTopologyClick?: () => void;
  actions?: React.ReactNode;
  /** Available entities for switching */
  entities?: K8sResource[];
  onSelectEntity?: (entityName: string) => void;
}

/** Tenant namespace context strip — entity dropdown switcher (DESIGN_UI_Existing §5.1) */
export function NamespaceContextBar({
  namespace,
  entityName,
  billingId,
  resourceCount,
  healthyPercent,
  onTopologyClick,
  actions,
  entities = [],
  onSelectEntity,
}: NamespaceContextBarProps): React.ReactElement {
  const { t } = useTranslation();
  const displayEntity = entityName ?? namespace.replace(/^entity-/, '');
  const currentSlug = namespace.replace(/^entity-/, '');
  const options =
    entities.length > 0
      ? entities
      : currentSlug
        ? [{ metadata: { name: currentSlug } } as K8sResource]
        : [];

  return (
    <div className="sc-ns-bar" aria-label={t('common.entityNamespace')}>
      <div className="sc-ns-bar__main">
        <div className="sc-ns-bar__title-row">
          <label htmlFor="sc-entity-select" className="sc-ns-bar__label">
            {t('common.entity')}
          </label>
          {onSelectEntity ? (
            <FormSelect
              id="sc-entity-select"
              className="sc-entity-select"
              value={currentSlug || displayEntity}
              onChange={(_e, value) => onSelectEntity(value)}
              aria-label={t('common.switchEntity')}
            >
              {options.map((ent) => (
                <FormSelectOption
                  key={ent.metadata.name}
                  value={ent.metadata.name}
                  label={ent.metadata.name}
                />
              ))}
            </FormSelect>
          ) : (
            <strong className="sc-ns-bar__entity">{displayEntity}</strong>
          )}
          <Title headingLevel="h2" size="md" className="sc-ns-bar__title pf-v5-u-screen-reader">
            {t('common.entityNamespace')} · {displayEntity}
          </Title>
        </div>
        <div className="sc-ns-bar__meta">
          <span>
            {t('common.namespace')} <strong>{namespace}</strong>
          </span>
          {billingId && (
            <span>
              {t('common.billing')}: <strong>{billingId}</strong>
            </span>
          )}
          {typeof resourceCount === 'number' && (
            <span>
              <strong>{resourceCount}</strong> {t('common.resources').toLowerCase()}
            </span>
          )}
          {typeof healthyPercent === 'number' && (
            <span>
              <strong>{healthyPercent}%</strong> {t('common.healthy').toLowerCase()}
            </span>
          )}
        </div>
      </div>
      <div className="sc-ns-bar__actions">
        {onTopologyClick && (
          <Button variant="secondary" size="sm" icon={<TopologyIcon />} onClick={onTopologyClick}>
            {t('common.topology')}
          </Button>
        )}
        {actions}
      </div>
    </div>
  );
}
