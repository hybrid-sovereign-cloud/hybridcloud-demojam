# UI usage

Two surfaces:

| UI | Who | Where |
|----|-----|-------|
| **Admin dashboard / Admin console plugin** | Platform admins | Cluster-wide entities, clouds, services health |
| **Tenant dashboard / Tenant console plugin** | Tenant users | Resources inside **their** `entity-*` namespace |

Both create the same CRs the CLI would — prefer UI when available; secrets still never go into Git.

## Simple flow

```text
Log in (SSO)
  → pick Entity (admin) or land in your tenant (tenant)
  → Create → Cloud* (upload / paste creds → Secret + CR)
  → wait Ready
  → Create → PlatformOpenshift
  → wait Provisioned
  → Teams / Projects / Assignments
```

## Admin console

Typical nav:

1. **Overview** — platform health summary  
2. **Entities** — list / create Entity; open detail  
3. **Clouds** — CloudAWS / CloudOSO / CloudVirt across tenants  
4. **Platforms** — PlatformOpenshift list / detail (console URL, status)  
5. **Teams / Assignments** — cross-tenant view when permitted  
6. **Services / UI Health** — AAP, Quay, Vault, health checkers  

### Create from Admin

Use **Create** (or entity detail → create child):

| Form | Creates |
|------|---------|
| Entity | Entity in `sovereign-cloud` |
| CloudAWS | Secret + CloudAWS in chosen entity NS |
| CloudOSO | Secret (`clouds.yaml`) + CloudOSO |
| CloudVirt | CloudVirt (+ vault path) |
| Platform OpenShift | PlatformOpenshift (`openstack` / `aws` / `hosted`) |
| Team / Project / Assignment | Tenant CRs |

Fill **credentials** in the form — UI writes a Secret and sets `credentialsSecretRef`. Do not paste long-lived keys into Git samples.

## Tenant console

Scoped to one entity:

1. **Overview** — your clouds / platforms  
2. **Cloud AWS / OSO / Virt** — list, detail, create  
3. **Platforms** — OpenShift spokes you can manage  
4. **Teams / Projects / Assignments**  
5. **RBAC / Personas**  
6. **Vault / Quay / AAP org** — plugin self-service  

### Create from Tenant

Same CR kinds as admin, but namespace is fixed to your entity. Platform type picker:

- **openstack** → select CloudOSO  
- **aws** → select CloudAWS  
- **hosted** → select CloudVirt  

## Status in the UI

Detail pages show `status.ready`, messages, and links (console URL). If stuck:

1. Refresh detail  
2. Check AAP job link if shown  
3. Fall back to `oc describe` on the CR  

## What not to do in the UI

- Do not delete `sovereign-*` namespaces  
- Do not store credentials only in browser notes — use Secret / Vault  
- After bootstrap, prefer GitOps for **platform** installs; UI is for **tenant CRs** and day-2  

## Related

- [CRD usage](../crds/README.md)  
- [Workshop](../../workshop/README.md)  
- Specs 018–021 under `specs/`
