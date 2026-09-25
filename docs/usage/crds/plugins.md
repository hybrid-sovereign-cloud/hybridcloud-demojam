# Plugin CRs (short)

Plugins extend an entity or platform. Config CRs usually live in `sovereign-cloud-plugins`; org/tenant CRs in `entity-*`.

| Kind | Purpose |
|------|---------|
| **AAPConfig** / **AAPOrg** | Ansible Automation Platform org for tenant |
| **QuayConfig** / **QuayOrg** | Registry org |
| **RbacConfig** | Platform IdP / RBAC plugin settings |
| **Vault** / **VaultKV** | Tenant Vault mount / keys |
| **Iaac** | Git sync of tenant IaC |
| **HybridNetwork** / **NetworkPlacement** / **TransportLink** / **CloudGateway** / **HybridFabric** | Hybrid networking (advanced) |
| **OpenStackMigration** | VM migration (parked in some labs) |
| **UIHealthChecker** | UI smoke health |

## Flow

```text
Platform plugin Config (hub)
        → Entity Org CR (entity-*)
        → operator → AAP / Quay / Vault job
```

Create Config once per platform; create Org per tenant as needed. Prefer the Admin / Tenant UI forms when available — see [UI usage](../ui/README.md).

Specs: [specs/](../../../specs/README.md) (010–013, networking specs).
