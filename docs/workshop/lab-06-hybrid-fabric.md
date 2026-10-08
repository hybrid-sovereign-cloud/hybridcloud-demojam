# Lab 6 — Hybrid Fabric (EVPN) showcase

Connect tenant VMs on the hub (OpenShift Virtualization) and tenant VMs on an OpenStack site into one routed tenant network, and show that a second tenant's network on the same fabric stays isolated.

**Time:** ~1–2 hours on a prepared hub (the first OpenStack data plane rollout adds ~30 minutes).
**Prereqs:** Labs 1–2 (Track 0 and Tracks B/C); a RHOSO 18.0.21+ site registered as CloudInfrastructure `oso1` with its data plane NodeSets; RHOSO `clouds.yaml` only on your workstation (never commit it).

**Design reference:** [`design/fabric.md`](../../design/fabric.md) (§1.1 tenancy, §7 object model, §10.2 hub spoke, §21 reference implementation). Live verification record: [`design/fabric-verify.md`](../../design/fabric-verify.md).

## Mental model

```text
platform (sovereign-cloud)                                 tenant (entity-<name>)
  HybridFabric platform-fabric  (one per hub: ASN, VNI pool, underlay, border gateway VM)
  CloudInfrastructure oso1 / hub-virt  ──cloudRef──►  CloudOSO oso1 / CloudVirt local-virt
  CloudGateway acme-oso1-gw / hub-virt-gw  (one per site, cloudRef)
                                                       HybridNetwork acme-core   (VRF: VNI + RT from the fabric)
                                                         └ NetworkPlacement acme-core-hub  → CloudVirt  → Layer2 CUDN on the hub
                                                         └ NetworkPlacement acme-core-oso1 → CloudOSO   → Neutron network + EVPN router
```

One fabric serves every tenant. A tenant network (`HybridNetwork`) is a VRF: one VNI and route target (RT) allocated by the platform. Tenants share the border gateway (BGW) and the site tunnels; isolation is by RT. Hosted clusters (`PlatformOpenshift`) never join the fabric ([Lab 0](lab-00-guardrails.md#tenants-cannot-attach-their-own-clusters-to-the-fabric)); placements go on cloud projects only: CloudOSO, CloudVirt or CloudAWS (AWS has no EVPN path yet and is rejected by the automation).

| Network | Entity | VNI / RT | L2VNI (hub macVRF) | Placements |
|---------|--------|----------|--------------------|------------|
| `acme-core` | `acme-corp` | 51001 / `65010:51001` | 151001 | hub VMs `10.110.2.0/24` (CloudVirt `local-virt`), RHOSO VMs `10.110.1.0/24` (CloudOSO `oso1`) |
| `chad-app` | `chad` | 52000 / `65010:52000` | 152000 | hub VMs `10.120.2.0/24` (CloudVirt `local-virt`) |

VNIs come from the fabric ledger; the values above are the reference hub's. Tenants never choose them.

## Step 0 — Platform prerequisites (platform admin)

These belong to the platform and are owned by GitOps or seeded once; the fabric jobs only check them.

1. **Hub network operator with FRR and route advertisements.** Changing it rolls `ovnkube-node` on every hub node (which also runs AAP, Argo and the operators), so it is cluster configuration, never patched by a job:

   ```bash
   oc get network.operator cluster -o jsonpath='{.spec.additionalRoutingCapabilities}{"  "}{.spec.defaultNetwork.ovnKubernetesConfig.routeAdvertisements}{"\n"}'
   # {"providers":["FRR"]}  Enabled
   oc get pods -n openshift-frr-k8s -o wide        # one frr-k8s pod per node, Running
   oc get crd vteps.k8s.ovn.org routeadvertisements.k8s.ovn.org
   ```

   Until then the hub CloudGateway stays at `PendingPrereq`.
2. **Vault entries** (paths only; values are generated or seeded by the platform team): `fabric/platform-fabric/bgw` (BGW WireGuard pair and SSH key pair), `fabric/wireguard/acme-oso1-gw` (site gateway pair), `oso/oso1/mgmt-kubeconfig` (key `kubeconfig` for the RHOSO management cluster).
3. **Cloud infrastructure registered** (Lab 2 Track 0): `oso1` (openstack) and `hub-virt` (openshift) Ready in `sovereign-cloud`.

## Step 1 — Tenant cloud projects

Placements need a cloud project in the tenant's namespace. On the reference hub:

```bash
oc get cloudoso oso1 -n entity-acme-corp -o custom-columns=NAME:.metadata.name,CLOUDREF:.spec.cloudRef.name,READY:.status.ready
oc get cloudvirt local-virt -n entity-acme-corp -o custom-columns=NAME:.metadata.name,CLOUDREF:.spec.cloudRef.name,READY:.status.ready
oc get cloudvirt local-virt -n entity-chad      -o custom-columns=NAME:.metadata.name,CLOUDREF:.spec.cloudRef.name,READY:.status.ready
```

A CloudOSO that predates CloudInfrastructure is moved over with `samples/cloudoso/oso1-cloudref.yaml` (sets `cloudRef: oso1`, removes the site fields that moved).

## Step 2 — The platform fabric

**UI:** Admin → Hybrid Fabrics → Create. Entities come from **EntityMultiSelect**; underlay type `localnet` shows the hub VTEP block and hub leg fields.

**GitOps / CLI:** the reference fabric is `gitops/apps/platform-fabric/templates/fabrics.yaml` (sync wave 20). `samples/hybridvpc/acme-chad-fabric.yaml` has the same fabric plus the hub-side objects of this lab (CloudInfrastructure `hub-virt`, CloudGateway `hub-virt-gw`, Entity `chad` and its CloudVirt) for a hub without the GitOps app.

```yaml
spec:
  domainAsn: 65010
  entityRefs: [{name: acme-corp}, {name: chad}]
  vniPool: {start: 51000, end: 52127}
  underlay:
    type: localnet                 # BGW hub leg on an OVN-K localnet network on br-ex
    physicalNetworkName: physnet
    nadName: fabric-localnet
    cidr: 192.168.64.0/18          # all underlay addresses come from here
    hubVtepBlock: 192.168.65.0/24  # hub node VTEPs
    hubLegAddress: 192.168.65.1/24 # BGW on the hub leg
  borderGateway:
    name: fabric-bgw
    loopback: 10.255.10.10
    wireguard: {address: 10.254.254.1/24, listenPort: 51820}
  transportDefaults: {mtu: 1442, defaultTunnelType: none}
```

```bash
oc get hybridfabric platform-fabric -n sovereign-cloud \
  -o custom-columns=READY:.status.ready,BGW:.status.bgwEndpoint,PEERS:.status.bgwPeerCount,VNIS:.status.allocatedVniCount
oc get vm,vmi -n sovereign-cloud fabric-bgw
oc get net-attach-def -n sovereign-cloud
```

**Pass:** fabric Ready; VM `fabric-bgw` Running with three NICs (pod network, underlay, hub leg `hubleg`).

There is no per-tenant fabric and no cluster-attach step: earlier versions of this lab created one fabric per entity and joined hosted clusters to it; both are gone.

## Step 3 — (removed)

Hosted clusters are not attached to the fabric. See [Lab 0](lab-00-guardrails.md#tenants-cannot-attach-their-own-clusters-to-the-fabric) for why.

## Step 4 — One CloudGateway per site

**UI:** Admin → Cloud Gateways → Create: **FabricSelect**, then **CloudInfrastructureSelect** (the site), transport `none` or `wireguard`.

Both gateways are in `gitops/apps/platform-fabric/templates/gateways-links.yaml` (wave 50):

| Gateway | `cloudRef` | Transport | What the job builds |
|---------|------------|-----------|---------------------|
| `acme-oso1-gw` | `oso1` (openstack) | `wireguard` | Site gateway VM `fabric-gw-oso1` on the RHOSO management cluster (bridged to the compute underlay `192.168.80.0/24`, WireGuard to the BGW over TLS 443 via the hub ingress), then the EDPM landing: NetConfig network `fabric`, and each NodeSet from `oso1.spec.openstack.dataplaneNodeSetRefs` one at a time (`frr` + `neutron-ovn` with `ovn-evpn`) |
| `hub-virt-gw` | `hub-virt` (openshift) | `none` | Hub node VTEPs: DaemonSet `platform-fabric-hub-underlay` (VTEP address `192.168.65.<node octet>` on `br-ex`, routes to the site underlays via the BGW hub leg, lab MAC shim), VTEP CR `platform-fabric-vtep` (`Unmanaged`, cidrs `[192.168.64.0/18]`), FRRConfiguration `platform-fabric-bgw` peering every node with the BGW hub-leg address `192.168.65.1` |

The transport type is set only on the CloudGateway; region and ASN come from the CloudInfrastructure and the fabric. The WireGuard site keeps a `TransportLink` (`acme-oso1-link`, wave 55) in GitOps until the operator generates it.

```bash
oc get cloudgateway,transportlink -n sovereign-cloud
oc get cloudgateway acme-oso1-gw -n sovereign-cloud -o jsonpath='{range .status.edpmNodeSets[*]}{.name}{" "}{.state}{"\n"}{end}'

# hub side
oc get ds platform-fabric-hub-underlay -n sovereign-cloud            # DESIRED = READY = number of hub nodes
oc get vtep platform-fabric-vtep -o jsonpath='{.status.conditions[*].reason}{"\n"}'
oc get frrconfiguration -n openshift-frr-k8s platform-fabric-bgw
```

Check one hub node's leg from its `ovnkube-node` pod (`oc debug node` is unreliable on busy hubs; the `ovn-controller` container has `ip`):

```bash
POD=$(oc get pod -n openshift-ovn-kubernetes -l app=ovnkube-node -o name | head -1)
oc exec -n openshift-ovn-kubernetes $POD -c ovn-controller -- ip -4 addr show br-ex     # 192.168.65.x/18 next to the node IP
oc exec -n openshift-ovn-kubernetes $POD -c ovn-controller -- ip route show 192.168.80.0/24  # via 192.168.65.1 dev br-ex
oc exec -n openshift-ovn-kubernetes $POD -c ovn-controller -- ping -c 2 192.168.65.1
```

BGP from every hub node to the BGW:

```bash
for p in $(oc get pod -n openshift-frr-k8s -o name | grep -v webhook); do
  oc exec -n openshift-frr-k8s $p -c frr -- vtysh -c 'show bgp summary' | grep -E '^192\.168\.65\.1 '
done
# one line per node, State/PfxRcd a number (Established)
```

**Negative tests**

- A CloudGateway whose `cloudRef` is a CloudInfrastructure of type `aws` fails with `AwsUnsupported`.
- Tenant users cannot create a CloudGateway, CloudInfrastructure or HybridFabric (platform namespace, platform RBAC).

## Step 5 — Tenant networks and placements

**UI:** Tenant → Hybrid Networks → Create, then Add placement: **BackendSelect** lists only your entity's CloudOSO and CloudVirt projects (never a PlatformOpenshift, never another entity's projects); for CloudVirt, enter the VM namespaces to create.

```bash
oc apply -f samples/hybridvpc/acme-chad-networks.yaml
oc get hybridnetwork,networkplacement -A
```

`acme-chad-networks.yaml` creates `acme-core` with placements `acme-core-hub` (CloudVirt `local-virt`, `10.110.2.0/24`, `vmNamespaces: [acme-core-vms]`) and `acme-core-oso1` (CloudOSO `oso1`, `10.110.1.0/24`), and `chad-app` with `chad-app-hub` (`10.120.2.0/24`, `vmNamespaces: [chad-app-vms]`). The GitOps app carries the same hub placements (wave 65); the CloudOSO placement is applied from the sample, like CloudOSO `oso1` itself.

Allocated numbering (read-only):

```bash
oc get hybridnetwork acme-core -n entity-acme-corp -o jsonpath='{.status.vni} {.status.canonicalRt} {.status.overlayMtu}{"\n"}'
oc get hybridnetwork chad-app  -n entity-chad      -o jsonpath='{.status.vni} {.status.canonicalRt}{"\n"}'
```

What the CloudVirt placement creates on the hub (all owned by the placement, removed when it is deleted):

```bash
oc get ns acme-core-vms --show-labels
# k8s.ovn.org/primary-user-defined-network, hybridsovereign.redhat/hybridnetwork=acme-core, entity/owner labels
# (+ mutatevirtualmachines.kubemacpool.io=ignore in the lab)
oc get clusteruserdefinednetwork acme-core -o yaml | sed -n '/^spec:/,/^status:/p'
```

```yaml
spec:
  namespaceSelector: {matchLabels: {hybridsovereign.redhat/hybridnetwork: acme-core}}
  network:
    topology: Layer2
    layer2:
      role: Primary
      subnets: [10.110.2.0/24]
      mtu: 1300
      ipam: {lifecycle: Persistent}
    transport: EVPN
    evpn:
      vtep: platform-fabric-vtep
      ipVRF:  {vni: 51001,  routeTarget: "65010:51001"}
      macVRF: {vni: 151001, routeTarget: "65010:151001"}
```

plus RouteAdvertisements `advertise-acme-core-evpn` (`targetVRF: auto`). The namespace is created already labelled, before any pod: a primary user-defined network applies only to namespaces labelled at creation. The placement refuses a namespace that exists and belongs to someone else, and CloudVirt prefixes must not overlap the hub's cluster, service or node networks.

On the RHOSO side the CloudOSO placement creates Neutron network `acme-core-oso1` (MTU 1300) and an EVPN router with `evpn_vni 51001`. Boot a test VM on that network if the site has none (the reference site has `acme-core-oso1-evpn-vm`, 10.110.1.63).

### Start tenant workloads on the hub

A VM in the placement's namespace (hub OS image DataSources may be empty, so use a container disk). The VM uses the pod network, which in this namespace *is* the tenant network:

```yaml
apiVersion: kubevirt.io/v1
kind: VirtualMachine
metadata:
  name: acme-core-vm1
  namespace: acme-core-vms
spec:
  runStrategy: Always
  template:
    spec:
      domain:
        cpu: {cores: 1}
        memory: {guest: 1Gi}
        devices:
          disks:
            - {name: rootdisk, disk: {bus: virtio}}
            - {name: cloudinit, disk: {bus: virtio}}
          interfaces:
            - {name: default, binding: {name: l2bridge}}
      networks:
        - {name: default, pod: {}}
      volumes:
        - name: rootdisk
          containerDisk: {image: quay.io/containerdisks/centos-stream:9}
        - name: cloudinit
          cloudInitNoCloud:
            userData: |
              #cloud-config
              user: cloud-user
              password: <choose-a-lab-password>
              chpasswd: {expire: false}
```

And a probe pod in the same namespace (any image with `ping`):

```bash
oc run probe -n acme-core-vms --image=registry.redhat.io/openshift4/network-tools-rhel9 --command -- sleep infinity
```

Repeat in `chad-app-vms` (VM `chad-app-vm1`, pod `probe`) for the isolation check.

## Step 6 — Verify

### 6.1 Hub ↔ RHOSO in the same VRF

Tenant-network addresses: for a pod, the primary UDN address on `ovn-udn1` (not `status.podIP`); for a VM, the VMI interface address.

```bash
oc exec -n acme-core-vms probe -- ip -4 -o addr show ovn-udn1        # 10.110.2.x
oc get vmi acme-core-vm1 -n acme-core-vms -o jsonpath='{.status.interfaces[0].ipAddress}{"\n"}'

oc exec -n acme-core-vms probe -- ping -c 3 10.110.1.63                       # RHOSO VM: replies
oc exec -n acme-core-vms probe -- ping -c 3 -M do -s 1272 10.110.1.63         # 1300 bytes on the wire: replies
oc exec -n acme-core-vms probe -- ping -c 1 -M do -s 1400 10.110.1.63         # rejected locally: "message too long, mtu=1300"
```

From the VM, use the console (`virtctl console acme-core-vm1 -n acme-core-vms`, or the web console) and run the same pings. `virtctl ssh` and `oc port-forward` do **not** reach a VM on a primary user-defined network (`l2bridge` binding); test from the console or from a pod in the same namespace.

**Pass:** pings in both directions (the RHOSO VM reaches 10.110.2.x too), 1272-byte DF payload passes, 1400 is refused with `mtu=1300`.

### 6.2 Routes on the border gateway

Open a shell on the BGW: `virtctl console fabric-bgw -n sovereign-cloud`, or SSH through its launcher pod with the platform key from Vault `fabric/platform-fabric/bgw`:

```bash
oc port-forward -n sovereign-cloud $(oc get pod -n sovereign-cloud -l vm.kubevirt.io/name=fabric-bgw -o name) 2222:22 &
ssh -i <bgw-key-file> -p 2222 cloud-user@127.0.0.1
```

```bash
sudo vtysh -c 'show bgp l2vpn evpn summary'
#   192.168.65.10 ... .32   one Established session per hub node (hub-leg peers)
#   192.168.80.100          compute01 (through the site gateway)
sudo vtysh -c 'show bgp l2vpn evpn route type prefix'
```

Expected shape (abbreviated):

```text
Route Distinguisher: <hub node>:<n>
 *>i[5]:[0]:[24]:[10.110.2.0]        192.168.65.x       ...  RT:65010:51001 ET:8 Rmac:...
 *>i[5]:[0]:[24]:[10.120.2.0]        192.168.65.x       ...  RT:65010:52000 ET:8 Rmac:...
Route Distinguisher: <compute01>:<n>
 *>i[5]:[0]:[32]:[10.110.1.63]       192.168.80.100     ...  RT:65010:51001 ET:8 Rmac:...
```

The hub announces the whole Layer2 subnet from its node VTEPs (192.168.65.x), the RHOSO site announces host routes from its compute VTEP (192.168.80.100). Next hops are the real VTEPs: the BGW reflects with next-hop unchanged and only routes the outer VXLAN packets. Type-2/Type-3 routes with the macVRF RT (`65010:151001`) may also appear from hub VTEPs; they stay within the hub.

### 6.3 Isolation with a second VRF

```bash
oc exec -n chad-app-vms probe -- ip -4 -o addr show ovn-udn1     # 10.120.2.x
oc exec -n chad-app-vms probe -- ping -c 3 -W 1 10.110.1.63      # 100% loss
oc exec -n chad-app-vms probe -- ping -c 3 -W 1 <acme 10.110.2.x> # 100% loss
oc exec -n acme-core-vms probe -- ping -c 3 -W 1 <chad 10.120.2.x> # 100% loss
```

On the BGW, `chad-app` is not offered to the RHOSO site, which has no `chad-app` placement (per-site RT policy):

```bash
sudo vtysh -c 'show bgp l2vpn evpn neighbors 192.168.80.100 advertised-routes' | grep -c 10.120.2.0   # 0
```

**Pass:** no cross-VRF reachability in either direction; compute01 never receives RT `65010:52000`. The same holds with overlapping prefixes: two networks may both use 10.110.0.0/16, because they are different VRFs.

### 6.4 Lab gotchas

| Symptom | Cause / fix |
|---------|-------------|
| VM create hangs or is rejected by a kubemacpool webhook | The lab hub's kubemacpool webhook is broken; placement namespaces carry `mutatevirtualmachines.kubemacpool.io=ignore` |
| DataVolume from a DataSource never imports | Hub OS image DataSources are empty; use a container disk (`quay.io/containerdisks/centos-stream:9`) |
| `oc debug node/...` times out | Use the host-network `ovnkube-node` pods (`-c ovn-controller` has `ip` and `ovs-vsctl`) |
| `virtctl ssh` / port-forward to a tenant VM fails | Expected with `l2bridge` on a primary user-defined network; use the console or a probe pod in the namespace |
| Pod in the VM namespace has no `ovn-udn1` | The namespace was not created by the placement (or was labelled after creation); delete it and let the placement create it |
| Hub nodes' BGP stays `Active` | Node leg missing: check the DaemonSet pod on that node and `ip addr show br-ex`; in the lab the MAC shim must be on (hypervisor source-MAC filter) |

## UI checklist

- [ ] Admin → Cloud Infrastructure lists `oso1` and `hub-virt` with type and capabilities; the create form shows only the section of the selected type and no credentials for `openshift`/`local`
- [ ] HybridFabric create uses EntityMultiSelect (no free-text entity names); underlay type `localnet` shows hub VTEP block and hub leg
- [ ] CloudGateway create: FabricSelect + CloudInfrastructureSelect; transport offers only `none` and `wireguard`
- [ ] Tenant CloudOSO / CloudVirt / CloudAWS forms pick the site with CloudInfrastructureSelect (filtered by type and `entityRefs`) and show no admin-credential fields
- [ ] Placement BackendSelect lists only the entity's CloudOSO and CloudVirt projects; a CloudVirt placement asks for VM namespaces
- [ ] PlatformOpenshift create has no fabric step
- [ ] HybridNetwork shows VNI / RT read-only; there is no editor for them anywhere on tenant surfaces
- [ ] An `acme-corp` user sees no `chad` networks, projects or placements

## Cleanup order

1. Delete tenant VMs and probe pods (or leave them: step 2 deletes their namespaces).
2. Delete NetworkPlacements. CloudVirt: the VM namespaces, RouteAdvertisements and CUDN go; CloudOSO: the Neutron EVPN router, subnet and network go (delete RHOSO test VMs first so Neutron can remove the network).
3. Delete HybridNetworks (their VNIs return to the pool).
4. Delete CloudGateways. `hub-virt-gw` refuses while CloudVirt placements remain on the fabric, then removes the FRRConfiguration, VTEP CR and node legs; `acme-oso1-gw` removes the site gateway VM (EDPM fabric settings stay).
5. Delete tenant cloud projects (CloudOSO, CloudVirt) if they were created for the lab.
6. Delete the HybridFabric only when tearing down the platform (blocked while VNIs are allocated); then CloudInfrastructure objects (after every project and gateway that references them).

On the reference hub most of these objects are owned by the GitOps app `hs-platform-fabric`: remove them in Git, or Argo recreates them.

→ Back to [Workshop README](README.md)
