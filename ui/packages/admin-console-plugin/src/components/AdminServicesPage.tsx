import * as React from 'react';
import { PageSection, Tabs, Tab, TabTitleText } from '@patternfly/react-core';
import { PageHeader, useTranslation } from '@hybridsovereign/shared';
import { AdminResourceListPage } from './AdminResourceListPage';
import '@hybridsovereign/shared/styles/openshift.css';

const AdminServicesPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = React.useState<string | number>(0);

  return (
    <PageSection className="sc-console-page">
      <div className="sc-page">
        <PageHeader
          title={t('nav.serviceUrls')}
          subtitle="Platform service resources and configuration health"
          breadcrumbs={[
            { label: t('nav.sovereignCloud') },
            { label: 'Platform' },
            { label: t('nav.serviceUrls') },
          ]}
        />
        <Tabs activeKey={activeTab} onSelect={(_e, key) => setActiveTab(key)} mountOnEnter unmountOnExit>
          <Tab eventKey={0} title={<TabTitleText>AAP</TabTitleText>}>
            <AdminResourceListPage
              kind="AAPOrg"
              title="AAP Organizations"
              secondaryKind="AAPConfig"
              listPath="/hybridsovereign/services/aaporgs"
              secondaryListPath="/hybridsovereign/services/aapconfigs"
              hideHeader
              enabled={activeTab === 0}
            />
          </Tab>
          <Tab eventKey={1} title={<TabTitleText>Quay</TabTitleText>}>
            <AdminResourceListPage
              kind="QuayOrg"
              title="Quay Organizations"
              secondaryKind="QuayConfig"
              listPath="/hybridsovereign/services/quayorgs"
              secondaryListPath="/hybridsovereign/services/quayconfigs"
              hideHeader
              enabled={activeTab === 1}
            />
          </Tab>
          <Tab eventKey={2} title={<TabTitleText>Vault</TabTitleText>}>
            <AdminResourceListPage
              kind="Vault"
              title="Vault Instances"
              secondaryKind="VaultKV"
              listPath="/hybridsovereign/services/vaults"
              secondaryListPath="/hybridsovereign/services/vaultkvs"
              hideHeader
              enabled={activeTab === 2}
            />
          </Tab>
        </Tabs>
      </div>
    </PageSection>
  );
};

export default AdminServicesPage;
