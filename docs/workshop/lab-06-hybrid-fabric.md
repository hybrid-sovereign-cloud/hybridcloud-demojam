# Lab 6 — Hybrid Fabric (EVPN) showcase

Build entity-isolated EVPN fabrics: **Acme** (HCP + RHOSO) and **Chad** (dual HCP), using dropdown-driven admin UI and PlatformOpenshift fabric attach.

**Time:** ~2–4 hours (HCP install dominates).  
**Prereqs:** Labs 1–3 complete (or CloudVirt Ready); central cluster healthy; RHOSO `clouds.yaml` available locally (never commit it).

**Design reference:** [`design/fabric.md`](../../design/fabric.md) (§8 layers, §10 realization, §18 UI dropdowns).

## Mental model

```text
HybridFabric (entityRefs) → CloudGateway → TransportLink
        ↓
HybridNetwork (VNI/RT allocated) → NetworkPlacement → CUDN / Neutron --evpn-vni
```

| Fabric | Entity | Spokes | ASN / VNI pool |
|--------|--------|--------|----------------|
| `acme-fabric` | `acme-corp` | HCP1 + CloudOSO `oso1` | 65010 / 51000–51127 |
| `chad-fabric` | `chad` | HCP2 + HCP3 | 65020 / 52000–52127 |

Isolation rule: Chad must **never** join Acme fabric (and vice versa). UI dropdowns enforce entity tagging.

## Step 0 — Secrets (no Git)

```bash
# RHOSO admin clouds.yaml (local file only)
oc -n entity-acme-corp create secret generic oso-clouds-oso1 \
  --from-file=clouds.yaml="$HOME/Downloads/cloud-local.yaml"
```

## Step 1 — Register CloudOSO

```yaml
apiVersion: hybridsovereign.redhat/v1alpha1
kind: CloudOSO
metadata:
  name: oso1
  namespace: entity-acme-corp
spec:
  project: oso1
  baseDomain: lab.example.com
  credentialsSecretRef:
    name: oso-clouds-oso1
  externalNetwork: internet
```

Wait until `oc get cloudoso oso1 -n entity-acme-corp` shows Ready.

> Lab RHOSO on this workshop often uses external network name **`public`** — set `spec.externalNetwork: public` if `internet` is missing (`openstack network list`).

## Step 2 — Create fabrics (admin UI preferred)

**UI path (dropdowns §18):** Admin → Hybrid Fabrics → Create → **EntityMultiSelect** tag `acme-corp` (then repeat for Chad with entity `chad`).

**CLI path:** apply samples:

```bash
oc apply -f samples/hybridvpc/acme-chad-fabric.yaml
oc get hybridfabric -n sovereign-cloud
# expect acme-fabric + chad-fabric Ready; numbering ConfigMaps fabric-numbering-*
```

Confirm ASN/VNI pools are disjoint and `entityRefs` match.

## Step 3 — PlatformOpenshift with fabric attach

**UI:** Create PlatformOpenshift type **hosted** (not AWS). Fabric step shows **JoinPolicySelect** + **FabricMultiSelect** (only fabrics that tag your entity).

Apply platforms:

```bash
# Ensure Entity/chad namespace exists (created by Entity reconcile)
oc apply -f samples/hybridvpc/acme-chad-platforms.yaml
oc get platformopenshift -A
```

- `entity-acme-corp/hcp1` → `acme-fabric`
- `entity-chad/hcp2`, `hcp3` → `chad-fabric`
- Optional: `ocp-oso1` on CloudOSO (long-running)

## Step 4 — Gateways and TransportLinks

If `manageGatewayAndLink: false`, apply gateways/links from `acme-chad-fabric.yaml` (already in that sample) or create via admin UI:

- **FabricSelect** → **PlatformOpenshiftSelect** (hosted/openstack only) or **CloudOSOSelect**
- AWS CloudGateway for EVPN is rejected by automation

```bash
oc get cloudgateway,transportlink -n sovereign-cloud
```

**Negative test:** a TransportLink binding a Chad gateway to `acme-fabric` must fail.

## Step 5 — Tenant networks and placements

**UI:** Tenant → Hybrid Networks → Create → NetworkPlacement with **BackendSelect** (never lists AWS PlatformOpenshift; Chad backends hidden from Acme).

```bash
oc apply -f samples/hybridvpc/acme-chad-networks.yaml
oc get hybridnetwork,networkplacement -A
```

Inspect allocated VNI/RT (read-only — tenants never pick VNIs):

```bash
oc get hybridnetwork acme-core -n entity-acme-corp -o yaml | grep -E 'vni:|canonicalRt:|fabric:'
oc get hybridnetwork chad-app -n entity-chad -o yaml | grep -E 'vni:|canonicalRt:|fabric:'
```

## Step 6 — Verify EVPN

### HCP / Chad (primary lab proof)

On HCP2/HCP3 (when Ready): CUDN / FRR presence; BGP EVPN toward fabric RR intent.

```bash
# From hub — membership and placement status
oc get networkplacement -A -o custom-columns=NS:.metadata.namespace,NAME:.metadata.name,READY:.status.ready,BACKEND:.status.backendApplied,MSG:.status.message
```

**Pass:** Chad placements show backend applied / validated (or EvpnPrepPending until spoke kubeconfig); HCP2↔HCP3 path documented in design §13.

### RHOSO / Acme OSO (FR6 native OVN EVPN)

RHOSO **18.0.21 FR6+** exposes `openstack router create --evpn-vni`. If the lab cloud lacks EVPN Neutron extensions:

```text
NetworkPlacement/CloudGateway status → Fr6EvpnUnavailable (fail closed)
Do NOT enable deprecated ovn-bgp-agent for new work.
```

When FR6 is present: placement creates EVPN router with HybridNetwork VNI and advertises the subnet (design §10.3).

### Isolation

- Pod/VM on Chad prefixes must not reach Acme `10.110.0.0/16`
- Acme tenant BackendSelect must not offer Chad HCPs

## UI checklist (§18)

- [ ] HybridFabric create uses EntityMultiSelect (no free-text entity names)
- [ ] PlatformOpenshift type=aws hides fabric panel + shows static note
- [ ] BackendSelect never lists AWS PlatformOpenshift for EVPN placement
- [ ] Chad fabric options disabled for Acme entity surfaces

## Cleanup order

1. Delete NetworkPlacements → HybridNetworks  
2. Delete TransportLinks → CloudGateways  
3. Delete PlatformOpenshift clusters (wait teardown)  
4. Delete HybridFabrics (blocked if VNIs still allocated)  
5. Delete CloudOSO / Secret  

→ Back to [Workshop README](README.md)
