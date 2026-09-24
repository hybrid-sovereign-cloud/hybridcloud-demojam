import React, { useEffect, useState } from 'react';
import {
  Form,
  FormGroup,
  TextInput,
  TextArea,
  Button,
  ActionGroup,
  Alert,
  Switch,
  Card,
  CardBody,
  FormSelect,
  FormSelectOption,
} from '@patternfly/react-core';
import { createDashboardResource, useK8sResourceList } from '../hooks/k8s';
import { HybridSovereignKind, K8sResource } from '../types';
import { PageHeader } from './PageHeader';

export type SelfServiceFormType =
  | 'team'
  | 'project'
  | 'assignment'
  | 'cloudoso'
  | 'cloudaws'
  | 'cloudvirt'
  | 'platformopenshift'
  | 'migration'
  | 'persona'
  | 'rbac'
  | 'vault'
  | 'vaultkv'
  | 'aaporg'
  | 'quayorg'
  | 'entity'
  | 'hybridnetwork'
  | 'networkplacement'
  | 'hybridfabric'
  | 'cloudgateway'
  | 'transportlink'
  | 'uihealthchecker';

export interface CreateResourceFormProps {
  formType: SelfServiceFormType;
  namespace: string;
  listPath: string;
  onSuccess: (listPath: string) => void;
  onCancel: () => void;
}

const FORM_TITLES: Record<SelfServiceFormType, string> = {
  team: 'Create Team',
  project: 'Create Project',
  assignment: 'Create Assignment',
  cloudoso: 'Request CloudOSO Environment',
  cloudaws: 'Request Cloud AWS Account',
  cloudvirt: 'Request Cloud Virt Environment',
  platformopenshift: 'Create Platform Openshift',
  migration: 'Migrate to OpenStack',
  persona: 'Create Persona',
  rbac: 'Create RBAC',
  vault: 'Create Vault',
  vaultkv: 'Create Vault KV',
  aaporg: 'Create AAP Org',
  quayorg: 'Create Quay Org',
  entity: 'Create Entity',
  hybridnetwork: 'Create Hybrid Network',
  networkplacement: 'Create Network Placement',
  hybridfabric: 'Create Hybrid Fabric',
  cloudgateway: 'Create Cloud Gateway',
  transportlink: 'Create Transport Link',
  uihealthchecker: 'Create UI Health Checker',
};

const FORM_KINDS: Record<SelfServiceFormType, HybridSovereignKind> = {
  team: 'Team',
  project: 'Project',
  assignment: 'Assignment',
  cloudoso: 'CloudOSO',
  cloudaws: 'CloudAWS',
  cloudvirt: 'CloudVirt',
  platformopenshift: 'PlatformOpenshift',
  migration: 'OpenStackMigration',
  persona: 'Persona',
  rbac: 'Rbac',
  vault: 'Vault',
  vaultkv: 'VaultKV',
  aaporg: 'AAPOrg',
  quayorg: 'QuayOrg',
  entity: 'Entity',
  hybridnetwork: 'HybridNetwork',
  networkplacement: 'NetworkPlacement',
  hybridfabric: 'HybridFabric',
  cloudgateway: 'CloudGateway',
  transportlink: 'TransportLink',
  uihealthchecker: 'UIHealthChecker',
};

const PERSONA_TYPES = [
  'entityAdmin',
  'identityAdmin',
  'auditor',
  'teamAdmin',
  'teamView',
  'projectAdmin',
  'projectView',
  'assignmentAdmin',
  'platformOpenshiftAdmin',
  'platformOpenshiftView',
  'cloudOSOAdmin',
  'cloudOSOView',
  'cloudAWSAdmin',
  'cloudAWSView',
  'cloudVirtAdmin',
  'cloudVirtView',
  'BobsTeam',
];

function RefSelect({
  id,
  label,
  value,
  onChange,
  options,
  isRequired,
  placeholder = 'Select…',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  isRequired?: boolean;
  placeholder?: string;
}): React.ReactElement {
  return (
    <FormGroup label={label} isRequired={isRequired} fieldId={id}>
      <FormSelect id={id} value={value} onChange={(_e, v) => onChange(v)} isRequired={isRequired}>
        <FormSelectOption value="" label={placeholder} isDisabled={isRequired} />
        {options.map((o) => (
          <FormSelectOption key={o.value} value={o.value} label={o.label} />
        ))}
      </FormSelect>
    </FormGroup>
  );
}

/** Router-agnostic create form used by standalone dashboards and console plugins. */
export function CreateResourceForm({
  formType,
  namespace,
  listPath,
  onSuccess,
  onCancel,
}: CreateResourceFormProps): React.ReactElement {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [billingID, setBillingID] = useState('');
  const [websiteLink, setWebsiteLink] = useState('');
  const [teamRef, setTeamRef] = useState('');
  const [projectRef, setProjectRef] = useState('');
  const [platformRef, setPlatformRef] = useState('');
  const [cloudAwsRef, setCloudAwsRef] = useState('');
  const [cloudVirtRef, setCloudVirtRef] = useState('');
  const [argoEnabled, setArgoEnabled] = useState(true);
  const [rbacRef, setRbacRef] = useState('');
  const [personaType, setPersonaType] = useState('entityAdmin');
  const [rbacConfig, setRbacConfig] = useState('');
  const [vaultRef, setVaultRef] = useState('');
  const [cloudosoRef, setCloudosoRef] = useState('');
  const [vmName, setVmName] = useState('');
  const [source, setSource] = useState('vmware');
  const [aapConfig, setAapConfig] = useState('');
  const [quayConfig, setQuayConfig] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [networkRef, setNetworkRef] = useState('');
  const [backendKind, setBackendKind] = useState('CloudAWS');
  const [backendName, setBackendName] = useState('');
  const [prefixes, setPrefixes] = useState('10.50.0.0/24');
  const [domainAsn, setDomainAsn] = useState('65000');
  const [vniStart, setVniStart] = useState('50000');
  const [vniEnd, setVniEnd] = useState('50511');
  const [fabricRef, setFabricRef] = useState('lab-fabric');
  const [cloudProvider, setCloudProvider] = useState('aws');
  const [region, setRegion] = useState('us-east-1');
  const [gatewayRef, setGatewayRef] = useState('');
  const [healthUrl, setHealthUrl] = useState('https://');
  const [healthGroup, setHealthGroup] = useState('custom');
  const [istioEnabled, setIstioEnabled] = useState(false);
  const [haEnabled, setHaEnabled] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [projectRefs, setProjectRefs] = useState('');
  const [assignAdmin, setAssignAdmin] = useState('');
  const [assignDev, setAssignDev] = useState('');
  const [assignViewer, setAssignViewer] = useState('');
  const [assignOps, setAssignOps] = useState('');
  const [osoProject, setOsoProject] = useState('');
  const [vaultPath, setVaultPath] = useState('oso/accounts/shc_admin');
  const [baseDomain, setBaseDomain] = useState('');
  const [projectDomain, setProjectDomain] = useState('shc_domain');
  const [externalNetwork, setExternalNetwork] = useState('ext-net');
  const [route53VaultPath, setRoute53VaultPath] = useState('oso/accounts/route53-openstack');
  const [landingzone, setLandingzone] = useState('default');
  const [awsAccount, setAwsAccount] = useState('');
  const [awsVaultPath, setAwsVaultPath] = useState('');
  const [awsBaseDomain, setAwsBaseDomain] = useState('');
  const [virtVaultPath, setVirtVaultPath] = useState('');
  const [virtBaseDomain, setVirtBaseDomain] = useState('');
  const [virtStorageClass, setVirtStorageClass] = useState('ocs-storagecluster-ceph-rbd');
  const [platformType, setPlatformType] = useState('openstack');
  const [platformEnv, setPlatformEnv] = useState('');
  const [cpCount, setCpCount] = useState('3');
  const [workerCount, setWorkerCount] = useState('3');
  const [nodePoolReplicas, setNodePoolReplicas] = useState('2');
  const [cpMemory, setCpMemory] = useState('16Gi');
  const [workerMemory, setWorkerMemory] = useState('8Gi');
  const [cpCores, setCpCores] = useState('4');
  const [workerCores, setWorkerCores] = useState('2');
  const [rbacMulti, setRbacMulti] = useState('');
  const [rbacOperator, setRbacOperator] = useState('');
  const [rbacViewer, setRbacViewer] = useState('');
  const [networkViewerRbac, setNetworkViewerRbac] = useState('');

  const type = formType;
  const title = FORM_TITLES[type] ?? 'Create Resource';
  const kind = FORM_KINDS[type];
  const [entityName, setEntityName] = useState('');
  const entityNs =
    type === 'entity'
      ? 'sovereign-cloud'
      : type === 'persona' && !namespace
        ? entityName
          ? `entity-${entityName}`
          : ''
        : namespace;

  const entities = useK8sResourceList<K8sResource>('Entity', {
    namespace: 'sovereign-cloud',
    enabled: type === 'persona' && !namespace,
  });

  const teams = useK8sResourceList<K8sResource>('Team', { namespace: entityNs, enabled: type === 'assignment' });
  const projects = useK8sResourceList<K8sResource>('Project', {
    namespace: entityNs,
    enabled: type === 'assignment',
  });
  const platforms = useK8sResourceList<K8sResource>('PlatformOpenshift', {
    namespace: entityNs,
    enabled: type === 'assignment',
  });
  const cloudAwss = useK8sResourceList<K8sResource>('CloudAWS', {
    namespace: entityNs,
    enabled: type === 'assignment' || type === 'platformopenshift',
  });
  const cloudVirts = useK8sResourceList<K8sResource>('CloudVirt', {
    namespace: entityNs,
    enabled: type === 'platformopenshift',
  });
  const vaults = useK8sResourceList<K8sResource>('Vault', {
    namespace: entityNs,
    enabled: type === 'vaultkv',
  });
  const cloudosos = useK8sResourceList<K8sResource>('CloudOSO', {
    namespace: entityNs,
    enabled: type === 'migration' || type === 'platformopenshift',
  });
  const rbacs = useK8sResourceList<K8sResource>('Rbac', {
    namespace: entityNs,
    enabled: (type === 'persona' || type === 'vaultkv' || type === 'aaporg' || type === 'quayorg' || type === 'assignment' || type === 'hybridnetwork' || type === 'platformopenshift') && !!entityNs,
  });
  const rbacConfigs = useK8sResourceList<K8sResource>('RbacConfig', {
    enabled: type === 'rbac' || type === 'vault',
  });
  const aapConfigs = useK8sResourceList<K8sResource>('AAPConfig', { enabled: type === 'aaporg' });
  const quayConfigs = useK8sResourceList<K8sResource>('QuayConfig', { enabled: type === 'quayorg' });
  const hybridNetworks = useK8sResourceList<K8sResource>('HybridNetwork', { namespace: entityNs, enabled: type === 'networkplacement' && !!entityNs });
  const cloudAwssForPlacement = useK8sResourceList<K8sResource>('CloudAWS', { namespace: entityNs, enabled: type === 'networkplacement' && backendKind === 'CloudAWS' && !!entityNs });
  const cloudososForPlacement = useK8sResourceList<K8sResource>('CloudOSO', { namespace: entityNs, enabled: type === 'networkplacement' && backendKind === 'CloudOSO' && !!entityNs });
  const platformsForPlacement = useK8sResourceList<K8sResource>('PlatformOpenshift', { namespace: entityNs, enabled: type === 'networkplacement' && backendKind === 'PlatformOpenshift' && !!entityNs });
  const fabrics = useK8sResourceList<K8sResource>('HybridFabric', { namespace: 'sovereign-cloud', enabled: type === 'cloudgateway' || type === 'transportlink' });
  const gateways = useK8sResourceList<K8sResource>('CloudGateway', { namespace: 'sovereign-cloud', enabled: type === 'transportlink' });


  const names = (items: K8sResource[]) => items.map((i) => ({ value: i.metadata.name, label: i.metadata.name }));

  useEffect(() => {
    if (type === 'persona' && !namespace && !entityName && entities.items[0]) {
      setEntityName(entities.items[0].metadata.name);
    }
    if (type === 'rbac' || type === 'vault') {
      if (!rbacConfig && rbacConfigs.items[0]) setRbacConfig(rbacConfigs.items[0].metadata.name);
    }
    if (type === 'aaporg' && !aapConfig && aapConfigs.items[0]) setAapConfig(aapConfigs.items[0].metadata.name);
    if (type === 'quayorg' && !quayConfig && quayConfigs.items[0]) setQuayConfig(quayConfigs.items[0].metadata.name);
    if (type === 'assignment' && !teamRef && teams.items[0]) setTeamRef(teams.items[0].metadata.name);
    if (type === 'persona' && !rbacRef && rbacs.items[0]) setRbacRef(rbacs.items[0].metadata.name);
    if (type === 'vaultkv' && !vaultRef && vaults.items[0]) setVaultRef(vaults.items[0].metadata.name);
    if (type === 'migration' && !cloudosoRef && cloudosos.items[0]) setCloudosoRef(cloudosos.items[0].metadata.name);
  }, [
    type,
    namespace,
    entityName,
    entities.items,
    rbacConfigs.items,
    aapConfigs.items,
    quayConfigs.items,
    teams.items,
    rbacs.items,
    vaults.items,
    cloudosos.items,
    rbacConfig,
    aapConfig,
    quayConfig,
    teamRef,
    rbacRef,
    vaultRef,
    cloudosoRef,
  ]);

  const buildSpec = (): Record<string, unknown> => {
    switch (type) {
      case 'entity':
        return {
          description,
          billingID,
          ...(websiteLink ? { websiteLink } : {}),
        };
      case 'team':
        return {
          features: { argo: argoEnabled, istio: istioEnabled },
        };
      case 'project':
        return {
          description,
          ...(displayName ? { displayName } : {}),
        };
      case 'assignment': {
        const projectsList = projectRefs
          ? projectRefs.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
          : projectRef
            ? [projectRef]
            : [];
        const toolRbac: Record<string, string> = {};
        if (assignAdmin) toolRbac.assignmentAdmin = assignAdmin;
        if (assignDev) toolRbac.assignmentDeveloper = assignDev;
        if (assignViewer) toolRbac.assignmentViewer = assignViewer;
        if (assignOps) toolRbac.assignmentOps = assignOps;
        return {
          team: teamRef,
          projects: projectsList,
          openshift: platformRef || undefined,
          ...(Object.keys(toolRbac).length ? { toolRbac } : {}),
        };
      }
      case 'cloudoso':
        return {
          project: osoProject,
          vaultPath,
          baseDomain,
          projectDomain,
          externalNetwork,
          route53VaultPath,
          landingzone,
        };
      case 'cloudaws':
        return {
          account: awsAccount,
          vaultPath: awsVaultPath,
          baseDomain: awsBaseDomain || baseDomain,
          landingzone,
        };
      case 'cloudvirt':
        return {
          vaultPath: virtVaultPath || vaultPath,
          baseDomain: virtBaseDomain || baseDomain,
          storageClass: virtStorageClass || undefined,
        };
      case 'platformopenshift': {
        const adminList = rbacMulti.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
        const operatorList = rbacOperator.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
        const viewerList = rbacViewer.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
        const toolRbac =
          adminList.length || operatorList.length || viewerList.length
            ? {
                ...(adminList.length ? { clusterAdminRbac: adminList } : {}),
                ...(operatorList.length ? { clusterOperatorRbac: operatorList } : {}),
                ...(viewerList.length ? { clusterViewerRbac: viewerList } : {}),
              }
            : undefined;
        if (platformType === 'aws') {
          return {
            type: 'aws',
            aws: {
              environment: platformEnv || cloudAwsRef,
              region,
              clusterType: 'standalone',
              controlPlaneCount: Number(cpCount) || 3,
              workerCount: Number(workerCount) || 2,
            },
            ...(toolRbac ? { toolRbac } : {}),
          };
        }
        if (platformType === 'hosted') {
          const envName = platformEnv || cloudVirtRef;
          return {
            type: 'hosted',
            hosted: {
              environment: envName,
              nodePoolReplicas: Number(nodePoolReplicas) || 2,
            },
            ...(toolRbac ? { toolRbac } : {}),
          };
        }
        if (platformType === 'virt') {
          const envName = platformEnv || cloudVirtRef;
          return {
            type: 'virt',
            virt: {
              environment: envName,
              controlPlaneCount: Number(cpCount) || 1,
              workerCount: Number(workerCount) || 0,
              controlPlaneMemory: cpMemory || '16Gi',
              workerMemory: workerMemory || '8Gi',
              controlPlaneCores: Number(cpCores) || 4,
              workerCores: Number(workerCores) || 2,
            },
            ...(toolRbac ? { toolRbac } : {}),
          };
        }
        return {
          type: 'openstack',
          openstack: {
            environment: platformEnv || cloudosoRef,
            controlPlaneCount: Number(cpCount) || 3,
            workerCount: Number(workerCount) || 3,
            externalNetwork,
          },
          ...(toolRbac ? { toolRbac } : {}),
        };
      }
      case 'migration':
        return { source, vmName, cloudoso: cloudosoRef, providerNamespace: 'openshift-mtv' };
      case 'persona':
        return { rbac: rbacRef, type: personaType };
      case 'rbac':
        return { config: rbacConfig, description };
      case 'vault':
        return { ha: haEnabled, rbacConfig };
      case 'vaultkv': {
        const list = rbacMulti.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
        return {
          vault: vaultRef,
          vaultAdminRbac: list,
          vaultReaderRbac: list,
          vaultOpsRbac: list,
          vaultDeveloperRbac: list,
        };
      }
      case 'aaporg': {
        const list = rbacMulti.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
        return {
          aapConfig,
          aapAdminRbac: list,
          aapJobExecutorRbac: list,
          aapViewerRbac: list,
        };
      }
      case 'quayorg': {
        const list = rbacMulti.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
        return {
          quayConfig,
          quayAdminRbac: list,
          quayCreatorRbac: list,
          quayMemberRbac: list,
        };
      }
      case 'hybridnetwork':
        return {
          description,
          networkViewerRbac: networkViewerRbac
            ? networkViewerRbac.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
            : [],
        };
      case 'networkplacement':
        return {
          network: networkRef,
          backend: { kind: backendKind, name: backendName },
          prefixes: prefixes.split(/[,\n]/).map((s) => s.trim()).filter(Boolean),
          state: 'present',
        };
      case 'hybridfabric':
        return {
          enabled: true,
          domainAsn: Number(domainAsn) || 65000,
          routeReflectors: [{ name: 'rr1', address: '10.0.0.1' }],
          vniPool: { start: Number(vniStart) || 50000, end: Number(vniEnd) || 50511 },
          transportDefaults: { mtu: 9000, defaultTunnelType: 'wireguard' },
        };
      case 'cloudgateway':
        return {
          enabled: true,
          cloud: cloudProvider,
          region,
          domainAsn: Number(domainAsn) || 65001,
          fabricRef,
          transport: { type: 'wireguard' },
        };
      case 'transportlink':
        return {
          enabled: true,
          fabricRef,
          cloudGatewayRef: gatewayRef,
          tunnelType: 'wireguard',
        };
      case 'uihealthchecker':
        return {
          url: healthUrl,
          displayName: description || name,
          description,
          group: healthGroup,
          expectedStatus: 200,
          timeoutSeconds: 10,
        };
      default:
        return {};
    }
  };

  const canSubmit = (): boolean => {
    if (!name) return false;
    if (type === 'entity' && !billingID) return false;
    if (type === 'persona' && !entityNs) return false;
    if (type === 'assignment' && !teamRef) return false;
    if (type === 'cloudoso' && (!osoProject || !vaultPath || !baseDomain || !projectDomain || !externalNetwork || !route53VaultPath)) return false;
    if (type === 'cloudaws' && (!awsAccount || !awsVaultPath || !(awsBaseDomain || baseDomain))) return false;
    if (type === 'cloudvirt' && (!(virtVaultPath || vaultPath) || !(virtBaseDomain || baseDomain))) return false;
    if (type === 'platformopenshift' && !(platformEnv || cloudosoRef || cloudAwsRef || cloudVirtRef)) return false;
    if (type === 'persona' && (!rbacRef || !personaType)) return false;
    if (type === 'vaultkv' && !vaultRef) return false;
    if (type === 'migration' && (!vmName || !cloudosoRef)) return false;
    if ((type === 'vault' || type === 'rbac') && !rbacConfig) return false;
    if (type === 'aaporg' && !aapConfig) return false;
    if (type === 'quayorg' && !quayConfig) return false;
    if (type === 'networkplacement' && (!networkRef || !backendName || !prefixes.trim())) return false;
    if (type === 'hybridfabric' && !domainAsn) return false;
    if (type === 'cloudgateway' && (!fabricRef || !region)) return false;
    if (type === 'transportlink' && (!fabricRef || !gatewayRef)) return false;
    if (type === 'uihealthchecker' && !healthUrl.startsWith('http')) return false;
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const targetNs =
        type === 'hybridfabric' || type === 'cloudgateway' || type === 'transportlink' || type === 'uihealthchecker'
          ? 'sovereign-cloud'
          : entityNs;
      await createDashboardResource(kind, { name, namespace: targetNs, spec: buildSpec() }, targetNs);
      setResult({ ok: true, message: `${kind} "${name}" submitted.` });
      setTimeout(() => onSuccess(listPath), 1200);
    } catch (err) {
      setResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Submit failed',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        title={title}
        subtitle={`Namespace ${entityNs || 'cluster'}`}
        breadcrumbs={[
          { label: 'Sovereign Cloud' },
          { label: title.replace(/^Create |^Request |^Migrate to /, ''), to: listPath },
          { label: 'Create' },
        ]}
      />
      {result && (
        <Alert
          variant={result.ok ? 'success' : 'danger'}
          title={result.ok ? 'Submitted' : 'Submission failed'}
          isInline
          className="sc-mb"
        >
          {result.message}
        </Alert>
      )}
      <div className="sc-form-layout">
        <Card isCompact>
          <CardBody>
            <Form onSubmit={handleSubmit}>
              <FormGroup label="Name" isRequired fieldId="name">
                <TextInput id="name" value={name} onChange={(_e, v) => setName(v)} isRequired />
              </FormGroup>

              {type === 'entity' && (
                <>
                  <FormGroup label="Billing ID" isRequired fieldId="billing">
                    <TextInput id="billing" value={billingID} onChange={(_e, v) => setBillingID(v)} isRequired />
                  </FormGroup>
                  <FormGroup label="Description" fieldId="description">
                    <TextArea id="description" value={description} onChange={(_e, v) => setDescription(v)} />
                  </FormGroup>
                  <FormGroup label="Website" fieldId="website">
                    <TextInput id="website" value={websiteLink} onChange={(_e, v) => setWebsiteLink(v)} />
                  </FormGroup>
                </>
              )}

              {(type === 'project' || type === 'rbac') && (
                <FormGroup label="Description" fieldId="description">
                  <TextArea id="description" value={description} onChange={(_e, v) => setDescription(v)} />
                </FormGroup>
              )}

              {type === 'team' && (
                <>
                  <FormGroup label="Enable Argo CD" fieldId="argo">
                    <Switch
                      id="argo"
                      isChecked={argoEnabled}
                      onChange={(_e, checked) => setArgoEnabled(checked)}
                    />
                  </FormGroup>
                  <FormGroup label="Enable Istio" fieldId="istio">
                    <Switch
                      id="istio"
                      isChecked={istioEnabled}
                      onChange={(_e, checked) => setIstioEnabled(checked)}
                    />
                  </FormGroup>
                </>
              )}

              {type === 'project' && (
                <FormGroup label="Display name" fieldId="display-name">
                  <TextInput id="display-name" value={displayName} onChange={(_e, v) => setDisplayName(v)} />
                </FormGroup>
              )}

              {type === 'assignment' && (
                <>
                  <RefSelect id="team" label="Team" value={teamRef} onChange={setTeamRef} options={names(teams.items)} isRequired />
                  <FormGroup label="Projects (comma-separated)" fieldId="projects">
                    <TextArea
                      id="projects"
                      value={projectRefs || projectRef}
                      onChange={(_e, v) => { setProjectRefs(v); setProjectRef(''); }}
                      rows={2}
                      placeholder={names(projects.items).map((p) => p.value).join(', ') || 'project-a, project-b'}
                    />
                  </FormGroup>
                  <RefSelect
                    id="platform"
                    label="Platform Openshift"
                    value={platformRef}
                    onChange={setPlatformRef}
                    options={names(platforms.items)}
                    placeholder="Optional"
                  />
                  <RefSelect id="assign-admin" label="Assignment admin RBAC" value={assignAdmin} onChange={setAssignAdmin} options={names(rbacs.items)} placeholder="Optional" />
                  <RefSelect id="assign-dev" label="Assignment developer RBAC" value={assignDev} onChange={setAssignDev} options={names(rbacs.items)} placeholder="Optional" />
                  <RefSelect id="assign-viewer" label="Assignment viewer RBAC" value={assignViewer} onChange={setAssignViewer} options={names(rbacs.items)} placeholder="Optional" />
                  <RefSelect id="assign-ops" label="Assignment ops RBAC" value={assignOps} onChange={setAssignOps} options={names(rbacs.items)} placeholder="Optional" />
                </>
              )}

              {type === 'cloudoso' && (
                <>
                  <FormGroup label="OpenStack project" fieldId="oso-project" isRequired>
                    <TextInput id="oso-project" value={osoProject} onChange={(_e, v) => setOsoProject(v)} isRequired />
                  </FormGroup>
                  <FormGroup label="Vault path" fieldId="oso-vault" isRequired>
                    <TextInput id="oso-vault" value={vaultPath} onChange={(_e, v) => setVaultPath(v)} isRequired />
                  </FormGroup>
                  <FormGroup label="Base domain" fieldId="oso-base" isRequired>
                    <TextInput id="oso-base" value={baseDomain} onChange={(_e, v) => setBaseDomain(v)} isRequired />
                  </FormGroup>
                  <FormGroup label="Project domain" fieldId="oso-pdom" isRequired>
                    <TextInput id="oso-pdom" value={projectDomain} onChange={(_e, v) => setProjectDomain(v)} isRequired />
                  </FormGroup>
                  <FormGroup label="External network" fieldId="oso-ext" isRequired>
                    <TextInput id="oso-ext" value={externalNetwork} onChange={(_e, v) => setExternalNetwork(v)} isRequired />
                  </FormGroup>
                  <FormGroup label="Route53 vault path" fieldId="oso-r53" isRequired>
                    <TextInput id="oso-r53" value={route53VaultPath} onChange={(_e, v) => setRoute53VaultPath(v)} isRequired />
                  </FormGroup>
                  <FormGroup label="Landing zone" fieldId="oso-lz">
                    <TextInput id="oso-lz" value={landingzone} onChange={(_e, v) => setLandingzone(v)} />
                  </FormGroup>
                </>
              )}

              {type === 'cloudaws' && (
                <>
                  <FormGroup label="AWS account ID" fieldId="aws-acct" isRequired>
                    <TextInput id="aws-acct" value={awsAccount} onChange={(_e, v) => setAwsAccount(v)} isRequired />
                  </FormGroup>
                  <FormGroup label="Vault path" fieldId="aws-vault" isRequired>
                    <TextInput id="aws-vault" value={awsVaultPath} onChange={(_e, v) => setAwsVaultPath(v)} isRequired />
                  </FormGroup>
                  <FormGroup label="Base domain" fieldId="aws-base" isRequired>
                    <TextInput id="aws-base" value={awsBaseDomain} onChange={(_e, v) => setAwsBaseDomain(v)} isRequired />
                  </FormGroup>
                  <FormGroup label="Landing zone" fieldId="aws-lz">
                    <TextInput id="aws-lz" value={landingzone} onChange={(_e, v) => setLandingzone(v)} />
                  </FormGroup>
                </>
              )}

              {type === 'cloudvirt' && (
                <>
                  <FormGroup label="Vault path" fieldId="virt-vault" isRequired>
                    <TextInput id="virt-vault" value={virtVaultPath} onChange={(_e, v) => setVirtVaultPath(v)} isRequired />
                  </FormGroup>
                  <FormGroup label="Base domain" fieldId="virt-base" isRequired>
                    <TextInput id="virt-base" value={virtBaseDomain} onChange={(_e, v) => setVirtBaseDomain(v)} isRequired />
                  </FormGroup>
                  <FormGroup label="Storage class" fieldId="virt-sc">
                    <TextInput id="virt-sc" value={virtStorageClass} onChange={(_e, v) => setVirtStorageClass(v)} />
                  </FormGroup>
                </>
              )}

              {type === 'platformopenshift' && (
                <>
                  <RefSelect
                    id="platform-type"
                    label="Platform type"
                    value={platformType}
                    onChange={(v) => {
                      setPlatformType(v);
                      setPlatformEnv('');
                      if (v === 'virt') {
                        setCpCount('1');
                        setWorkerCount('0');
                      } else if (v === 'hosted') {
                        setNodePoolReplicas('2');
                      } else {
                        setCpCount('3');
                        setWorkerCount(v === 'aws' ? '2' : '3');
                      }
                    }}
                    options={[
                      { value: 'openstack', label: 'OpenStack' },
                      { value: 'aws', label: 'AWS' },
                      { value: 'virt', label: 'Virt — standalone on CNV VMs (VM control plane)' },
                      { value: 'hosted', label: 'Hosted — Hypershift HCP (containerized control plane)' },
                    ]}
                    isRequired
                  />
                  <RefSelect
                    id="platform-env"
                    label={
                      platformType === 'aws'
                        ? 'CloudAWS environment'
                        : platformType === 'virt' || platformType === 'hosted'
                          ? 'CloudVirt environment'
                          : 'CloudOSO environment'
                    }
                    value={
                      platformEnv ||
                      (platformType === 'aws'
                        ? cloudAwsRef
                        : platformType === 'virt' || platformType === 'hosted'
                          ? cloudVirtRef
                          : cloudosoRef)
                    }
                    onChange={(v) => {
                      setPlatformEnv(v);
                      if (platformType === 'aws') setCloudAwsRef(v);
                      else if (platformType === 'virt' || platformType === 'hosted') setCloudVirtRef(v);
                      else setCloudosoRef(v);
                    }}
                    options={names(
                      platformType === 'aws'
                        ? cloudAwss.items
                        : platformType === 'virt' || platformType === 'hosted'
                          ? cloudVirts.items
                          : cloudosos.items,
                    )}
                    isRequired
                  />
                  {platformType === 'hosted' ? (
                    <FormGroup label="Worker NodePool replicas" fieldId="nodepool-replicas">
                      <TextInput
                        id="nodepool-replicas"
                        type="number"
                        value={nodePoolReplicas}
                        onChange={(_e, v) => setNodePoolReplicas(v)}
                      />
                    </FormGroup>
                  ) : (
                    <>
                      <FormGroup
                        label={platformType === 'virt' ? 'Control plane VMs' : 'Control plane count'}
                        fieldId="cp-count"
                      >
                        <TextInput id="cp-count" type="number" value={cpCount} onChange={(_e, v) => setCpCount(v)} />
                      </FormGroup>
                      <FormGroup label="Worker count" fieldId="worker-count">
                        <TextInput
                          id="worker-count"
                          type="number"
                          value={workerCount}
                          onChange={(_e, v) => setWorkerCount(v)}
                        />
                      </FormGroup>
                    </>
                  )}
                  {platformType === 'virt' && (
                    <>
                      <FormGroup label="Control plane memory" fieldId="cp-mem">
                        <TextInput id="cp-mem" value={cpMemory} onChange={(_e, v) => setCpMemory(v)} />
                      </FormGroup>
                      <FormGroup label="Control plane cores" fieldId="cp-cores">
                        <TextInput id="cp-cores" type="number" value={cpCores} onChange={(_e, v) => setCpCores(v)} />
                      </FormGroup>
                      <FormGroup label="Worker memory" fieldId="w-mem">
                        <TextInput id="w-mem" value={workerMemory} onChange={(_e, v) => setWorkerMemory(v)} />
                      </FormGroup>
                      <FormGroup label="Worker cores" fieldId="w-cores">
                        <TextInput
                          id="w-cores"
                          type="number"
                          value={workerCores}
                          onChange={(_e, v) => setWorkerCores(v)}
                        />
                      </FormGroup>
                    </>
                  )}
                  {platformType === 'aws' && (
                    <FormGroup label="Region" fieldId="plat-region">
                      <TextInput id="plat-region" value={region} onChange={(_e, v) => setRegion(v)} />
                    </FormGroup>
                  )}
                  {platformType === 'openstack' && (
                    <FormGroup label="External network" fieldId="plat-ext">
                      <TextInput id="plat-ext" value={externalNetwork} onChange={(_e, v) => setExternalNetwork(v)} />
                    </FormGroup>
                  )}
                  <FormGroup label="Cluster admin RBAC (comma-separated Rbac names)" fieldId="plat-rbac-admin">
                    <TextArea
                      id="plat-rbac-admin"
                      value={rbacMulti}
                      onChange={(_e, v) => setRbacMulti(v)}
                      rows={2}
                      placeholder={names(rbacs.items)
                        .map((r) => r.value)
                        .join(', ')}
                    />
                  </FormGroup>
                  <FormGroup label="Cluster operator RBAC" fieldId="plat-rbac-op">
                    <TextArea id="plat-rbac-op" value={rbacOperator} onChange={(_e, v) => setRbacOperator(v)} rows={2} />
                  </FormGroup>
                  <FormGroup label="Cluster viewer RBAC" fieldId="plat-rbac-view">
                    <TextArea id="plat-rbac-view" value={rbacViewer} onChange={(_e, v) => setRbacViewer(v)} rows={2} />
                  </FormGroup>
                </>
              )}

              {type === 'persona' && (
                <>
                  {!namespace && (
                    <RefSelect
                      id="entity"
                      label="Entity"
                      value={entityName}
                      onChange={(v) => {
                        setEntityName(v);
                        setRbacRef('');
                      }}
                      options={names(entities.items)}
                      isRequired
                    />
                  )}
                  <RefSelect id="rbac" label="RBAC" value={rbacRef} onChange={setRbacRef} options={names(rbacs.items)} isRequired />
                  <RefSelect
                    id="persona-type"
                    label="Type"
                    value={personaType}
                    onChange={setPersonaType}
                    options={PERSONA_TYPES.map((t) => ({ value: t, label: t }))}
                    isRequired
                  />
                </>
              )}

              {type === 'rbac' && (
                <RefSelect
                  id="rbac-config"
                  label="Config"
                  value={rbacConfig}
                  onChange={setRbacConfig}
                  options={names(rbacConfigs.items)}
                  isRequired
                />
              )}

              {type === 'vault' && (
                <>
                  <RefSelect
                    id="vault-rbac-config"
                    label="RBAC Config"
                    value={rbacConfig}
                    onChange={setRbacConfig}
                    options={names(rbacConfigs.items)}
                    isRequired
                  />
                  <FormGroup label="High availability" fieldId="vault-ha">
                    <Switch id="vault-ha" isChecked={haEnabled} onChange={(_e, c) => setHaEnabled(c)} />
                  </FormGroup>
                </>
              )}

              {type === 'vaultkv' && (
                <>
                  <RefSelect id="vault-ref" label="Vault" value={vaultRef} onChange={setVaultRef} options={names(vaults.items)} isRequired />
                  <FormGroup label="RBAC groups (comma-separated)" fieldId="vaultkv-rbac">
                    <TextArea id="vaultkv-rbac" value={rbacMulti} onChange={(_e, v) => setRbacMulti(v)} rows={2} />
                  </FormGroup>
                </>
              )}

              {type === 'aaporg' && (
                <>
                  <RefSelect
                    id="aap-config"
                    label="AAP Config"
                    value={aapConfig}
                    onChange={setAapConfig}
                    options={names(aapConfigs.items)}
                    isRequired
                  />
                  <FormGroup label="RBAC groups (comma-separated)" fieldId="aap-rbac">
                    <TextArea id="aap-rbac" value={rbacMulti} onChange={(_e, v) => setRbacMulti(v)} rows={2} />
                  </FormGroup>
                </>
              )}

              {type === 'quayorg' && (
                <>
                  <RefSelect
                    id="quay-config"
                    label="Quay Config"
                    value={quayConfig}
                    onChange={setQuayConfig}
                    options={names(quayConfigs.items)}
                    isRequired
                  />
                  <FormGroup label="RBAC groups (comma-separated)" fieldId="quay-rbac">
                    <TextArea id="quay-rbac" value={rbacMulti} onChange={(_e, v) => setRbacMulti(v)} rows={2} />
                  </FormGroup>
                </>
              )}

              {type === 'migration' && (
                <>
                  <RefSelect
                    id="source"
                    label="Source"
                    value={source}
                    onChange={setSource}
                    options={[
                      { value: 'vmware', label: 'VMware' },
                      { value: 'ovirt', label: 'oVirt' },
                      { value: 'openstack', label: 'OpenStack' },
                    ]}
                    isRequired
                  />
                  <FormGroup label="VM Name" isRequired fieldId="vm">
                    <TextInput id="vm" value={vmName} onChange={(_e, v) => setVmName(v)} isRequired />
                  </FormGroup>
                  <RefSelect
                    id="cloudoso"
                    label="CloudOSO"
                    value={cloudosoRef}
                    onChange={setCloudosoRef}
                    options={names(cloudosos.items)}
                    isRequired
                  />
                </>
              )}


              {type === 'hybridnetwork' && (
                <>
                  <FormGroup label="Description" fieldId="hn-desc">
                    <TextArea id="hn-desc" value={description} onChange={(_e, v) => setDescription(v)} rows={3} />
                  </FormGroup>
                  <FormGroup label="Network viewer RBAC (comma-separated)" fieldId="hn-viewers">
                    <TextArea id="hn-viewers" value={networkViewerRbac} onChange={(_e, v) => setNetworkViewerRbac(v)} rows={2} />
                  </FormGroup>
                </>
              )}

              {type === 'networkplacement' && (
                <>
                  <RefSelect id="np-network" label="Hybrid Network" value={networkRef} onChange={setNetworkRef} options={names(hybridNetworks.items)} isRequired />
                  <RefSelect
                    id="np-backend-kind"
                    label="Backend kind"
                    value={backendKind}
                    onChange={(v) => { setBackendKind(v); setBackendName(''); }}
                    options={[
                      { value: 'CloudAWS', label: 'CloudAWS' },
                      { value: 'CloudOSO', label: 'CloudOSO' },
                      { value: 'CloudVirt', label: 'CloudVirt' },
                      { value: 'PlatformOpenshift', label: 'PlatformOpenshift' },
                    ]}
                    isRequired
                  />
                  <RefSelect
                    id="np-backend-name"
                    label="Backend instance"
                    value={backendName}
                    onChange={setBackendName}
                    options={names(
                      backendKind === 'CloudOSO'
                        ? cloudososForPlacement.items
                        : backendKind === 'PlatformOpenshift'
                          ? platformsForPlacement.items
                          : cloudAwssForPlacement.items,
                    )}
                    isRequired
                  />
                  <FormGroup label="Prefixes (CIDR, comma-separated)" fieldId="np-prefixes" isRequired>
                    <TextArea id="np-prefixes" value={prefixes} onChange={(_e, v) => setPrefixes(v)} rows={2} />
                  </FormGroup>
                </>
              )}

              {type === 'hybridfabric' && (
                <>
                  <FormGroup label="Domain ASN" fieldId="hf-asn" isRequired>
                    <TextInput id="hf-asn" value={domainAsn} onChange={(_e, v) => setDomainAsn(v)} />
                  </FormGroup>
                  <FormGroup label="VNI pool start" fieldId="hf-vni-start">
                    <TextInput id="hf-vni-start" value={vniStart} onChange={(_e, v) => setVniStart(v)} />
                  </FormGroup>
                  <FormGroup label="VNI pool end" fieldId="hf-vni-end">
                    <TextInput id="hf-vni-end" value={vniEnd} onChange={(_e, v) => setVniEnd(v)} />
                  </FormGroup>
                </>
              )}

              {type === 'cloudgateway' && (
                <>
                  <RefSelect
                    id="cg-cloud"
                    label="Cloud"
                    value={cloudProvider}
                    onChange={setCloudProvider}
                    options={[
                      { value: 'aws', label: 'AWS' },
                      { value: 'openstack', label: 'OpenStack' },
                      { value: 'openshift', label: 'OpenShift' },
                    ]}
                    isRequired
                  />
                  <FormGroup label="Region" fieldId="cg-region" isRequired>
                    <TextInput id="cg-region" value={region} onChange={(_e, v) => setRegion(v)} />
                  </FormGroup>
                  <FormGroup label="Domain ASN" fieldId="cg-asn">
                    <TextInput id="cg-asn" value={domainAsn} onChange={(_e, v) => setDomainAsn(v)} />
                  </FormGroup>
                  <RefSelect
                    id="cg-fabric"
                    label="Fabric"
                    value={fabricRef}
                    onChange={setFabricRef}
                    options={
                      names(fabrics.items).length
                        ? names(fabrics.items)
                        : [{ value: 'lab-fabric', label: 'lab-fabric' }]
                    }
                    isRequired
                  />
                </>
              )}

              {type === 'transportlink' && (
                <>
                  <RefSelect
                    id="tl-fabric"
                    label="Fabric"
                    value={fabricRef}
                    onChange={setFabricRef}
                    options={
                      names(fabrics.items).length
                        ? names(fabrics.items)
                        : [{ value: 'lab-fabric', label: 'lab-fabric' }]
                    }
                    isRequired
                  />
                  <RefSelect id="tl-gw" label="Cloud Gateway" value={gatewayRef} onChange={setGatewayRef} options={names(gateways.items)} isRequired />
                </>
              )}

              {type === 'uihealthchecker' && (
                <>
                  <FormGroup label="URL" fieldId="uh-url" isRequired>
                    <TextInput id="uh-url" value={healthUrl} onChange={(_e, v) => setHealthUrl(v)} />
                  </FormGroup>
                  <FormGroup label="Group" fieldId="uh-group">
                    <TextInput id="uh-group" value={healthGroup} onChange={(_e, v) => setHealthGroup(v)} />
                  </FormGroup>
                  <FormGroup label="Display name / description" fieldId="uh-desc">
                    <TextInput id="uh-desc" value={description} onChange={(_e, v) => setDescription(v)} />
                  </FormGroup>
                </>
              )}

              <ActionGroup>
                <Button variant="primary" type="submit" isLoading={submitting} isDisabled={!canSubmit()}>
                  Create
                </Button>
                <Button variant="link" onClick={onCancel}>
                  Cancel
                </Button>
              </ActionGroup>
            </Form>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
