#cloud-config
# Rendered by build-relay.sh. Placeholders: __FIP__ __HUB_DOMAIN__ __OSO_DOMAIN__
# __HUB_APPS__ __OSO_APPS__ __HUB_VIP__ __OSO_VIP__ __HUB_SRC__ __OSO_SRC__ __ADMIN_SRC__
package_update: true
packages: [haproxy, dnsmasq, tcpdump]
write_files:
  - path: /etc/haproxy/haproxy.cfg
    content: |
      global
          log /dev/log local0
          maxconn 4000
      defaults
          mode tcp
          log global
          option tcplog
          timeout connect 10s
          timeout client 1d
          timeout server 1d
      frontend tls_in
          bind *:443
          tcp-request inspect-delay 5s
          tcp-request content accept if { req.ssl_hello_type 1 }
          acl hub_src   src __HUB_SRC__
          acl oso_src   src __OSO_SRC__
          acl admin_src src __ADMIN_SRC__
          acl to_oso    req.ssl_sni -m end .__OSO_APPS__
          acl to_hub    req.ssl_sni -m end .__HUB_APPS__
          use_backend oso_vip if to_oso hub_src
          use_backend oso_vip if to_oso admin_src
          use_backend hub_vip if to_hub oso_src
          use_backend hub_vip if to_hub admin_src
          default_backend reject
      backend oso_vip
          server vip __OSO_VIP__:443
      backend hub_vip
          server vip __HUB_VIP__:443
      frontend api_in
          bind *:6443
          tcp-request inspect-delay 5s
          tcp-request content accept if { req.ssl_hello_type 1 }
          acl hub_src   src __HUB_SRC__
          acl oso_src   src __OSO_SRC__
          acl admin_src src __ADMIN_SRC__
          acl to_oso_api req.ssl_sni -i api.__OSO_DOMAIN__
          acl to_hub_api req.ssl_sni -i api.__HUB_DOMAIN__
          use_backend oso_api if to_oso_api hub_src
          use_backend oso_api if to_oso_api admin_src
          use_backend hub_api if to_hub_api oso_src
          use_backend hub_api if to_hub_api admin_src
          default_backend reject
      backend oso_api
          server vip __OSO_VIP__:6443
      backend hub_api
          server vip __HUB_VIP__:6443
      backend reject
          tcp-request content reject
  - path: /etc/dnsmasq.d/rhdp-relay.conf
    content: |
      no-resolv
      no-hosts
      listen-address=0.0.0.0
      bind-interfaces
      # each cluster forwards only the OTHER sandbox's cluster zone here
      # (covers *.apps for the routes and api. for the Kubernetes API)
      address=/__OSO_DOMAIN__/__FIP__
      address=/__HUB_DOMAIN__/__FIP__
      server=1.1.1.1
      log-queries
runcmd:
  - setsebool -P haproxy_connect_any 1 || true
  - systemctl disable --now firewalld || true
  - systemctl enable --now haproxy dnsmasq
  - haproxy -c -f /etc/haproxy/haproxy.cfg
