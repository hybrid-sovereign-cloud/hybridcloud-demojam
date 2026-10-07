/** Lab-aligned HybridFabric defaults (design/fabric.md §8.1 / samples). */

export type FabricTunnelType = 'wireguard' | 'ipsec' | 'macsec' | 'none';

export interface FabricRouteReflector {
  name: string;
  address: string;
}

/** Hub underlay segment (HybridFabric.spec.underlay). */
export interface FabricUnderlayDefaults {
  nadName: string;
  cidr: string;
  gatewayAddress: string;
  mtu: number;
}

export const DEFAULT_FABRIC_ROUTE_REFLECTORS: FabricRouteReflector[] = [
  { name: 'central-rr-a', address: '10.255.10.1' },
  { name: 'central-rr-b', address: '10.255.10.2' },
];

export const DEFAULT_FABRIC_TRANSPORT = {
  mtu: 9000,
  innerMssClamp: 1360,
  defaultTunnelType: 'none' as FabricTunnelType,
};

export const DEFAULT_FABRIC_UNDERLAY: FabricUnderlayDefaults = {
  nadName: 'fabric-underlay',
  cidr: '192.168.64.0/18',
  gatewayAddress: '192.168.64.1',
  mtu: 1400,
};

export const DEFAULT_FABRIC_VNI = { start: 51000, end: 51127 };
export const DEFAULT_FABRIC_DOMAIN_ASN = 65010;

/** Serialize RR list for a textarea (`name=address` per line). */
export function formatRouteReflectors(rrs: FabricRouteReflector[]): string {
  return rrs.map((r) => `${r.name}=${r.address}`).join('\n');
}

/** Parse `name=address` or `name,address` lines into RR objects. */
export function parseRouteReflectors(text: string): FabricRouteReflector[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const sep = line.includes('=') ? '=' : ',';
      const [name, address] = line.split(sep).map((s) => s.trim());
      return { name: name || '', address: address || '' };
    })
    .filter((r) => r.name && r.address);
}

export function parseCidrList(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
