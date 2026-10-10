# Hybrid Sovereign UI Rollout — OCP 4.x Mockups

**Audience:** UI engineers, principal architects  
**Status:** Design reference for Phase 3 rollout  
**Codebase:** `hybridcloud/ui/` (PatternFly 5 monorepo)

---

## Surfaces

| Surface | Package | OCP 4.x patterns |
|---------|---------|------------------|
| Admin standalone | `admin-dashboard` | Left nav, list/detail + YAML tab, status icons, topology on Overview |
| Tenant standalone | `tenant-dashboard` | Entity-scoped nav filtered by SAR; self-service wizards |
| Admin console plugin | `admin-console-plugin` | `consoleFetch` + dynamic plugin SDK; sovereign-admin-plugin ID |
| Tenant console plugin | `tenant-console-plugin` | Tenant perspective; sovereign-tenant-plugin ID |

---

## Admin Overview (platform topology)

```
┌─────────────────────────────────────────────────────────────────┐
│ Hybrid Sovereign Admin                              [dark/light]│
├──────────┬──────────────────────────────────────────────────────┤
│ Overview │  Platform Overview                                   │
│ Entities │  ┌─────────┐ ┌─────────┐ ┌─────────┐                 │
│ Teams    │  │Entities │ │ Teams   │ │Platforms│  ...summary cards│
│ ...      │  └─────────┘ └─────────┘ └─────────┘                 │
│ Services │  Platform Topology                                   │
│          │  [Entity: acme-corp]                                 │
│          │    └─ CloudOSO (ready) ── Platform: ocp-ses11       │
│          │    └─ CloudAWS (ready)  ── Platform: ocp-ses10       │
│          │         └─ Team: data-team ── Project: api-services  │
└──────────┴──────────────────────────────────────────────────────┘
```

Color coding: green = `status.ready`, blue = reconciling, orange = pending, red = failed.

---

## Tenant Overview (RBAC-filtered)

Same layout as admin but:

- Namespace derived from OIDC groups via `useEntityNamespace()`
- Nav items hidden when `useCanListKind()` denies `list`
- Topology omits unauthorized kinds (not greyed placeholders)
- Quick Actions: Create Team, Project, CloudOSO, CloudAWS, Assignment

---

## Resource list + detail (OCP console parity)

```
Breadcrumb: Home / Entities / acme-corp
┌──────────────────────────────────────────────────┐
│ Entities                          [Create] [Refresh]│
├──────────┬─────────┬────────┬───────────────────┤
│ Name     │ Status  │ Ready  │ Last Reconciled   │
│ acme-corp│ ready   │ ✓      │ 2026-07-14T...    │
└──────────┴─────────┴────────┴───────────────────┘

Detail tabs: [Details] [YAML] [Events]
Tool RBAC section: RbacGroupsEditor (multi-select Keycloak groups)
```

---

## Multi-cloud topology legend

| Backend | Node shape | Example |
|---------|------------|---------|
| CloudOSO | Hexagon | ses lab OpenStack |
| CloudAWS | Hexagon | AWS account VPC |
| PlatformOpenshift | Circle | ocp-ses10/11 |
| VMware (CNV/MTV) | Square | migration source VMs |

Dark/light: standalone uses `SovereignThemeProvider`; console plugins inherit OCP PF CSS variables.

---

## Implementation mapping

| Mockup element | Shared component |
|----------------|------------------|
| Topology graph | `EntityTopology` |
| Nav RBAC filter | `usePermissions` / `useCanListKind` |
| Entity namespace | `useEntityNamespace` |
| Tool RBAC edit | `RbacGroupsEditor` |

See `packages/shared/src/` for implementations.
