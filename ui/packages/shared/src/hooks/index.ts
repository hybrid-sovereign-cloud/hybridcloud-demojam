export {
  configureK8sClient,
  createDashboardResource,
  createNamespaceSecret,
  deleteDashboardResource,
  forceReconcile,
  getK8sClientConfig,
  updateDashboardResource,
  useCanI,
  useK8sResource,
  useK8sResourceList,
} from './k8s';
export type {
  K8sApiStyle,
  K8sClientConfig,
  UseK8sResourceListOptions,
  UseK8sResourceListResult,
  UseK8sResourceOptions,
  UseK8sResourceResult,
} from './k8s';
export { useOverviewCRs } from './overviewCrs';
export type { OverviewCRsResult } from './overviewCrs';
export {
  usePermissions,
  useCanListKind,
  useCanListKindCluster,
  configurePermissionsClient,
} from './permissions';
export type { K8sVerb, PermissionCheck, UsePermissionsResult } from './permissions';
export { useEntityNamespace } from './entityNamespace';
export type { UseEntityNamespaceOptions, UseEntityNamespaceResult } from './entityNamespace';
