#!/bin/bash
# First-boot setup for the fabric border gateway (run once from cloud-init runcmd).
# Order matters: qemu-guest-agent is enabled last so VMI AgentConnected=True
# tells EDA that every step before it has run.
set -x
systemctl disable --now firewalld 2>/dev/null || true
sysctl --system
systemctl daemon-reload
systemctl enable --now fabric-lo.service
# Drop NM's auto "Wired connection" on eth1 so only the keyfile owns it.
nmcli -t -f NAME,DEVICE con show | awk -F: '$2=="eth1" && $1!="underlay"{print $1}' | while read -r c; do nmcli con delete "$c"; done
nmcli con reload
nmcli con up underlay
nmcli con up management || true
install -m 0640 -o frr -g frr /root/frr.conf.fabric /etc/frr/frr.conf
sed -i 's/^bgpd=no/bgpd=yes/' /etc/frr/daemons
# A config disk (if attached) wins over the cloud-init copy of frr.conf.
/usr/local/sbin/fabric-config-sync.sh
systemctl enable fabric-config-sync.service
systemctl enable --now nftables.service
if [ -f /etc/wireguard/wg0.conf ]; then
  systemctl enable --now wg-quick@wg0.service
fi
systemctl enable --now frr.service
systemctl enable --now dnsmasq.service
for _ in 1 2 3 4 5; do /usr/local/sbin/install-wstunnel.sh && break; sleep 10; done
systemctl enable --now wstunnel.service
systemctl enable --now qemu-guest-agent.service
