import React, { useState } from 'react';
import { FormGroup, Select, SelectList, SelectOption, MenuToggle } from '@patternfly/react-core';
import type { MenuToggleElement } from '@patternfly/react-core';
import type { JoinPolicy } from '../types';

const JOIN_POLICY_OPTIONS: { value: JoinPolicy; label: string; description: string }[] = [
  {
    value: 'AutoWhenFabricReady',
    label: 'Auto when fabric ready (default)',
    description: 'Discover fabrics tagged to this Entity; join when fabric is Ready',
  },
  {
    value: 'ExplicitOnly',
    label: 'Explicit only',
    description: 'Join only the fabrics selected below (must be tagged to this Entity)',
  },
  {
    value: 'None',
    label: 'None — standalone install',
    description: 'Never auto-join; no EVPN/CUDN until attached later',
  },
];

export interface JoinPolicySelectProps {
  id?: string;
  label?: string;
  value: JoinPolicy;
  onChange: (next: JoinPolicy) => void;
  isRequired?: boolean;
}

/**
 * Single-select enum dropdown for `PlatformOpenshift.spec.fabric.joinPolicy`.
 * Hidden entirely when PlatformOpenshift `type: aws` — AWS has no fabric attach (§15.0 / §18.2).
 */
export function JoinPolicySelect({
  id = 'join-policy-select',
  label = 'Join policy',
  value,
  onChange,
  isRequired,
}: JoinPolicySelectProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = JOIN_POLICY_OPTIONS.find((o) => o.value === value);

  const toggle = (toggleRef: React.Ref<MenuToggleElement>) => (
    <MenuToggle
      ref={toggleRef}
      onClick={() => setIsOpen((o) => !o)}
      isExpanded={isOpen}
      style={{ width: '100%' }}
      aria-label={label}
    >
      {selectedOption ? selectedOption.label : 'Select join policy…'}
    </MenuToggle>
  );

  const onSelect = (_event: unknown, selection: string | number | undefined) => {
    onChange(String(selection ?? 'AutoWhenFabricReady') as JoinPolicy);
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
          {JOIN_POLICY_OPTIONS.map((o) => (
            <SelectOption key={o.value} value={o.value} isSelected={o.value === value} description={o.description}>
              {o.label}
            </SelectOption>
          ))}
        </SelectList>
      </Select>
    </FormGroup>
  );
}
