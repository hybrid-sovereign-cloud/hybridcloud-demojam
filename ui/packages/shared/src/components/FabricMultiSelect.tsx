import React, { useState } from 'react';
import {
  FormGroup,
  Select,
  SelectList,
  SelectOption,
  MenuToggle,
  Label,
  LabelGroup,
} from '@patternfly/react-core';
import type { MenuToggleElement } from '@patternfly/react-core';

export interface FabricMultiSelectOption {
  value: string;
  label: string;
  ready?: boolean;
  /** Entity not tagged on this fabric — shown greyed with tooltip per §18.4 */
  isDisabled?: boolean;
}

export interface FabricMultiSelectProps {
  id?: string;
  label?: string;
  value: string[];
  onChange: (next: string[]) => void;
  options: FabricMultiSelectOption[];
  isRequired?: boolean;
  placeholder?: string;
}

/**
 * Multi-select dropdown of Ready `HybridFabric` CR names (chip + checkbox PatternFly Select).
 * Writes `PlatformOpenshift.spec.fabric.fabricRefs` when `joinPolicy=ExplicitOnly` —
 * hosted / openstack PlatformOpenshift only (design/fabric.md §18.2).
 */
export function FabricMultiSelect({
  id = 'fabric-multiselect',
  label = 'Fabrics',
  value,
  onChange,
  options,
  isRequired,
  placeholder = 'Select fabrics…',
}: FabricMultiSelectProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const selected = value ?? [];

  const toggle = (toggleRef: React.Ref<MenuToggleElement>) => (
    <MenuToggle
      ref={toggleRef}
      onClick={() => setIsOpen((o) => !o)}
      isExpanded={isOpen}
      style={{ width: '100%' }}
      aria-label={label}
    >
      {selected.length === 0
        ? placeholder
        : selected.length === 1
          ? selected[0]
          : `${selected.length} selected`}
    </MenuToggle>
  );

  const onSelect = (_event: unknown, selection: string | number | undefined) => {
    const v = String(selection ?? '');
    if (!v) return;
    onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);
  };

  return (
    <FormGroup label={label} isRequired={isRequired} fieldId={id}>
      {selected.length > 0 && (
        <LabelGroup numLabels={12} className="pf-v6-u-mb-sm">
          {selected.map((name) => (
            <Label key={name} color="blue" onClose={() => onChange(selected.filter((s) => s !== name))}>
              {name}
            </Label>
          ))}
        </LabelGroup>
      )}
      <Select
        id={id}
        isOpen={isOpen}
        selected={selected}
        onSelect={onSelect}
        onOpenChange={(next) => setIsOpen(next)}
        toggle={toggle}
        shouldFocusToggleOnSelect={false}
      >
        <SelectList>
          {options.length === 0 ? (
            <SelectOption isDisabled value="">
              No Ready fabrics tagged to this Entity
            </SelectOption>
          ) : (
            options.map((o) => (
              <SelectOption
                key={o.value}
                value={o.value}
                hasCheckbox
                isSelected={selected.includes(o.value)}
                isDisabled={o.isDisabled}
                description={
                  o.isDisabled
                    ? 'Entity not tagged on this fabric'
                    : o.ready === false
                      ? 'Not Ready'
                      : undefined
                }
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
