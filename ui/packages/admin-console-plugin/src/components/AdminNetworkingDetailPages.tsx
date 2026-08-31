import * as React from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { PageSection } from '@patternfly/react-core';
import { HybridSovereignKind, ResourceDetail } from '@hybridsovereign/shared';
import '@hybridsovereign/shared/styles/openshift.css';

const ENTITY_NS = 'sovereign-cloud';

function makeClusterDetailPage(
  kind: HybridSovereignKind,
  title: string,
  listPath: string,
): React.FC {
  const Page: React.FC = () => {
    const history = useHistory();
    const { name } = useParams<{ name: string }>();
    const resourceName = name ? decodeURIComponent(name) : '';

    return (
      <PageSection className="sc-console-page">
        <div className="sc-page">
          <ResourceDetail
            kind={kind}
            name={resourceName}
            namespace={ENTITY_NS}
            parentTitle={title}
            parentPath={listPath}
            onBack={() => history.push(listPath)}
            onDeleted={() => history.push(listPath)}
          />
        </div>
      </PageSection>
    );
  };
  Page.displayName = `Admin${kind}DetailPage`;
  return Page;
}

export const AdminHybridFabricDetailPage = makeClusterDetailPage(
  'HybridFabric',
  'Hybrid Fabrics',
  '/hybridsovereign/networking/fabrics',
);
export const AdminCloudGatewayDetailPage = makeClusterDetailPage(
  'CloudGateway',
  'Cloud Gateways',
  '/hybridsovereign/networking/gateways',
);
export const AdminTransportLinkDetailPage = makeClusterDetailPage(
  'TransportLink',
  'Transport Links',
  '/hybridsovereign/networking/transport',
);
export const AdminUIHealthCheckerDetailPage = makeClusterDetailPage(
  'UIHealthChecker',
  'UI Health',
  '/hybridsovereign/networking/uihealth',
);
