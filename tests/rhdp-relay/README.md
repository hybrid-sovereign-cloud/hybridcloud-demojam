# RHDP inter-sandbox TLS relay

Helper for running the demo across two RHDP sandboxes (`*.dyn.redhatworkshops.io`)
that sit on different host clusters at the same RHDP site. In that layout the
sandboxes cannot reach each other's public VIPs (`148.62.x.x`): the traffic takes
an internal path through the host-cluster load balancers whose return leg is
broken, while the internet reaches both VIPs fine. Both sandboxes are also built
with the same `10.10.10.0/24` machine network and the same ingress VIP, so the
private addresses are unusable too.

The platform needs two flows across that gap, both TLS on 443:

| Direction | Name | What it carries |
|---|---|---|
| hub → OpenStack sandbox | `*.apps.<oso-cluster>` | Keystone and the whole service catalog (`CloudInfrastructure` credentials check and every OpenStack call) |
| hub → OpenStack sandbox | `api.<oso-cluster>:6443` | the management-cluster kubeconfig (`managementClusterKubeconfigRef`): NetConfig, NodeSets, EDPM runs |
| OpenStack sandbox → hub | `fabric-bgw.apps.<hub-cluster>` | the site gateway's wstunnel session that carries the WireGuard transport to the border gateway |

The relay listens on 443 and 6443 and routes each connection by SNI name.

The relay is one small VM on an OpenStack cloud outside RHDP (the lab's Atuin
cloud) with one floating IP:

- **HAProxy** in TCP mode, routing on the TLS SNI name: hub apps names go to
  the hub VIP, OpenStack apps names go to the OpenStack VIP. Each route is
  gated on the caller's RHDP NAT source address, everything else is rejected.
  TLS is passed through untouched, so the clusters see the same certificates
  as before.
- **dnsmasq** answering the two cluster zones (`api.` and `*.apps.`) with the
  floating IP. Each cluster's DNS operator forwards only the *other* sandbox's
  cluster zone to it, so a cluster still resolves its own names normally.

No credential is stored in this directory. Everything is driven by
environment variables, like the rest of `tests/`.

## Files

| File | Purpose |
|---|---|
| `discover-source-ips.sh` | prints the public NAT address of every node of a cluster, to confirm which /24 each side is in |
| `cloud-init.yaml.tpl` | HAProxy + dnsmasq configuration rendered into the relay VM's user-data |
| `build-relay.sh` | creates network, subnet, router, security group, floating IP and the VM |
| `cluster-dns.sh` | `apply` / `remove` the DNS operator forwarders on both clusters |
| `destroy-relay.sh` | removes everything `build-relay.sh` created |

## Usage

```bash
# 1. cluster access, as for the test suite
export OCP_CENTRAL_SERVER=https://api.cluster-AAAAA.dyn.redhatworkshops.io:6443
export OCP_CENTRAL_USERNAME=admin OCP_CENTRAL_PASSWORD=...
export OCP_OSO_SERVER=https://api.cluster-BBBBB.dyn.redhatworkshops.io:6443
export OCP_OSO_USERNAME=admin OCP_OSO_PASSWORD=...

# 2. (optional) source gates. Default: 148.62.110.0/24 for the hub side and
#    148.62.111.0/24 for the OpenStack side, the per-host-cluster NAT ranges
#    seen at RHDP dfw3. Check with discover-source-ips.sh and override if the
#    sandboxes landed elsewhere (IPs or CIDRs, space-separated).
./discover-source-ips.sh central; ./discover-source-ips.sh oso
# export HUB_SOURCES="148.62.110.0/24" OSO_SOURCES="148.62.111.0/24"

# 3. the relay cloud (clouds.yaml entry) and placement
export OS_CLOUD=lab-infra
export RELAY_EXTERNAL_NET=internet      # external network for the FIP and the router
export RELAY_IMAGE=alma-10 RELAY_FLAVOR=b1.small RELAY_KEYPAIR=<your keypair>
export RELAY_ADMIN_CIDRS="172.18.42.0/24"   # ssh and test access to the relay

./build-relay.sh          # prints RELAY_FIP
./cluster-dns.sh apply    # forwarders on both clusters
```

Check from a pod on the hub that the Keystone route resolves to the floating
IP and answers, then nudge or wait for the `CloudInfrastructure` reconcile.

Remove with `./cluster-dns.sh remove` and `./destroy-relay.sh`.

## Notes

- Hub and OpenStack cluster names are derived from `OCP_CENTRAL_SERVER` and
  `OCP_OSO_SERVER`; the VIPs are resolved from the `api.` names.
- Each RHDP node has its own 1:1 NAT address, drawn from a /24 per host
  cluster (all hub nodes were in `148.62.110.0/24`, all OpenStack nodes in
  `148.62.111.0/24`). The gates default to those /24s so node rebuilds and
  migrations inside the host cluster keep working. A sandbox rebuilt onto a
  different host cluster shows up in another /24: rerun
  `discover-source-ips.sh` and rebuild (or edit `/etc/haproxy/haproxy.cfg`
  and the security group on the VM).
- The gate is deliberately per direction: only hub sources may reach the
  OpenStack API and routes, only OpenStack sources may reach the hub's
  `fabric-bgw` route. Do not merge the two lists. Widening within RHDP is
  low risk: the relay only ever forwards to the two public VIPs, which the
  internet reaches directly anyway.
- The WireGuard session is a long-lived websocket, so the HAProxy client and
  server timeouts are set to one day.
- RHDP sandboxes do pass UDP 53 to the internet, so plain DNS forwarding works;
  the dnsmasq also listens on TCP.
- If the two sandboxes are ever placed in different RHDP regions (as the demo
  originally was), none of this is needed.
