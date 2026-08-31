import React from 'react';
import {
  Button,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  SearchInput,
  ToggleGroup,
  ToggleGroupItem,
} from '@patternfly/react-core';
import { useTranslation } from '../i18n';

export type StatusFilter = 'all' | 'ready' | 'failed' | 'pending' | 'reconciling';

export interface FilterToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  /** Manual refresh — always shown; status tabs never trigger API calls */
  onRefresh: () => void;
  searchPlaceholder?: string;
}

const FILTERS: StatusFilter[] = ['all', 'ready', 'failed', 'pending', 'reconciling'];

export function FilterToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onRefresh,
  searchPlaceholder,
}: FilterToolbarProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <Toolbar className="sc-filter-bar" id="sc-filter-toolbar">
      <ToolbarContent>
        <ToolbarItem>
          <SearchInput
            aria-label={t('common.filterResources')}
            placeholder={searchPlaceholder ?? t('common.filterByName')}
            value={search}
            onChange={(_e, v) => onSearchChange(v)}
            onClear={() => onSearchChange('')}
          />
        </ToolbarItem>
        <ToolbarItem>
          <ToggleGroup aria-label={t('common.statusFilter')}>
            {FILTERS.map((f) => (
              <ToggleGroupItem
                key={f}
                text={t(`status.${f}`)}
                buttonId={`status-${f}`}
                isSelected={statusFilter === f}
                onChange={() => onStatusFilterChange(f)}
              />
            ))}
          </ToggleGroup>
        </ToolbarItem>
        <ToolbarItem align={{ default: 'alignRight' }}>
          <Button variant="secondary" onClick={onRefresh}>
            {t('common.refresh')}
          </Button>
        </ToolbarItem>
      </ToolbarContent>
    </Toolbar>
  );
}
