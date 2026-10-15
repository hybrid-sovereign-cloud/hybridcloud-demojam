import React, { useMemo, useState } from 'react';
import { Alert, Button } from '@patternfly/react-core';
import { TableIcon, TopologyIcon } from '@patternfly/react-icons';
import { HybridSovereignKind, K8sResource } from '../types';
import { normalizeHealth } from './StatusBadge';

/**
 * HybridTopology — the hybrid network, drawn as the layered thing it actually
 * is rather than as a star.
 *
 * Five bands, top to bottom, in dependency order:
 *
 *   1. Fabric      the HybridFabric: border gateway, domain ASN, VNI pool with
 *                  utilisation, underlay CIDR/MTU, transport defaults.
 *   2. Gateways    one CloudGateway per attachment. The edge up to the fabric
 *                  carries the transport: a tunnelled transport (wireguard)
 *                  gets a halo plus the backing TransportLink's name, a direct
 *                  attachment gets a plain stroke labelled "direct".
 *   3. Sites       the CloudInfrastructure each gateway attaches, with its
 *                  type (openshift / openstack / aws) and readiness.
 *   4. Tenant VRFs HybridNetworks grouped by Entity. The VNI is the isolation
 *                  boundary (one route target per VNI), so it is the loudest
 *                  thing on the card.
 *   5. Placements  each NetworkPlacement under its HybridNetwork, with backend
 *                  kind+name, prefixes and target VM namespaces. A connector
 *                  runs from the placement up through the routing lane to the
 *                  site its backend resolves to — so "which tenant subnet
 *                  lands on which cloud" is one line to follow.
 *
 * Accessibility notes:
 *  - State is never colour alone. Every node carries a drawn glyph (tick /
 *    clock / cross / dash) AND a text state label, every edge is labelled, and
 *    there is a full table view of the same model.
 *  - Text wears text tokens; colour lives on strokes and glyphs, so contrast
 *    holds in both themes. Dark mode rides PatternFly's own status tokens.
 *  - Sites are also named in text on each placement chip, so the connector is
 *    reinforcement rather than the only way to read the mapping.
 *
 * Robustness: every field below can be absent on a partially-reconciled
 * cluster. Nothing here indexes without a guard and nothing throws on a
 * missing spec, status, ref or array.
 */

export type NetState = 'ready' | 'pending' | 'failed' | 'absent';

const STATE_LABEL: Record<NetState, string> = {
  ready: 'Ready',
  pending: 'Pending',
  failed: 'Failed',
  absent: 'Not placed',
};

export interface HybridTopologyProps {
  /** All networking CRs (HybridFabric, CloudGateway, TransportLink,
   *  CloudInfrastructure, HybridNetwork, NetworkPlacement, Cloud* backends). */
  items: K8sResource[];
  /** Scope to one tenant: only that entity's HybridNetworks are drawn. */
  entityNamespace?: string;
  onSelect?: (kind: HybridSovereignKind, item: K8sResource) => void;
}

/* ------------------------------------------------------------------ model */

interface TopoPlacement {
  key: string;
  cr?: K8sResource;
  name: string;
  backendKind: string;
  backendName: string;
  siteName: string;
  prefixes: string[];
  vmNamespaces: string[];
  state: NetState;
}

interface TopoNetwork {
  key: string;
  cr: K8sResource;
  name: string;
  namespace: string;
  entity: string;
  vni?: number;
  rt: string;
  description: string;
  state: NetState;
  duplicateVni: boolean;
  placements: TopoPlacement[];
}

interface TopoGroup {
  entity: string;
  networks: TopoNetwork[];
}

interface TopoGateway {
  cr: K8sResource;
  name: string;
  transport: string;
  tunnelled: boolean;
  linkName: string;
  state: NetState;
  siteName: string;
  detail: string;
}

interface TopoSite {
  cr?: K8sResource;
  name: string;
  type: string;
  displayName: string;
  state: NetState;
  gateways: TopoGateway[];
}

interface TopoFabric {
  cr?: K8sResource;
  name: string;
  asn?: number;
  bgwName: string;
  bgwEndpoint: string;
  vniStart?: number;
  vniEnd?: number;
  poolSize?: number;
  allocated?: number;
  underlayCidr: string;
  underlayMtu?: number;
  transportMtu?: number;
  state: NetState;
}

interface TopoModel {
  fabric: TopoFabric;
  sites: TopoSite[];
  groups: TopoGroup[];
  duplicateVnis: Array<{ vni: number; networks: string[] }>;
  networkCount: number;
  placementCount: number;
}

/* ---------------------------------------------------------------- helpers */

/** Per-kind status fields arrive on the generic base status; read as a bag. */
function st(item: K8sResource | undefined): Record<string, unknown> {
  return (item?.status ?? {}) as unknown as Record<string, unknown>;
}

function sp(item: K8sResource | undefined): Record<string, unknown> {
  return (item?.spec ?? {}) as unknown as Record<string, unknown>;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function stateOf(item: K8sResource | undefined): NetState {
  if (!item) return 'pending';
  const s = st(item);
  const health = normalizeHealth(s.ready as boolean | undefined, s.status as string | undefined);
  if (health === 'ready') return 'ready';
  if (health === 'failed') return 'failed';
  return 'pending';
}

function trunc(s: string, n: number): string {
  if (!s) return '';
  return s.length > n ? `${s.slice(0, Math.max(n - 1, 1))}…` : s;
}

function entityOf(net: K8sResource): string {
  const fromStatus = str(st(net).entity);
  if (fromStatus) return fromStatus;
  const ns = net.metadata?.namespace ?? '';
  return ns.startsWith('entity-') ? ns.slice('entity-'.length) : ns || 'unassigned';
}

function ofKind(items: K8sResource[], kind: string): K8sResource[] {
  return items.filter((i) => (i?.kind || '') === kind);
}

const BACKEND_KINDS = ['CloudVirt', 'CloudOSO', 'CloudAWS'];

export function buildTopologyModel(items: K8sResource[], entityNamespace?: string): TopoModel {
  const safe = Array.isArray(items) ? items.filter((i) => i && i.metadata) : [];

  const fabricCr = ofKind(safe, 'HybridFabric')[0];
  const gateways = ofKind(safe, 'CloudGateway');
  const links = ofKind(safe, 'TransportLink');
  const infra = ofKind(safe, 'CloudInfrastructure');
  const placements = ofKind(safe, 'NetworkPlacement');

  let networks = ofKind(safe, 'HybridNetwork');
  if (entityNamespace) {
    networks = networks.filter((n) => n.metadata.namespace === entityNamespace);
  }

  /* ---- fabric */
  const fs = st(fabricCr);
  const fspec = sp(fabricCr);
  const pool = obj(fspec.vniPool);
  const bgw = obj(fspec.borderGateway);
  const underlay = obj(fspec.underlay);
  const transportDefaults = obj(fspec.transportDefaults);
  const vniStart = num(pool.start);
  const vniEnd = num(pool.end);
  const allocated = num(fs.allocatedVniCount);
  const available = num(fs.availableVniCount);
  let poolSize: number | undefined;
  if (vniStart !== undefined && vniEnd !== undefined && vniEnd >= vniStart) {
    poolSize = vniEnd - vniStart + 1;
  } else if (allocated !== undefined && available !== undefined) {
    poolSize = allocated + available;
  }

  const fabric: TopoFabric = {
    cr: fabricCr,
    name: fabricCr?.metadata.name ?? 'fabric',
    asn: num(fspec.domainAsn) ?? num(fs.domainAsn),
    bgwName: str(bgw.name) || str(fs.bgwName),
    bgwEndpoint: str(fs.bgwEndpoint) || str(fs.bgwAddress) || str(bgw.loopback),
    vniStart,
    vniEnd,
    poolSize,
    allocated,
    underlayCidr: str(underlay.cidr),
    underlayMtu: num(underlay.mtu),
    transportMtu: num(transportDefaults.mtu),
    state: fabricCr ? stateOf(fabricCr) : 'absent',
  };

  /* ---- gateways, keyed to the site they attach */
  const linkByGateway = new Map<string, K8sResource>();
  for (const l of links) {
    const ref = str(sp(l).cloudGatewayRef) || str(obj(sp(l).gatewayRef).name);
    if (ref) linkByGateway.set(ref, l);
  }

  const topoGateways: TopoGateway[] = gateways.map((gw) => {
    const gs = st(gw);
    const siteName = str(obj(sp(gw).cloudRef).name) || str(gs.cloudInfrastructure);
    const link = linkByGateway.get(gw.metadata.name);
    const transport =
      str(obj(sp(gw).transport).type) || str(sp(link).tunnelType) || 'none';
    const transportReady = gs.transportReady === true;
    const base = stateOf(gw);
    const tunnelled = transport !== '' && transport !== 'none';
    const peers = num(gs.peerCount);
    return {
      cr: gw,
      name: gw.metadata.name,
      transport,
      tunnelled,
      linkName: link?.metadata.name ?? '',
      // A tunnelled gateway is only really up once its tunnel is up too.
      state: base === 'ready' && tunnelled && !transportReady ? 'pending' : base,
      siteName,
      detail: [
        tunnelled ? `transport ${transportReady ? 'up' : 'down'}` : 'direct attachment',
        peers !== undefined ? `${peers} peer${peers === 1 ? '' : 's'}` : '',
        str(gs.gatewayAddress),
      ]
        .filter(Boolean)
        .join(' · '),
    };
  });

  /* ---- sites: every CloudInfrastructure, plus any site only a gateway names */
  const siteMap = new Map<string, TopoSite>();
  for (const i of infra) {
    siteMap.set(i.metadata.name, {
      cr: i,
      name: i.metadata.name,
      type: str(sp(i).type) || 'unknown',
      displayName: str(sp(i).displayName),
      state: stateOf(i),
      gateways: [],
    });
  }
  for (const gw of topoGateways) {
    if (!gw.siteName) continue;
    if (!siteMap.has(gw.siteName)) {
      siteMap.set(gw.siteName, {
        name: gw.siteName,
        type: 'unknown',
        displayName: '',
        state: 'pending',
        gateways: [],
      });
    }
    siteMap.get(gw.siteName)?.gateways.push(gw);
  }
  const sites = Array.from(siteMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  /* ---- backend -> site resolution (backend names are only unique per ns) */
  const backendSite = new Map<string, string>();
  for (const kind of BACKEND_KINDS) {
    for (const b of ofKind(safe, kind)) {
      const site = str(obj(sp(b).cloudRef).name);
      if (!site) continue;
      backendSite.set(`${b.metadata.namespace}|${kind}|${b.metadata.name}`, site);
      // Fallback for the (common) case where the backend CR is readable but
      // the caller scoped lists to a different namespace.
      const loose = `${kind}|${b.metadata.name}`;
      if (!backendSite.has(loose)) backendSite.set(loose, site);
    }
  }

  /* ---- placements, bucketed under their network */
  const placementsByNetwork = new Map<string, TopoPlacement[]>();
  for (const p of placements) {
    const spec = sp(p);
    const backend = obj(spec.backend);
    const netName = str(spec.network);
    const ns = p.metadata.namespace ?? '';
    if (!netName) continue;
    const kind = str(backend.kind);
    const name = str(backend.name);
    const site =
      backendSite.get(`${ns}|${kind}|${name}`) ?? backendSite.get(`${kind}|${name}`) ?? '';
    const entry: TopoPlacement = {
      key: `${ns}/${p.metadata.name}`,
      cr: p,
      name: p.metadata.name,
      backendKind: kind,
      backendName: name,
      siteName: site,
      prefixes: arr(spec.prefixes),
      vmNamespaces: arr(spec.vmNamespaces),
      state: stateOf(p),
    };
    const k = `${ns}|${netName}`;
    const list = placementsByNetwork.get(k);
    if (list) list.push(entry);
    else placementsByNetwork.set(k, [entry]);
  }

  /* ---- duplicate VNI detection: two VRFs on one VNI is a hard conflict */
  const vniOwners = new Map<number, string[]>();
  for (const n of networks) {
    const v = num(st(n).vni);
    if (v === undefined) continue;
    const label = `${n.metadata.namespace}/${n.metadata.name}`;
    const owners = vniOwners.get(v);
    if (owners) owners.push(label);
    else vniOwners.set(v, [label]);
  }
  const duplicateVnis = Array.from(vniOwners.entries())
    .filter(([, owners]) => owners.length > 1)
    .map(([vni, owners]) => ({ vni, networks: owners }))
    .sort((a, b) => a.vni - b.vni);
  const dupVniSet = new Set(duplicateVnis.map((d) => d.vni));

  /* ---- networks grouped by entity */
  const topoNetworks: TopoNetwork[] = networks.map((n) => {
    const ns = n.metadata.namespace ?? '';
    const ps = placementsByNetwork.get(`${ns}|${n.metadata.name}`) ?? [];
    ps.sort((a, b) => a.name.localeCompare(b.name));
    const vni = num(st(n).vni);
    return {
      key: `${ns}/${n.metadata.name}`,
      cr: n,
      name: n.metadata.name,
      namespace: ns,
      entity: entityOf(n),
      vni,
      rt: str(st(n).canonicalRt),
      description: str(sp(n).description),
      // A VRF with no placement is a real, common state — call it out rather
      // than letting it read as "pending".
      state: ps.length === 0 ? 'absent' : stateOf(n),
      duplicateVni: vni !== undefined && dupVniSet.has(vni),
      placements: ps,
    };
  });

  const groupMap = new Map<string, TopoGroup>();
  for (const n of topoNetworks) {
    const g = groupMap.get(n.entity);
    if (g) g.networks.push(n);
    else groupMap.set(n.entity, { entity: n.entity, networks: [n] });
  }
  const groups = Array.from(groupMap.values()).sort((a, b) => a.entity.localeCompare(b.entity));
  for (const g of groups) g.networks.sort((a, b) => a.name.localeCompare(b.name));

  return {
    fabric,
    sites,
    groups,
    duplicateVnis,
    networkCount: topoNetworks.length,
    placementCount: topoNetworks.reduce((acc, n) => acc + n.placements.length, 0),
  };
}

/* -------------------------------------------------------------- geometry */

const PAD = 16;
const CARD_W = 206;
const GUTTER = 22; // left strip of each column, reserved for connector runs
const COL_W = CARD_W + GUTTER;
const COL_GAP = 12;
const GROUP_PAD = 10;
const GROUP_GAP = 22;
const GROUP_HEAD = 22;

const FAB_H = 92;
const GW_Y = 142;
const GW_H = 64;
const SITE_Y = 252;
const SITE_H = 66;
const LANE_H = 78;
const GROUPS_Y = SITE_Y + SITE_H + LANE_H;

const NET_H = 80;
const CHIP_H = 68;
const CHIP_GAP = 8;

const SITE_W = 186;
const SITE_MIN_GAP = 36;

interface ColLayout {
  net: TopoNetwork;
  x: number; // left edge of the column (gutter starts here)
  cardX: number;
  y: number;
  height: number;
  chips: Array<{ p: TopoPlacement; y: number; gutterX: number }>;
}

interface GroupLayout {
  group: TopoGroup;
  x: number;
  width: number;
  height: number;
  cols: ColLayout[];
}

interface SiteLayout {
  site: TopoSite;
  x: number;
  cx: number;
  gws: Array<{ gw: TopoGateway; x: number; w: number; cx: number }>;
}

function layout(model: TopoModel): {
  width: number;
  height: number;
  contentW: number;
  groups: GroupLayout[];
  sites: SiteLayout[];
  siteCx: Map<string, number>;
} {
  // Groups first — they set the natural content width.
  let gx = PAD;
  let maxGroupH = 0;
  const groups: GroupLayout[] = model.groups.map((g) => {
    const cols: ColLayout[] = g.networks.map((net, i) => {
      const x = gx + GROUP_PAD + i * (COL_W + COL_GAP);
      const y = GROUPS_Y + GROUP_HEAD;
      const chips = net.placements.map((p, j) => ({
        p,
        y: y + NET_H + CHIP_GAP + j * (CHIP_H + CHIP_GAP),
        // Each placement gets its own lane inside the gutter so connectors
        // never overlap a card or each other.
        gutterX: x + 6 + Math.min(j, 2) * 6,
      }));
      return {
        net,
        x,
        cardX: x + GUTTER,
        y,
        height: NET_H + net.placements.length * (CHIP_H + CHIP_GAP),
        chips,
      };
    });
    const width = Math.max(
      g.networks.length * COL_W + Math.max(g.networks.length - 1, 0) * COL_GAP + GROUP_PAD * 2,
      COL_W + GROUP_PAD * 2,
    );
    const height =
      GROUP_HEAD + Math.max(...cols.map((c) => c.height), NET_H) + GROUP_PAD;
    maxGroupH = Math.max(maxGroupH, height);
    const out: GroupLayout = { group: g, x: gx, width, height, cols };
    gx += width + GROUP_GAP;
    return out;
  });

  const groupsW = groups.length > 0 ? gx - GROUP_GAP - PAD : 0;
  const siteCount = Math.max(model.sites.length, 1);
  const sitesW = siteCount * SITE_W + (siteCount - 1) * SITE_MIN_GAP;
  const contentW = Math.max(groupsW, sitesW, 640);

  const slot = contentW / siteCount;
  const siteCx = new Map<string, number>();
  const sites: SiteLayout[] = model.sites.map((s, i) => {
    const cx = PAD + slot * (i + 0.5);
    siteCx.set(s.name, cx);
    const n = Math.max(s.gateways.length, 1);
    const gwW = Math.max(Math.min(SITE_W, slot / n - 12), 104);
    const span = n * gwW + (n - 1) * 10;
    const start = cx - span / 2;
    return {
      site: s,
      x: cx - SITE_W / 2,
      cx,
      gws: s.gateways.map((gw, j) => {
        const x = start + j * (gwW + 10);
        return { gw, x, w: gwW, cx: x + gwW / 2 };
      }),
    };
  });

  const height = GROUPS_Y + (groups.length > 0 ? maxGroupH : 0) + PAD;
  return { width: contentW + PAD * 2, height, contentW, groups, sites, siteCx };
}

/* ----------------------------------------------------------------- glyphs */

/**
 * State as a drawn shape, so state survives greyscale, print and
 * forced-colors. Colour is reinforcement only; the shape and the adjacent
 * text label carry the meaning.
 */
function StateGlyph({ state, x, y }: { state: NetState; x: number; y: number }): React.ReactElement {
  const r = 6;
  return (
    <g transform={`translate(${x}, ${y})`} className={`sc-hstopo__glyph sc-hstopo__glyph--${state}`}>
      <circle cx={0} cy={0} r={r} />
      {state === 'ready' && <path d="M -3 0 L -1 2.4 L 3.2 -2.4" className="sc-hstopo__glyph-mark" />}
      {state === 'pending' && <path d="M 0 -3.2 L 0 0 L 2.6 1.6" className="sc-hstopo__glyph-mark" />}
      {state === 'failed' && (
        <path d="M -2.6 -2.6 L 2.6 2.6 M 2.6 -2.6 L -2.6 2.6" className="sc-hstopo__glyph-mark" />
      )}
      {state === 'absent' && <path d="M -3 0 L 3 0" className="sc-hstopo__glyph-mark" />}
    </g>
  );
}

interface NodeProps {
  onActivate?: () => void;
}

function nodeHandlers({ onActivate }: NodeProps): Record<string, unknown> {
  if (!onActivate) return {};
  return {
    role: 'button',
    tabIndex: 0,
    onClick: onActivate,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onActivate();
      }
    },
  };
}

/* -------------------------------------------------------------- component */

export function HybridTopology({
  items,
  entityNamespace,
  onSelect,
}: HybridTopologyProps): React.ReactElement {
  const [asTable, setAsTable] = useState(false);
  const model = useMemo(() => buildTopologyModel(items, entityNamespace), [items, entityNamespace]);
  const geo = useMemo(() => layout(model), [model]);

  const { fabric, sites, groups, duplicateVnis } = model;
  const hasAnything = sites.length > 0 || groups.length > 0 || !!fabric.cr;

  if (!hasAnything) {
    return (
      <Alert variant="info" title="Nothing to draw yet" isInline>
        No HybridFabric, CloudGateway or HybridNetwork is visible
        {entityNamespace ? ` in ${entityNamespace}` : ''}.
      </Alert>
    );
  }

  const poolPct =
    fabric.poolSize && fabric.allocated !== undefined && fabric.poolSize > 0
      ? Math.min((fabric.allocated / fabric.poolSize) * 100, 100)
      : 0;

  const summary = [
    `Fabric ${fabric.name}`,
    fabric.asn !== undefined ? `ASN ${fabric.asn}` : '',
    `${sites.length} site${sites.length === 1 ? '' : 's'}`,
    `${model.networkCount} tenant network${model.networkCount === 1 ? '' : 's'}`,
    `${model.placementCount} placement${model.placementCount === 1 ? '' : 's'}`,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="sc-hstopo">
      <div className="sc-hstopo__head">
        <div>
          <h3 className="sc-netov__title">Hybrid network topology</h3>
          <p className="sc-netov__hint">
            Fabric, gateways and their transport, attached sites, then each tenant VRF with the
            placements that land its prefixes on a cloud. A connector runs from every placement to
            the site its backend resolves to.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={asTable ? <TopologyIcon /> : <TableIcon />}
          onClick={() => setAsTable((v) => !v)}
        >
          {asTable ? 'Diagram view' : 'Table view'}
        </Button>
      </div>

      {duplicateVnis.length > 0 && (
        <Alert
          variant="danger"
          isInline
          title={`Duplicate VNI — tenant isolation is broken on ${duplicateVnis.length} VNI${
            duplicateVnis.length === 1 ? '' : 's'
          }`}
          className="sc-hstopo__alert"
        >
          <ul className="sc-hstopo__dup-list">
            {duplicateVnis.map((d) => (
              <li key={d.vni}>
                VNI <strong>{d.vni}</strong> is claimed by {d.networks.join(', ')}. One route target
                per VNI — these VRFs will leak into each other.
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {asTable ? (
        <TopologyTable model={model} />
      ) : (
        <>
          <div className="sc-hstopo__canvas-wrap">
            <svg
              className="sc-hstopo__canvas"
              viewBox={`0 0 ${geo.width} ${geo.height}`}
              width={geo.width}
              height={geo.height}
              role="img"
              aria-label={`Hybrid network topology. ${summary}.`}
            >
              {/* band 1 — fabric */}
              <g
                className={`sc-hstopo__fabric sc-hstopo__node--${fabric.state}`}
                {...nodeHandlers({
                  onActivate:
                    onSelect && fabric.cr ? () => onSelect('HybridFabric', fabric.cr!) : undefined,
                })}
              >
                <title>
                  {`HybridFabric ${fabric.name} — ${STATE_LABEL[fabric.state]}` +
                    (fabric.bgwEndpoint ? `\nborder gateway ${fabric.bgwEndpoint}` : '')}
                </title>
                <rect x={PAD} y={0} width={geo.contentW} height={FAB_H} rx={4} />
                <text x={PAD + 14} y={22} className="sc-hstopo__band-kind">
                  HYBRID FABRIC
                </text>
                <text x={PAD + 14} y={44} className="sc-hstopo__band-name">
                  {trunc(fabric.name, 34)}
                </text>
                <StateGlyph state={fabric.state} x={PAD + 22} y={62} />
                <text x={PAD + 34} y={66} className="sc-hstopo__band-state">
                  {STATE_LABEL[fabric.state]}
                </text>

                <FabricFacts
                  x={PAD + 250}
                  width={Math.max(geo.contentW - 266, 160)}
                  fabric={fabric}
                  poolPct={poolPct}
                />
              </g>

              {/* band 2 edges — fabric to gateway, carrying the transport */}
              {geo.sites.flatMap((s) =>
                s.gws.map((g) => {
                  const x1 = g.cx;
                  const y1 = FAB_H;
                  const y2 = GW_Y;
                  const my = (y1 + y2) / 2;
                  const d = `M ${x1} ${y1} C ${x1} ${my}, ${x1} ${my}, ${x1} ${y2}`;
                  const label = g.gw.tunnelled
                    ? `${g.gw.transport}${g.gw.linkName ? ` · ${g.gw.linkName}` : ''}`
                    : 'direct · no tunnel';
                  return (
                    <g key={`e-${g.gw.name}`}>
                      {/* A tunnelled transport gets a halo: encapsulation, drawn. */}
                      {g.gw.tunnelled && (
                        <path d={d} className={`sc-hstopo__tunnel sc-hstopo__tunnel--${g.gw.state}`} />
                      )}
                      <path d={d} className={`sc-hstopo__edge sc-hstopo__edge--${g.gw.state}`} />
                      <rect
                        x={x1 - 74}
                        y={my - 10}
                        width={148}
                        height={18}
                        rx={9}
                        className="sc-hstopo__edge-pill"
                      />
                      <text x={x1} y={my + 3} textAnchor="middle" className="sc-hstopo__edge-label">
                        {trunc(label, 24)}
                      </text>
                    </g>
                  );
                }),
              )}

              {/* band 2 — gateways */}
              {geo.sites.flatMap((s) =>
                s.gws.map((g) => (
                  <g
                    key={`gw-${g.gw.name}`}
                    transform={`translate(${g.x}, ${GW_Y})`}
                    className={`sc-hstopo__node sc-hstopo__node--${g.gw.state}`}
                    {...nodeHandlers({
                      onActivate: onSelect ? () => onSelect('CloudGateway', g.gw.cr) : undefined,
                    })}
                  >
                    <title>{`CloudGateway ${g.gw.name} — ${STATE_LABEL[g.gw.state]}\n${g.gw.detail}`}</title>
                    <rect width={g.w} height={GW_H} rx={3} />
                    <text x={10} y={17} className="sc-hstopo__node-kind">
                      GATEWAY
                    </text>
                    <text x={10} y={34} className="sc-hstopo__node-name">
                      {trunc(g.gw.name, Math.floor(g.w / 7.4))}
                    </text>
                    <text x={10} y={48} className="sc-hstopo__node-sub">
                      {trunc(
                        g.gw.tunnelled ? `transport ${g.gw.transport}` : 'transport none (direct)',
                        Math.floor(g.w / 6.2),
                      )}
                    </text>
                    <StateGlyph state={g.gw.state} x={16} y={57} />
                    <text x={28} y={61} className="sc-hstopo__node-state">
                      {STATE_LABEL[g.gw.state]}
                    </text>
                  </g>
                )),
              )}

              {/* gateway -> site membership */}
              {geo.sites.flatMap((s) =>
                s.gws.map((g) => (
                  <path
                    key={`gs-${g.gw.name}`}
                    d={`M ${g.cx} ${GW_Y + GW_H} C ${g.cx} ${SITE_Y - 16}, ${s.cx} ${
                      GW_Y + GW_H + 16
                    }, ${s.cx} ${SITE_Y}`}
                    className={`sc-hstopo__edge sc-hstopo__edge--${s.site.state}`}
                  />
                )),
              )}

              {/* band 3 — sites */}
              {geo.sites.map((s) => (
                <g
                  key={`site-${s.site.name}`}
                  transform={`translate(${s.x}, ${SITE_Y})`}
                  className={`sc-hstopo__node sc-hstopo__node--site sc-hstopo__node--${s.site.state}`}
                  {...nodeHandlers({
                    onActivate:
                      onSelect && s.site.cr
                        ? () => onSelect('CloudInfrastructure', s.site.cr!)
                        : undefined,
                  })}
                >
                  <title>
                    {`CloudInfrastructure ${s.site.name} (${s.site.type}) — ${
                      STATE_LABEL[s.site.state]
                    }` + (s.site.displayName ? `\n${s.site.displayName}` : '')}
                  </title>
                  <rect width={SITE_W} height={SITE_H} rx={3} />
                  <text x={10} y={17} className="sc-hstopo__node-kind">
                    SITE · {s.site.type.toUpperCase()}
                  </text>
                  <text x={10} y={35} className="sc-hstopo__node-name">
                    {trunc(s.site.name, 24)}
                  </text>
                  <text x={10} y={49} className="sc-hstopo__node-sub">
                    {trunc(s.site.displayName || s.site.type, 28)}
                  </text>
                  <StateGlyph state={s.site.state} x={16} y={58} />
                  <text x={28} y={62} className="sc-hstopo__node-state">
                    {STATE_LABEL[s.site.state]}
                  </text>
                </g>
              ))}

              {/* placement -> site connectors, routed through the lane */}
              {geo.groups.flatMap((g) =>
                g.cols.flatMap((c) =>
                  c.chips.map((chip) => {
                    const cx = geo.siteCx.get(chip.p.siteName);
                    if (cx === undefined) return null;
                    const cy = chip.y + CHIP_H / 2;
                    const laneY = GROUPS_Y - 18;
                    const d =
                      `M ${c.cardX} ${cy} H ${chip.gutterX} V ${laneY} ` +
                      `C ${chip.gutterX} ${SITE_Y + SITE_H + 20}, ${cx} ${laneY - 20}, ${cx} ${
                        SITE_Y + SITE_H
                      }`;
                    return (
                      <path
                        key={`pc-${chip.p.key}`}
                        d={d}
                        className={`sc-hstopo__link sc-hstopo__link--${chip.p.state}`}
                      />
                    );
                  }),
                ),
              )}

              {/* bands 4 & 5 — entity groups, VRFs and their placements */}
              {geo.groups.map((g) => (
                <g key={`grp-${g.group.entity}`}>
                  <rect
                    x={g.x}
                    y={GROUPS_Y}
                    width={g.width}
                    height={g.height}
                    rx={4}
                    className="sc-hstopo__group"
                  />
                  <text x={g.x + GROUP_PAD} y={GROUPS_Y + 15} className="sc-hstopo__group-label">
                    ENTITY · {trunc(g.group.entity.toUpperCase(), 28)}
                  </text>

                  {g.cols.map((c) => (
                    <g key={`col-${c.net.key}`}>
                      <g
                        transform={`translate(${c.cardX}, ${c.y})`}
                        className={`sc-hstopo__node sc-hstopo__node--vrf sc-hstopo__node--${c.net.state}`}
                        {...nodeHandlers({
                          onActivate: onSelect ? () => onSelect('HybridNetwork', c.net.cr) : undefined,
                        })}
                      >
                        <title>
                          {`HybridNetwork ${c.net.namespace}/${c.net.name} — ${
                            STATE_LABEL[c.net.state]
                          }` +
                            (c.net.vni !== undefined ? `\nVNI ${c.net.vni}` : '\nVNI not allocated') +
                            (c.net.rt ? `\nroute target ${c.net.rt}` : '') +
                            (c.net.description ? `\n${c.net.description}` : '')}
                        </title>
                        <rect width={CARD_W} height={NET_H} rx={3} />
                        <text x={10} y={16} className="sc-hstopo__node-kind">
                          TENANT VRF
                        </text>
                        <text x={10} y={34} className="sc-hstopo__node-name">
                          {trunc(c.net.name, 24)}
                        </text>
                        {/* VNI is the isolation boundary — loudest thing here. */}
                        <g
                          className={`sc-hstopo__vni${
                            c.net.duplicateVni ? ' sc-hstopo__vni--dup' : ''
                          }`}
                        >
                          <rect x={10} y={41} width={c.net.duplicateVni ? 150 : 86} height={20} rx={3} />
                          <text x={18} y={55} className="sc-hstopo__vni-text">
                            {c.net.vni !== undefined ? `VNI ${c.net.vni}` : 'VNI —'}
                            {c.net.duplicateVni ? ' ✖ DUPLICATE' : ''}
                          </text>
                        </g>
                        <text x={102} y={55} className="sc-hstopo__node-sub">
                          {c.net.duplicateVni ? '' : trunc(c.net.rt ? `RT ${c.net.rt}` : 'no RT', 16)}
                        </text>
                        <StateGlyph state={c.net.state} x={16} y={70} />
                        <text x={28} y={74} className="sc-hstopo__node-state">
                          {c.net.state === 'absent'
                            ? 'Not placed on any cloud'
                            : `${STATE_LABEL[c.net.state]} · ${c.net.placements.length} placement${
                                c.net.placements.length === 1 ? '' : 's'
                              }`}
                        </text>
                      </g>

                      {c.chips.map((chip) => (
                        <g
                          key={`chip-${chip.p.key}`}
                          transform={`translate(${c.cardX}, ${chip.y})`}
                          className={`sc-hstopo__node sc-hstopo__node--chip sc-hstopo__node--${chip.p.state}`}
                          {...nodeHandlers({
                            onActivate:
                              onSelect && chip.p.cr
                                ? () => onSelect('NetworkPlacement', chip.p.cr!)
                                : undefined,
                          })}
                        >
                          <title>
                            {`NetworkPlacement ${chip.p.name} — ${STATE_LABEL[chip.p.state]}\n` +
                              `backend ${chip.p.backendKind}/${chip.p.backendName}` +
                              `\nsite ${chip.p.siteName || 'unresolved'}` +
                              `\nprefixes ${chip.p.prefixes.join(', ') || 'none'}` +
                              `\nVM namespaces ${chip.p.vmNamespaces.join(', ') || 'none'}`}
                          </title>
                          <rect width={CARD_W} height={CHIP_H} rx={3} />
                          <text x={10} y={15} className="sc-hstopo__node-kind">
                            PLACEMENT
                          </text>
                          <text x={10} y={30} className="sc-hstopo__chip-name">
                            {trunc(`${chip.p.backendKind}/${chip.p.backendName}`, 28)}
                          </text>
                          <text x={10} y={43} className="sc-hstopo__chip-prefix">
                            {trunc(chip.p.prefixes.join(', ') || 'no prefixes', 30)}
                          </text>
                          <text x={10} y={55} className="sc-hstopo__node-sub">
                            {trunc(
                              `ns ${chip.p.vmNamespaces.join(', ') || '—'} → site ${
                                chip.p.siteName || 'unresolved'
                              }`,
                              34,
                            )}
                          </text>
                          <StateGlyph state={chip.p.state} x={16} y={63} />
                          <text x={28} y={67} className="sc-hstopo__node-state">
                            {STATE_LABEL[chip.p.state]}
                          </text>
                        </g>
                      ))}
                    </g>
                  ))}
                </g>
              ))}
            </svg>
          </div>
          <TopologyLegend />
        </>
      )}
    </div>
  );
}

function FabricFacts({
  x,
  width,
  fabric,
  poolPct,
}: {
  x: number;
  width: number;
  fabric: TopoFabric;
  poolPct: number;
}): React.ReactElement {
  const facts: Array<[string, string]> = [
    ['BORDER GATEWAY', fabric.bgwName || fabric.bgwEndpoint || '—'],
    ['DOMAIN ASN', fabric.asn !== undefined ? String(fabric.asn) : '—'],
    [
      'UNDERLAY',
      fabric.underlayCidr
        ? `${fabric.underlayCidr}${fabric.underlayMtu ? ` · MTU ${fabric.underlayMtu}` : ''}`
        : '—',
    ],
    ['TRANSPORT MTU', fabric.transportMtu !== undefined ? String(fabric.transportMtu) : '—'],
  ];
  // Cap the fact columns so a very wide canvas (many tenants) does not
  // smear four short facts across a metre of band.
  const colW = Math.min(Math.max(width / facts.length, 90), 230);
  const barW = Math.max(Math.min(width, colW * facts.length), 120);
  const poolLabel =
    fabric.vniStart !== undefined && fabric.vniEnd !== undefined
      ? `${fabric.vniStart}–${fabric.vniEnd}`
      : '—';
  const alloc = fabric.allocated ?? 0;

  return (
    <g>
      {facts.map(([k, v], i) => (
        <g key={k} transform={`translate(${x + i * colW}, 0)`}>
          <text y={20} className="sc-hstopo__fact-k">
            {k}
          </text>
          <text y={36} className="sc-hstopo__fact-v">
            {trunc(v, Math.floor(colW / 6.4))}
          </text>
        </g>
      ))}
      {/* VNI pool is a magnitude, so a single-hue bar — never a status colour. */}
      <g transform={`translate(${x}, 50)`}>
        <text y={10} className="sc-hstopo__fact-k">
          VNI POOL {poolLabel}
        </text>
        <rect y={16} width={barW} height={8} rx={4} className="sc-hstopo__pool-track" />
        <rect
          y={16}
          width={Math.max((barW * poolPct) / 100, poolPct > 0 ? 3 : 0)}
          height={8}
          rx={4}
          className="sc-hstopo__pool-fill"
        />
        <text y={36} className="sc-hstopo__fact-v">
          {fabric.poolSize !== undefined
            ? `${alloc} of ${fabric.poolSize} VNIs allocated (${Math.round(poolPct)}%)`
            : `${alloc} VNIs allocated`}
        </text>
      </g>
    </g>
  );
}

function TopologyLegend(): React.ReactElement {
  return (
    <div className="sc-hstopo__legends">
      <ul className="sc-netov__legend" aria-label="State legend">
        {(Object.keys(STATE_LABEL) as NetState[]).map((s) => (
          <li key={s} className="sc-hstopo__legend-item">
            <svg width={16} height={16} viewBox="-8 -8 16 16" aria-hidden="true">
              <StateGlyph state={s} x={0} y={0} />
            </svg>
            {STATE_LABEL[s]}
          </li>
        ))}
      </ul>
      <ul className="sc-netov__legend" aria-label="Transport legend">
        <li className="sc-hstopo__legend-item">
          <svg width={28} height={12} viewBox="0 0 28 12" aria-hidden="true">
            <path d="M 2 6 H 26" className="sc-hstopo__tunnel sc-hstopo__tunnel--ready" />
            <path d="M 2 6 H 26" className="sc-hstopo__edge sc-hstopo__edge--ready" />
          </svg>
          Tunnelled transport (haloed edge, e.g. wireguard)
        </li>
        <li className="sc-hstopo__legend-item">
          <svg width={28} height={12} viewBox="0 0 28 12" aria-hidden="true">
            <path d="M 2 6 H 26" className="sc-hstopo__edge sc-hstopo__edge--ready" />
          </svg>
          Direct attachment (no tunnel)
        </li>
        <li className="sc-hstopo__legend-item">
          <svg width={28} height={12} viewBox="0 0 28 12" aria-hidden="true">
            <path d="M 2 6 H 26" className="sc-hstopo__link sc-hstopo__link--ready" />
          </svg>
          Placement → site it lands on
        </li>
      </ul>
    </div>
  );
}

/** The required non-colour, non-geometry view of exactly the same model. */
function TopologyTable({ model }: { model: TopoModel }): React.ReactElement {
  const rows: Array<{
    key: string;
    entity: string;
    network: string;
    vni: string;
    rt: string;
    netState: NetState;
    placement: string;
    backend: string;
    site: string;
    prefixes: string;
    vmns: string;
    state: NetState;
    dup: boolean;
  }> = [];
  for (const g of model.groups) {
    for (const n of g.networks) {
      const base = {
        entity: g.entity,
        network: n.name,
        vni: n.vni !== undefined ? String(n.vni) : '—',
        rt: n.rt || '—',
        netState: n.state,
        dup: n.duplicateVni,
      };
      if (n.placements.length === 0) {
        rows.push({
          ...base,
          key: n.key,
          placement: '—',
          backend: '—',
          site: '—',
          prefixes: '—',
          vmns: '—',
          state: 'absent',
        });
        continue;
      }
      for (const p of n.placements) {
        rows.push({
          ...base,
          key: p.key,
          placement: p.name,
          backend: `${p.backendKind}/${p.backendName}`,
          site: p.siteName || 'unresolved',
          prefixes: p.prefixes.join(', ') || '—',
          vmns: p.vmNamespaces.join(', ') || '—',
          state: p.state,
        });
      }
    }
  }

  return (
    <div className="sc-netov__matrix-wrap">
      <table className="sc-netov__table">
        <caption className="pf-v6-screen-reader">
          Fabric attachments, then every tenant VRF with its placements, backends, sites, prefixes
          and VM namespaces
        </caption>
        <thead>
          <tr>
            <th scope="col">Gateway</th>
            <th scope="col">Transport</th>
            <th scope="col">Transport link</th>
            <th scope="col">Site</th>
            <th scope="col">Site type</th>
            <th scope="col">State</th>
          </tr>
        </thead>
        <tbody>
          {model.sites.flatMap((s) =>
            (s.gateways.length > 0
              ? s.gateways
              : ([undefined] as Array<TopoGateway | undefined>)
            ).map((gw, i) => (
              <tr key={`${s.name}-${gw?.name ?? i}`}>
                <td>{gw?.name ?? '— (no gateway)'}</td>
                <td>{gw ? (gw.tunnelled ? gw.transport : 'none (direct)') : '—'}</td>
                <td>{gw?.linkName || '—'}</td>
                <td>{s.name}</td>
                <td>{s.type}</td>
                <td>{STATE_LABEL[gw?.state ?? s.state]}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>

      <table className="sc-netov__table sc-hstopo__table2">
        <thead>
          <tr>
            <th scope="col">Entity</th>
            <th scope="col">Network (VRF)</th>
            <th scope="col">VNI</th>
            <th scope="col">Route target</th>
            <th scope="col">Placement</th>
            <th scope="col">Backend</th>
            <th scope="col">Site</th>
            <th scope="col">Prefixes</th>
            <th scope="col">VM namespaces</th>
            <th scope="col">State</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>{r.entity}</td>
              <td>{r.network}</td>
              <td>
                {r.vni}
                {r.dup ? ' (duplicate)' : ''}
              </td>
              <td>{r.rt}</td>
              <td>{r.placement}</td>
              <td>{r.backend}</td>
              <td>{r.site}</td>
              <td>{r.prefixes}</td>
              <td>{r.vmns}</td>
              <td>{STATE_LABEL[r.state]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default HybridTopology;
