import React, { useState } from 'react';
import { FormGroup, Select, SelectList, SelectOption, MenuToggle } from '@patternfly/react-core';
import type { MenuToggleElement } from '@patternfly/react-core';
import type { K8sResource } from '../types';

export interface PlatformOpenshiftSelectOption {
  value: string;
  label: string;
  ready?: boolean;
}

export interface PlatformOpenshiftSelectProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (next: string) => void;
  options: PlatformOpenshiftSelectOption[];
  isRequired?: boolean;
  placeholder?: string;
}

/**
 * Filter a `PlatformOpenshift` CR list down to fabric-capable clusters — `hosted` and
 * `openstack` types only. AWS PlatformOpenshift has no fabric attachment (§15.0) and MUST
 * never be offered here or in any gateway / EVPN backend dropdown.
 */
export function filterFabricCapablePlatformOpenshifts<
  T extends K8sResource<{ type?: string }>,
>(items: T[] | undefined | null): T[] {
  return (items ?? []).filter((item) => {
    const type = item?.spec?.type;
    return type === 'hosted' || type === 'openstack';
  });
}

/** Build PlatformOpenshiftSelect options from a (pre-filtered, non-AWS) PlatformOpenshift list. */
export function platformOpenshiftSelectOptions<
  T extends K8sResource<{ type?: string }, { ready?: boolean }>,
>(items: T[] | undefined | null): PlatformOpenshiftSelectOption[] {
  return filterFabricCapablePlatformOpenshifts(items).map((item) => ({
    value: item.metadata.name,
    label: item.metadata.namespace ? `${item.metadata.name} (${item.metadata.namespace})` : item.metadata.name,
    ready: item.status?.ready,
  }));
}

/**
 * Single-select dropdown of Ready `PlatformOpenshift` CRs — **hosted / openstack only, never aws**.
 * Writes `CloudGateway.spec.platformOpenshiftRef` (design/fabric.md §18.2 / §18.5).
 */
export function PlatformOpenshiftSelect({
  id = 'platformopenshift-select',
  label = 'PlatformOpenshift backend',
  value,
  onChange,
  options,
  isRequired,
  placeholder = 'Select PlatformOpenshift…',
}: PlatformOpenshiftSelectProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((o) => o.value === value);

  const toggle = (toggleRef: React.Ref<MenuToggleElement>) => (
    <MenuToggle
      ref={toggleRef}
      onClick={() => setIsOpen((o) => !o)}
      isExpanded={isOpen}
      style={{ width: '100%' }}
      aria-label={label}
    >
      {selectedOption ? selectedOption.label : placeholder}
    </MenuToggle>
  );

  const onSelect = (_event: unknown, selection: string | number | undefined) => {
    onChange(String(selection ?? ''));
    setIsOpen(false);
  };

  return (
    <FormGroup label={label} isRequired={isRequired} fieldId={id}>
      <Select
        id={id}
        isOpen={isOpen}
        selected={value}
        onSelect={onSelect}
        onOpenChange={(next) => setIsOpen(next)}
        toggle={toggle}
        shouldFocusToggleOnSelect={false}
      >
        <SelectList>
          {options.length === 0 ? (
            <SelectOption isDisabled value="">
              No hosted/openstack PlatformOpenshift clusters available
            </SelectOption>
          ) : (
            options.map((o) => (
              <SelectOption
                key={o.value}
                value={o.value}
                isSelected={o.value === value}
                description={o.ready === false ? 'Not Ready' : undefined}
              >
                {o.label}
              </SelectOption>
            ))
          )}
        </SelectList>
      </Select>
    </FormGroup>
  );
}
