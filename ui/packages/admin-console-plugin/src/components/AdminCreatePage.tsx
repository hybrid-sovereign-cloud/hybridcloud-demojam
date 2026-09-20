import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, PageSection } from '@patternfly/react-core';
import { CreateResourceForm, SelfServiceFormType,
  useTranslation,
} from '@hybridsovereign/shared';
import '@hybridsovereign/shared/styles/openshift.css';

const LIST_PATH: Record<string, string> = {
  entity: '/hybridsovereign/entities',
  persona: '/hybridsovereign/personas',
  hybridfabric: '/hybridsovereign/networking/fabrics',
  cloudgateway: '/hybridsovereign/networking/gateways',
  transportlink: '/hybridsovereign/networking/transport',
  uihealthchecker: '/hybridsovereign/networking/uihealth',
};

const SUPPORTED_FORMS = new Set<string>([
  'entity',
  'persona',
  'hybridfabric',
  'cloudgateway',
  'transportlink',
  'uihealthchecker',
]);

const AdminCreatePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { kind } = useParams<{ kind: string }>();
  const formType = (kind ?? 'entity') as SelfServiceFormType;
  const listPath = LIST_PATH[formType] ?? '/hybridsovereign/overview';

  if (!SUPPORTED_FORMS.has(formType)) {
    return (
      <PageSection className="sc-console-page">
        <Alert variant="warning" title="Unsupported create form" isInline>
          Unknown kind: {kind}
        </Alert>
      </PageSection>
    );
  }

  return (
    <PageSection className="sc-console-page">
      <div className="sc-page">
        <CreateResourceForm
          formType={formType}
          namespace={
            formType === 'entity' ||
            formType === 'hybridfabric' ||
            formType === 'cloudgateway' ||
            formType === 'transportlink' ||
            formType === 'uihealthchecker'
              ? 'sovereign-cloud'
              : ''
          }
          listPath={listPath}
          onSuccess={(path) => navigate(path)}
          onCancel={() => navigate(listPath)}
        />
      </div>
    </PageSection>
  );
};

export default AdminCreatePage;
