import React, { useState } from 'react';
import { FormGroup, Select, SelectList, SelectOption, MenuToggle } from '@patternfly/react-core';
import type { MenuToggleElement } from '@patternfly/react-core';
import type { K8sResource } from '../types';
import { filterFabricCapablePlatformOpenshifts } from './PlatformOpenshiftSelect';

export type BackendKind = 'CloudOSO' | 'CloudVirt' | 'PlatformOpenshift';

export interface BackendSelectOption {
  kind: BackendKind;
  name: string;
  label: string;
  ready?: boolean;
}

export interface BackendSelectValue {
  kind: string;
  name: string;
}

export interface BackendSelectProps {
  id?: string;
  label?: string;
  value: BackendSelectValue | null;
  onChange: (backend: BackendSelectValue) => void;
  options: BackendSelectOption[];
  isRequired?: boolean;
  placeholder?: string;
}

const encode = (o: { kind: string; name: string }): string => `${o.kind}::${o.name}`;
const decode = (v: string): BackendSelectValue => {
  const [kind, name] = v.split('::');
  return { kind: kind ?? '', name: name ?? '' };
};

/**
 * Build BackendSelect options from CloudOSO / CloudVirt / PlatformOpenshift lists.
 * **Never** includes AWS PlatformOpenshift — fabric EVPN attach is unsupported for `type: aws`
 * (design/fabric.md §15.0 / §18.2). PlatformOpenshift options are marked `ready` only when
 * `status.fabricMembership` reports at least one `Joined` fabric.
 */
export function buildBackendOptions(sources: {
  cloudosos?: K8sResource<object, { ready?: boolean }>[] | null;
  cloudvirts?: K8sResource<object, { ready?: boolean }>[] | null;
  platforms?: K8sResource<{ type?: string }, { ready?: boolean; fabricMembership?: { phase?: string }[] }>[] | null;
}): BackendSelectOption[] {
  const cloudoso = (sources.cloudosos ?? []).map((c) => ({
    kind: 'CloudOSO' as const,
    name: c.metadata.name,
    label: c.metadata.name,
    ready: c.status?.ready,
  }));
  const cloudvirt = (sources.cloudvirts ?? []).map((c) => ({
    kind: 'CloudVirt' as const,
    name: c.metadata.name,
    label: c.metadata.name,
    ready: c.status?.ready,
  }));
  const platforms = filterFabricCapablePlatformOpenshifts(sources.platforms ?? []).map((p) => ({
    kind: 'PlatformOpenshift' as const,
    name: p.metadata.name,
    label: p.metadata.namespace ? `${p.metadata.name} (${p.metadata.namespace})` : p.metadata.name,
    ready: (p.status?.fabricMembership ?? []).some((m) => m.phase === 'Joined'),
  }));
  return [...cloudoso, ...cloudvirt, ...platforms];
}

/**
 * Single-select "backend" dropdown for `NetworkPlacement.spec.backend` — CloudOSO, CloudVirt,
 * PlatformOpenshift (hosted/openstack, Joined) only. Writes `{ kind, name }` — never a free-text
 * backend name, never AWS PlatformOpenshift for fabric EVPN (design/fabric.md §18.2 / §18.6).
 */
export function BackendSelect({
  id = 'backend-select',
  label = 'Backend',
  value,
  onChange,
  options,
  isRequired,
  placeholder = 'Select backend…',
}: BackendSelectProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const selectedValue = value ? encode(value) : '';
  const selectedOption = options.find((o) => encode(o) === selectedValue);

  const toggle = (toggleRef: React.Ref<MenuToggleElement>) => (
    <MenuToggle
      ref={toggleRef}
      onClick={() => setIsOpen((o) => !o)}
      isExpanded={isOpen}
      style={{ width: '100%' }}
      aria-label={label}
    >
      {selectedOption ? `${selectedOption.kind} · ${selectedOption.label}` : placeholder}
    </MenuToggle>
  );

  const onSelect = (_event: unknown, selection: string | number | undefined) => {
    const v = String(selection ?? '');
    if (!v) return;
    onChange(decode(v));
    setIsOpen(false);
  };

  return (
    <FormGroup label={label} isRequired={isRequired} fieldId={id}>
      <Select
        id={id}
        isOpen={isOpen}
        selected={selectedValue}
        onSelect={onSelect}
        onOpenChange={(next) => setIsOpen(next)}
        toggle={toggle}
        shouldFocusToggleOnSelect={false}
      >
        <SelectList>
          {options.length === 0 ? (
            <SelectOption isDisabled value="">
              No Joined backends available
            </SelectOption>
          ) : (
            options.map((o) => (
              <SelectOption
                key={encode(o)}
                value={encode(o)}
                isSelected={encode(o) === selectedValue}
                description={o.ready === false ? 'Not Ready / not fabric-joined' : undefined}
              >
                {o.kind} · {o.label}
              </SelectOption>
            ))
          )}
        </SelectList>
      </Select>
    </FormGroup>
  );
}
