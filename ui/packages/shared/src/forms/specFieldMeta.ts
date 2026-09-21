import { HybridSovereignKind } from '../types';

export type SpecFieldWidget =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'stringList'
  | 'cidrList'
  | 'select'
  | 'json';

export interface SpecFieldMeta {
  /** Dot path under spec, e.g. features.istio or backend.name */
  path: string;
  labelKey: string;
  widget: SpecFieldWidget;
  immutable?: boolean;
  options?: Array<{ value: string; labelKey: string }>;
  helpKey?: string;
}

export interface KindSpecMeta {
  fields: SpecFieldMeta[];
}

const tunnelOptions = [
  { value: 'wireguard', labelKey: 'fields.tunnelWireguard' },
  { value: 'ipsec', labelKey: 'fields.tunnelIpsec' },
  { value: 'macsec', labelKey: 'fields.tunnelMacsec' },
  { value: 'none', labelKey: 'fields.tunnelNone' },
];

/** Editable / immutable field registry for tenancy + admin detail editors */
export const KIND_SPEC_META: Partial<Record<HybridSovereignKind, KindSpecMeta>> = {
  Entity: {
    fields: [
      { path: 'description', labelKey: 'fields.description', widget: 'textarea' },
      { path: 'billingID', labelKey: 'fields.billingID', widget: 'text', immutable: true },
      { path: 'websiteLink', labelKey: 'fields.websiteLink', widget: 'text' },
    ],
  },
  Team: {
    fields: [
      { path: 'features.istio', labelKey: 'fields.istio', widget: 'boolean' },
      { path: 'features.argo', labelKey: 'fields.argo', widget: 'boolean' },
    ],
  },
  Project: {
    fields: [
      { path: 'displayName', labelKey: 'fields.displayName', widget: 'text' },
      { path: 'description', labelKey: 'fields.description', widget: 'textarea' },
    ],
  },
  Assignment: {
    fields: [
      { path: 'team', labelKey: 'fields.team', widget: 'text', immutable: true },
      { path: 'projects', labelKey: 'fields.projects', widget: 'stringList' },
      { path: 'openshift', labelKey: 'fields.openshift', widget: 'text' },
      { path: 'toolRbac.assignmentAdmin', labelKey: 'fields.assignmentAdmin', widget: 'text' },
      { path: 'toolRbac.assignmentDeveloper', labelKey: 'fields.assignmentDeveloper', widget: 'text' },
      { path: 'toolRbac.assignmentViewer', labelKey: 'fields.assignmentViewer', widget: 'text' },
      { path: 'toolRbac.assignmentOps', labelKey: 'fields.assignmentOps', widget: 'text' },
    ],
  },
  PlatformOpenshift: {
    fields: [
      {
        path: 'type',
        labelKey: 'fields.platformType',
        widget: 'select',
        immutable: true,
        options: [
          { value: 'openstack', labelKey: 'fields.platformOpenstack' },
          { value: 'aws', labelKey: 'fields.platformAws' },
        ],
      },
      { path: 'openstack.environment', labelKey: 'fields.cloudOsoEnv', widget: 'text', immutable: true },
      { path: 'openstack.controlPlaneCount', labelKey: 'fields.controlPlaneCount', widget: 'number' },
      { path: 'openstack.workerCount', labelKey: 'fields.workerCount', widget: 'number' },
      { path: 'openstack.controlPlaneFlavor', labelKey: 'fields.controlPlaneFlavor', widget: 'text' },
      { path: 'openstack.workerFlavor', labelKey: 'fields.workerFlavor', widget: 'text' },
      { path: 'openstack.externalNetwork', labelKey: 'fields.externalNetwork', widget: 'text' },
      { path: 'aws.environment', labelKey: 'fields.cloudAwsEnv', widget: 'text', immutable: true },
      { path: 'aws.region', labelKey: 'fields.region', widget: 'text' },
      {
        path: 'aws.clusterType',
        labelKey: 'fields.clusterType',
        widget: 'select',
        options: [
          { value: 'standalone', labelKey: 'fields.clusterStandalone' },
          { value: 'ha', labelKey: 'fields.clusterHa' },
        ],
      },
      { path: 'aws.controlPlaneCount', labelKey: 'fields.controlPlaneCount', widget: 'number' },
      { path: 'aws.workerCount', labelKey: 'fields.workerCount', widget: 'number' },
      { path: 'aws.controllerFlavor', labelKey: 'fields.controllerFlavor', widget: 'text' },
      { path: 'aws.workerFlavor', labelKey: 'fields.workerFlavor', widget: 'text' },
      { path: 'toolRbac.clusterAdminRbac', labelKey: 'fields.clusterAdminRbac', widget: 'stringList' },
      { path: 'toolRbac.clusterOperatorRbac', labelKey: 'fields.clusterOperatorRbac', widget: 'stringList' },
      { path: 'toolRbac.clusterDeveloperRbac', labelKey: 'fields.clusterDeveloperRbac', widget: 'stringList' },
      { path: 'toolRbac.clusterViewerRbac', labelKey: 'fields.clusterViewerRbacTool', widget: 'stringList' },
      { path: 'clusterViewerRbac', labelKey: 'fields.clusterViewerRbac', widget: 'stringList' },
    ],
  },
  Persona: {
    fields: [
      { path: 'rbac', labelKey: 'fields.rbac', widget: 'text', immutable: true },
      { path: 'type', labelKey: 'fields.personaType', widget: 'text', immutable: true },
    ],
  },
  Rbac: {
    fields: [
      { path: 'config', labelKey: 'fields.rbacConfig', widget: 'text', immutable: true },
      { path: 'description', labelKey: 'fields.description', widget: 'textarea' },
    ],
  },
  CloudOSO: {
    fields: [
      { path: 'project', labelKey: 'fields.osoProject', widget: 'text' },
      { path: 'vaultPath', labelKey: 'fields.vaultPath', widget: 'text' },
      { path: 'baseDomain', labelKey: 'fields.baseDomain', widget: 'text' },
      { path: 'projectDomain', labelKey: 'fields.projectDomain', widget: 'text' },
      { path: 'externalNetwork', labelKey: 'fields.externalNetwork', widget: 'text' },
      { path: 'route53VaultPath', labelKey: 'fields.route53VaultPath', widget: 'text' },
      { path: 'landingzone', labelKey: 'fields.landingzone', widget: 'text' },
      { path: 'designateZoneId', labelKey: 'fields.designateZoneId', widget: 'text' },
      { path: 'designateProjectId', labelKey: 'fields.designateProjectId', widget: 'text' },
      { path: 'enableVRF', labelKey: 'fields.enableVRF', widget: 'boolean' },
      { path: 'vrfId', labelKey: 'fields.vrfId', widget: 'text' },
    ],
  },
  CloudAWS: {
    fields: [
      { path: 'account', labelKey: 'fields.account', widget: 'text' },
      { path: 'vaultPath', labelKey: 'fields.vaultPath', widget: 'text' },
      { path: 'baseDomain', labelKey: 'fields.baseDomain', widget: 'text' },
      { path: 'landingzone', labelKey: 'fields.landingzone', widget: 'text' },
    ],
  },
  CloudVirt: {
    fields: [
      { path: 'vaultPath', labelKey: 'fields.vaultPath', widget: 'text' },
      { path: 'baseDomain', labelKey: 'fields.baseDomain', widget: 'text' },
      { path: 'storageClass', labelKey: 'fields.storageClass', widget: 'text' },
      { path: 'networkAttachment', labelKey: 'fields.networkAttachment', widget: 'text' },
      { path: 'enableVRF', labelKey: 'fields.enableVRF', widget: 'boolean' },
      { path: 'vrfId', labelKey: 'fields.vrfId', widget: 'text' },
    ],
  },
  OpenStackMigration: {
    fields: [
      { path: 'source', labelKey: 'fields.source', widget: 'text', immutable: true },
      { path: 'vmName', labelKey: 'fields.vmName', widget: 'text', immutable: true },
      { path: 'cloudoso', labelKey: 'fields.cloudOso', widget: 'text', immutable: true },
      { path: 'providerNamespace', labelKey: 'fields.providerNamespace', widget: 'text' },
      { path: 'plan', labelKey: 'fields.migrationPlan', widget: 'json' },
    ],
  },
  Vault: {
    fields: [
      { path: 'ha', labelKey: 'fields.ha', widget: 'boolean' },
      { path: 'rbacConfig', labelKey: 'fields.rbacConfig', widget: 'text', immutable: true },
    ],
  },
  VaultKV: {
    fields: [
      { path: 'vault', labelKey: 'fields.vault', widget: 'text', immutable: true },
      { path: 'vaultAdminRbac', labelKey: 'fields.vaultAdminRbac', widget: 'stringList' },
      { path: 'vaultReaderRbac', labelKey: 'fields.vaultReaderRbac', widget: 'stringList' },
      { path: 'vaultOpsRbac', labelKey: 'fields.vaultOpsRbac', widget: 'stringList' },
      { path: 'vaultDeveloperRbac', labelKey: 'fields.vaultDeveloperRbac', widget: 'stringList' },
    ],
  },
  AAPOrg: {
    fields: [
      { path: 'aapConfig', labelKey: 'fields.aapConfig', widget: 'text', immutable: true },
      { path: 'aapAdminRbac', labelKey: 'fields.aapAdminRbac', widget: 'stringList' },
      { path: 'aapJobExecutorRbac', labelKey: 'fields.aapJobExecutorRbac', widget: 'stringList' },
      { path: 'aapViewerRbac', labelKey: 'fields.aapViewerRbac', widget: 'stringList' },
    ],
  },
  QuayOrg: {
    fields: [
      { path: 'quayConfig', labelKey: 'fields.quayConfig', widget: 'text', immutable: true },
      { path: 'quayAdminRbac', labelKey: 'fields.quayAdminRbac', widget: 'stringList' },
      { path: 'quayCreatorRbac', labelKey: 'fields.quayCreatorRbac', widget: 'stringList' },
      { path: 'quayMemberRbac', labelKey: 'fields.quayMemberRbac', widget: 'stringList' },
    ],
  },
  HybridNetwork: {
    fields: [
      { path: 'description', labelKey: 'fields.description', widget: 'textarea' },
      { path: 'networkViewerRbac', labelKey: 'fields.networkViewerRbac', widget: 'stringList' },
    ],
  },
  NetworkPlacement: {
    fields: [
      { path: 'network', labelKey: 'fields.network', widget: 'text', immutable: true },
      { path: 'backend.kind', labelKey: 'fields.backendKind', widget: 'text', immutable: true },
      { path: 'backend.name', labelKey: 'fields.backendName', widget: 'text', immutable: true },
      { path: 'prefixes', labelKey: 'fields.prefixes', widget: 'cidrList' },
      {
        path: 'state',
        labelKey: 'fields.state',
        widget: 'select',
        options: [
          { value: 'present', labelKey: 'fields.statePresent' },
          { value: 'absent', labelKey: 'fields.stateAbsent' },
        ],
      },
    ],
  },
  HybridFabric: {
    fields: [
      { path: 'enabled', labelKey: 'fields.enabled', widget: 'boolean' },
      { path: 'domainAsn', labelKey: 'fields.domainAsn', widget: 'number' },
      { path: 'vniPool.start', labelKey: 'fields.vniStart', widget: 'number' },
      { path: 'vniPool.end', labelKey: 'fields.vniEnd', widget: 'number' },
      {
        path: 'transportDefaults.defaultTunnelType',
        labelKey: 'fields.defaultTunnelType',
        widget: 'select',
        options: tunnelOptions,
      },
      { path: 'transportDefaults.mtu', labelKey: 'fields.mtu', widget: 'number' },
      { path: 'transportDefaults.innerMssClamp', labelKey: 'fields.innerMssClamp', widget: 'number' },
      { path: 'routeReflectors', labelKey: 'fields.routeReflectors', widget: 'json' },
      { path: 'borderGateway', labelKey: 'fields.borderGateway', widget: 'json' },
    ],
  },
  CloudGateway: {
    fields: [
      { path: 'enabled', labelKey: 'fields.enabled', widget: 'boolean' },
      { path: 'cloud', labelKey: 'fields.cloud', widget: 'text', immutable: true },
      { path: 'region', labelKey: 'fields.region', widget: 'text' },
      { path: 'domainAsn', labelKey: 'fields.domainAsn', widget: 'number' },
      { path: 'fabricRef', labelKey: 'fields.fabricRef', widget: 'text', immutable: true },
      { path: 'landingZoneTemplate', labelKey: 'fields.landingzone', widget: 'text' },
      { path: 'awsAccountId', labelKey: 'fields.awsAccountId', widget: 'text' },
      { path: 'openstackCloudOSORef', labelKey: 'fields.cloudOso', widget: 'text' },
      { path: 'transport', labelKey: 'fields.transport', widget: 'json' },
    ],
  },
  TransportLink: {
    fields: [
      { path: 'enabled', labelKey: 'fields.enabled', widget: 'boolean' },
      { path: 'fabricRef', labelKey: 'fields.fabricRef', widget: 'text', immutable: true },
      { path: 'cloudGatewayRef', labelKey: 'fields.cloudGatewayRef', widget: 'text', immutable: true },
      {
        path: 'tunnelType',
        labelKey: 'fields.tunnelType',
        widget: 'select',
        options: tunnelOptions,
      },
      { path: 'vaultConfigRef', labelKey: 'fields.vaultConfigRef', widget: 'text' },
    ],
  },
  UIHealthChecker: {
    fields: [
      { path: 'url', labelKey: 'fields.url', widget: 'text' },
      { path: 'displayName', labelKey: 'fields.displayName', widget: 'text' },
      { path: 'description', labelKey: 'fields.description', widget: 'textarea' },
      { path: 'group', labelKey: 'fields.group', widget: 'text' },
      { path: 'expectedStatus', labelKey: 'fields.expectedStatus', widget: 'number' },
      { path: 'timeoutSeconds', labelKey: 'fields.timeoutSeconds', widget: 'number' },
    ],
  },
  RbacConfig: {
    fields: [
      { path: 'description', labelKey: 'fields.description', widget: 'textarea' },
    ],
  },
  AAPConfig: {
    fields: [
      { path: 'description', labelKey: 'fields.description', widget: 'textarea' },
    ],
  },
  QuayConfig: {
    fields: [
      { path: 'description', labelKey: 'fields.description', widget: 'textarea' },
    ],
  },
};

export function getAtPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && !Array.isArray(acc)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function setAtPath(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const parts = path.split('.');
  const root = { ...obj };
  let cursor: Record<string, unknown> = root;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    const next = cursor[key];
    const copy =
      next && typeof next === 'object' && !Array.isArray(next)
        ? { ...(next as Record<string, unknown>) }
        : {};
    cursor[key] = copy;
    cursor = copy;
  }
  cursor[parts[parts.length - 1]] = value;
  return root;
}
