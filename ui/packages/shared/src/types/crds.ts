/** API group for all Hybrid Sovereign CRDs */
export const API_GROUP = 'hybridsovereign.redhat';
export const API_VERSION = 'v1alpha1';
export const API_VERSION_FULL = `${API_GROUP}/${API_VERSION}`;

/** Standard operator status fields shared across CRDs */
export interface OperatorStatus {
  status?: 'pending' | 'reconciling' | 'ready' | 'failed';
  ready?: boolean;
  observedGeneration?: number;
  lastReconciledAt?: string;
  message?: string;
  conditions?: StatusCondition[];
}

export interface StatusCondition {
  type: string;
  status: 'True' | 'False' | 'Unknown';
  lastTransitionTime?: string;
  reason?: string;
  message?: string;
}

export interface ObjectMeta {
  name: string;
  namespace?: string;
  uid?: string;
  generation?: number;
  creationTimestamp?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface K8sResource<TSpec = object, TStatus = OperatorStatus> {
  apiVersion: string;
  kind: string;
  metadata: ObjectMeta;
  spec: TSpec;
  status?: TStatus;
}

/** Entity — top-level tenant */
export interface EntityNamespaceRbac {
  entityAdmin?: string[];
  auditor?: string[];
  cloudAWSAdmin?: string[];
  cloudOSOAdmin?: string[];
  identityAdmin?: string[];
}

export interface EntitySpec {
  description?: string;
  billingID?: string;
  websiteLink?: string;
  namespaceRbac?: EntityNamespaceRbac;
}

export type Entity = K8sResource<EntitySpec>;

/** Team — entity-scoped team */
export interface TeamSpec {
  rbacConfig?: string;
  features?: {
    argo?: boolean;
    istio?: boolean;
  };
  teamAdmin?: string[];
}

export type Team = K8sResource<TeamSpec>;

/** Assignment — binds team to projects and platforms */
export interface AssignmentSpec {
  team: string;
  projects?: string[];
  openshift?: string;
  aws?: string;
}

export type Assignment = K8sResource<AssignmentSpec>;

/** Project — entity-scoped project namespace */
export interface ProjectSpec {
  description?: string;
}

export type Project = K8sResource<ProjectSpec>;

/** Persona — RBAC persona binding */
export interface PersonaSpec {
  rbac: string;
  type: string;
}

export type Persona = K8sResource<PersonaSpec>;

/** PlatformOpenshift — managed OCP cluster */
export interface PlatformOpenshiftOpenstackSpec {
  environment: string;
  controlPlaneCount?: number;
  workerCount?: number;
  controlPlaneFlavor?: string;
  workerFlavor?: string;
  externalNetwork?: string;
}

export interface PlatformOpenshiftSpec {
  type: 'openstack' | 'aws' | 'hosted' | 'vmware';
  openstack?: PlatformOpenshiftOpenstackSpec;
  cloudRef?: string;
}

export type PlatformOpenshift = K8sResource<PlatformOpenshiftSpec>;

/** CloudOSO — OpenStack environment */
export interface CloudOSOSpec {
  project?: string;
  vaultPath?: string;
  credentialsSecretRef?: { name: string };
  baseDomain?: string;
  projectDomain?: string;
  externalNetwork?: string;
  route53VaultPath?: string;
}

export type CloudOSO = K8sResource<CloudOSOSpec>;

/** CloudAWS — AWS account environment */
export interface CloudAWSToolRbac {
  accountAdminRbac?: string[];
  accountPoweruserRbac?: string[];
  accountViewerRbac?: string[];
}

export interface CloudAWSSpec {
  account?: string;
  vaultPath?: string;
  credentialsSecretRef?: { name: string };
  baseDomain?: string;
  toolRbac?: CloudAWSToolRbac;
}

export type CloudAWS = K8sResource<CloudAWSSpec>;

/** CloudVirt — OpenShift Virtualization (CNV) environment */
export interface CloudVirtToolRbac {
  environmentAdminRbac?: string[];
  environmentPoweruserRbac?: string[];
  environmentViewerRbac?: string[];
}

export interface CloudVirtSpec {
  vaultPath?: string;
  baseDomain?: string;
  storageClass?: string;
  networkAttachment?: string;
  enableVRF?: boolean;
  vrfId?: string;
  toolRbac?: CloudVirtToolRbac;
}

export type CloudVirt = K8sResource<CloudVirtSpec>;

/** OpenStackMigration — VMware to CloudOSO migration */
export interface OpenStackMigrationSpec {
  source?: string;
  vmName?: string;
  cloudoso?: string;
}

export interface OpenStackMigrationStatus extends OperatorStatus {
  source?: string;
  vmName?: string;
  cloudoso?: string;
}

export type OpenStackMigration = K8sResource<OpenStackMigrationSpec, OpenStackMigrationStatus>;

/** Rbac — entity-scoped RBAC role */
export interface RbacSpec {
  config: string;
  description?: string;
}

export interface RbacStatus extends OperatorStatus {
  group?: string;
}

export type Rbac = K8sResource<RbacSpec, RbacStatus>;

/** RbacConfig — platform RBAC backend config */
export interface RbacConfigSpec {
  type: 'keycloak' | string;
  secret: string;
}

export type RbacConfig = K8sResource<RbacConfigSpec>;

/** AAPOrg — Ansible Automation Platform organization */
export interface AAPOrgSpec {
  aapConfig: string;
  aapAdminRbac?: string[];
  aapJobExecutorRbac?: string[];
}

export interface AAPOrgStatus extends OperatorStatus {
  orgName?: string;
  orgId?: number;
  adminGroups?: string[];
}

export type AAPOrg = K8sResource<AAPOrgSpec, AAPOrgStatus>;

/** AAPConfig — platform AAP connection config */
export interface AAPConfigSpec {
  secret: string;
  rbacConfig: string;
}

export type AAPConfig = K8sResource<AAPConfigSpec>;

/** QuayOrg — Quay organization */
export interface QuayOrgSpec {
  quayConfig: string;
  quayAdminRbac?: string[];
  quayCreatorRbac?: string[];
  quayMemberRbac?: string[];
}

export interface QuayOrgStatus extends OperatorStatus {
  orgName?: string;
}

export type QuayOrg = K8sResource<QuayOrgSpec, QuayOrgStatus>;

/** QuayConfig — platform Quay connection config */
export interface QuayConfigSpec {
  secret: string;
  rbacConfig: string;
}

export type QuayConfig = K8sResource<QuayConfigSpec>;

/** Vault — entity Vault instance */
export interface VaultSpec {
  ha?: boolean;
  rbacConfig: string;
}

export type Vault = K8sResource<VaultSpec>;

/** VaultKV — Vault KV mount and RBAC */
export interface VaultKVSpec {
  vault: string;
  vaultAdminRbac?: string[];
  vaultReaderRbac?: string[];
}

export type VaultKV = K8sResource<VaultKVSpec>;

/** HybridFabric — platform EVPN fabric */
export interface HybridFabricSpec {
  enabled?: boolean;
  domainAsn?: number;
  routeReflectors?: Array<{ name: string; address: string }>;
  vniPool?: { start: number; end: number };
  borderGateway?: { name?: string; loopback?: string; vaultCredentialRef?: string };
  transportDefaults?: {
    mtu?: number;
    innerMssClamp?: number;
    defaultTunnelType?: 'wireguard' | 'ipsec' | 'macsec' | 'none';
  };
}
export type HybridFabric = K8sResource<HybridFabricSpec>;

/** CloudGateway — cloud landing zone */
export interface CloudGatewaySpec {
  enabled?: boolean;
  cloud?: 'aws' | 'openstack' | 'openshift';
  region?: string;
  domainAsn?: number;
  fabricRef?: string;
  landingZoneTemplate?: string;
  transport?: { type?: string; vaultPeerConfigRef?: string };
  awsAccountId?: string;
  openstackCloudOSORef?: string;
}
export type CloudGateway = K8sResource<CloudGatewaySpec>;

/** TransportLink — fabric↔gateway tunnel */
export interface TransportLinkSpec {
  enabled?: boolean;
  fabricRef?: string;
  cloudGatewayRef?: string;
  tunnelType?: 'wireguard' | 'ipsec' | 'macsec' | 'none';
  vaultConfigRef?: string;
}
export type TransportLink = K8sResource<TransportLinkSpec>;

/** HybridNetwork — tenant network identity */
export interface HybridNetworkSpec {
  description?: string;
  networkViewerRbac?: string[];
}
export type HybridNetwork = K8sResource<HybridNetworkSpec>;

/** NetworkPlacement — backend attachment */
export interface NetworkPlacementSpec {
  network: string;
  backend: { kind: 'CloudAWS' | 'CloudOSO' | 'PlatformOpenshift'; name: string };
  prefixes?: string[];
  state?: 'present' | 'absent';
}
export type NetworkPlacement = K8sResource<NetworkPlacementSpec>;

/** UIHealthChecker — URL probe target (dashboard pod HTTP check) */
export interface UIHealthCheckerSpec {
  url: string;
  displayName?: string;
  description?: string;
  group?: string;
  expectedStatus?: number;
  timeoutSeconds?: number;
}
export type UIHealthChecker = K8sResource<UIHealthCheckerSpec>;

/** Union of all Hybrid Sovereign CR kinds */
export type HybridSovereignKind =
  | 'Entity'
  | 'Team'
  | 'Assignment'
  | 'Project'
  | 'Persona'
  | 'PlatformOpenshift'
  | 'CloudOSO'
  | 'CloudAWS'
  | 'CloudVirt'
  | 'OpenStackMigration'
  | 'Rbac'
  | 'RbacConfig'
  | 'AAPOrg'
  | 'AAPConfig'
  | 'QuayOrg'
  | 'QuayConfig'
  | 'Vault'
  | 'VaultKV'
  | 'HybridFabric'
  | 'CloudGateway'
  | 'TransportLink'
  | 'HybridNetwork'
  | 'NetworkPlacement'
  | 'UIHealthChecker';

/** Plural resource names for K8s API paths */
export const KIND_PLURALS: Record<HybridSovereignKind, string> = {
  Entity: 'entities',
  Team: 'teams',
  Assignment: 'assignments',
  Project: 'projects',
  Persona: 'personas',
  PlatformOpenshift: 'platformopenshifts',
  CloudOSO: 'cloudosos',
  CloudAWS: 'cloudawss',
  CloudVirt: 'cloudvirts',
  OpenStackMigration: 'openstackmigrations',
  Rbac: 'rbacs',
  RbacConfig: 'rbacconfigs',
  AAPOrg: 'aaporgs',
  AAPConfig: 'aapconfigs',
  QuayOrg: 'quayorgs',
  QuayConfig: 'quayconfigs',
  Vault: 'vaults',
  VaultKV: 'vaultkvs',
  HybridFabric: 'hybridfabrics',
  CloudGateway: 'cloudgateways',
  TransportLink: 'transportlinks',
  HybridNetwork: 'hybridnetworks',
  NetworkPlacement: 'networkplacements',
  UIHealthChecker: 'uihealthcheckers',
};

/** Namespaced kinds shown on the tenancy Overview */
export const TENANT_OVERVIEW_KINDS: HybridSovereignKind[] = [
  'Team',
  'Project',
  'PlatformOpenshift',
  'Assignment',
  'CloudOSO',
  'CloudAWS',
  'CloudVirt',
  'OpenStackMigration',
  'Persona',
  'Rbac',
  'Vault',
  'VaultKV',
  'AAPOrg',
  'QuayOrg',
  'HybridNetwork',
  'NetworkPlacement',
];

export type HybridSovereignResource =
  | Entity
  | Team
  | Assignment
  | Project
  | Persona
  | PlatformOpenshift
  | CloudOSO
  | CloudAWS
  | CloudVirt
  | OpenStackMigration
  | Rbac
  | RbacConfig
  | AAPOrg
  | AAPConfig
  | QuayOrg
  | QuayConfig
  | Vault
  | VaultKV
  | HybridFabric
  | CloudGateway
  | TransportLink
  | HybridNetwork
  | NetworkPlacement
  | UIHealthChecker;
