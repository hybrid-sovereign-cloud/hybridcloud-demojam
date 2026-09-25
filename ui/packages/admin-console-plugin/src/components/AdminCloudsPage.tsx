import '../consoleK8sBootstrap';
import * as React from 'react';
import { PageSection } from '@patternfly/react-core';
import { useTranslation } from '@hybridsovereign/shared';
import { AdminResourceListPage } from './AdminResourceListPage';
import '@hybridsovereign/shared/styles/openshift.css';

const AdminCloudsPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <PageSection className="sc-console-page">
      <div className="sc-page">
        <AdminResourceListPage
          kind="CloudOSO"
          title={t('nav.cloudEnvironments')}
          subtitle={t('pages.cloudEnvironmentsSubtitle')}
          secondaryKind="CloudAWS"
          tertiaryKind="CloudVirt"
          listPath="/hybridsovereign/clouds/cloudoso"
          secondaryListPath="/hybridsovereign/clouds/cloudaws"
          tertiaryListPath="/hybridsovereign/clouds/cloudvirt"
        />
      </div>
    </PageSection>
  );
};

export default AdminCloudsPage;
