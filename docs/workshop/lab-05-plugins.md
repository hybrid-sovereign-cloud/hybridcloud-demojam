# Lab 5 — Tenant plugins: Vault, AAP, Quay

**Time:** ~20 minutes · **Prerequisite:** [Lab 3](lab-03-identity.md)

Your tenant needs somewhere to keep secrets, somewhere to run automation and
somewhere to push images. All three follow one pattern, so learning it once
covers all of them.

---

## The Config / Org pattern

Every integration in this platform splits into two kinds:

```text
  <Tool>Config          PLATFORM, in sovereign-cloud-plugins
  ───────────────       "the hub's Vault / AAP / Quay is at this URL,
                         authenticating this way, with this admin credential"
                        One per hub. Created by ZTP. You only read it.
         │
         │  named by spec.<tool>Config
         ▼
  <Tool>Org             TENANT, in entity-<name>
  ───────────────       "give this tenant its own organisation / mount in
                         that tool, and map these Rbac groups to roles in it"
                        One per tenant. This is what you create.
```

Why split: the admin credential for Quay lives in exactly one object that no
tenant can read, while tenants still self-serve their own org. Tenant CRs
never carry credentials — they carry a *reference* and a list of Rbac names.

Check the platform side first:

```bash
oc get rbacconfig,aapconfig,quayconfig -n sovereign-cloud-plugins
```

All three must be ready before anything below will work.

---

## Vault — tenant secrets

`Vault` deploys a Vault instance for the tenant, OIDC-wired to Keycloak via an
`RbacConfig`. `VaultKV` then creates a KV mount inside it with per-group
access.

```yaml
# lab-vault.yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: Vault
metadata:
  name: mycorp-vault
  namespace: entity-mycorp
spec:
  # true = 3 replicas on integrated raft. false = single replica, file storage.
  # Only raft is genuinely shared storage; `ha: true` with file storage leaves
  # replicas uninitialised, so the operator uses raft whenever ha is true.
  ha: true
  # Gives tenant users SSO login to their own Vault.
  rbacConfig: keycloak-sovereign-tenants-services
---
apiVersion: hybridsovereign.redhat/v1alpha1
kind: VaultKV
metadata:
  name: mycorp-app-secrets
  namespace: entity-mycorp
spec:
  # A Vault CR in this same namespace.
  vault: mycorp-vault
  # Each list holds Rbac CR names from Lab 3 — never Keycloak paths.
  vaultAdminRbac:
    - mycorp-platform-admins
  vaultOpsRbac:          # full CRUD on secrets, no policy changes
    - mycorp-operators
  vaultDeveloperRbac:    # read plus create new secrets
    - mycorp-developers
  vaultReaderRbac:       # read-only
    - mycorp-viewers
```

```bash
oc apply -f lab-vault.yaml
oc get vault,vaultkv -n entity-mycorp -w
```

Vault is the slowest object in this lab (a StatefulSet plus init and unseal).
Allow a few minutes.

**Pass:** `Vault` reports a route URL in status; `VaultKV` reports ready.

```bash
oc get vault mycorp-vault -n entity-mycorp -o jsonpath='{.status.url}{"\n"}'
```

The four access levels map to real Vault policies on that mount. This is the
payoff of Lab 3: you expressed "developers can read and add secrets but not
change policy" by naming an Rbac CR.

---

## AAPOrg — tenant automation

```yaml
# lab-aaporg.yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: AAPOrg
metadata:
  name: mycorp-automation
  namespace: entity-mycorp
spec:
  # The platform AAPConfig — where AAP lives.
  aapConfig: aap-sovereign-services
  aapAdminRbac:
    - mycorp-platform-admins
  aapJobExecutorRbac:
    - mycorp-operators
  aapViewerRbac:
    - mycorp-viewers
```

Creates an AAP organisation for the tenant and maps the groups onto AAP
organisation roles, so the tenant's operators can launch jobs without seeing
anyone else's.

---

## QuayOrg — tenant registry

```yaml
# lab-quayorg.yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: QuayOrg
metadata:
  name: mycorp-registry
  namespace: entity-mycorp
spec:
  quayConfig: quay-sovereign-services
  quayAdminRbac:
    - mycorp-platform-admins
  quayCreatorRbac:    # may create repositories
    - mycorp-developers
  quayMemberRbac:     # pull/push to existing repositories
    - mycorp-operators
```

```bash
oc apply -f lab-aaporg.yaml -f lab-quayorg.yaml
oc get aaporg,quayorg -n entity-mycorp -w
```

**Pass:** both ready. `QuayOrg` status shows the created organisation name,
`AAPOrg` shows the AAP organisation ID.

---

## Verifying through the tools themselves

Worth doing once, because it proves the CRs reached the real systems rather
than just flipping a status field:

```bash
# Routes for the three tools
oc -n quay    get route quay-quay -o jsonpath='{.spec.host}{"\n"}'
oc -n aap     get route aap       -o jsonpath='{.spec.host}{"\n"}'
oc -n keycloak get route keycloak -o jsonpath='{.spec.host}{"\n"}'
```

Log in to Quay as an admin and the `mycorp` organisation is there. Log in to
Keycloak and `mycorp/mycorp-developers` is a real subgroup.

---

## Troubleshooting

Every one of these CRs drives an AAP job. When something stalls, the job
output is the real error message:

```bash
oc get quayorg mycorp-registry -n entity-mycorp \
  -o jsonpath='{.status.aapJob.url}{"\n"}'
```

Open that URL in AAP. The CR `status.message` is a summary; the job log is the
detail.

---

Your tenant is now fully formed on the hub: identity, organisation, secrets,
automation and a registry. Time to give it some infrastructure.

→ [Lab 6 — Register a cloud](lab-06-register-cloud.md)
