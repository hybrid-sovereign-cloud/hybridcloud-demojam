import React, { useMemo, useRef, useState } from 'react';
import { Spinner, Alert, Button } from '@patternfly/react-core';
import {
  ExpandIcon,
  SearchPlusIcon,
  SearchMinusIcon,
  CompressAltIcon,
} from '@patternfly/react-icons';
import { HybridSovereignKind, K8sResource } from '../types';
import { useK8sResourceList } from '../hooks/k8s';
import { useOverviewCRs } from '../hooks/overviewCrs';
import { useCanListKind } from '../hooks/permissions';
import { normalizeHealth } from './StatusBadge';

export interface TopologyNode {
  id: string;
  label: string;
  kind: HybridSovereignKind | 'Group';
  status: 'ready' | 'pending' | 'failed' | 'reconciling' | 'unknown';
  namespace?: string;
  x?: number;
  y?: number;
  /**
   * Routing placeholder for an edge that spans more than one layer. Never
   * rendered: it reserves a narrow lane in the layer it passes through so the
   * edge is routed around the nodes there instead of straight over them.
   */
  virtual?: boolean;
  /** Laid-out width — NODE_W for real nodes, VIRTUAL_W for routing lanes. */
  w?: number;
}

export interface TopologyEdge {
  id: string;
  from: string;
  to: string;
  failed?: boolean;
}

export interface EntityTopologyProps {
  entityNamespace?: string;
  filterByPermissions?: boolean;
  /** Pre-fetched Overview CRs (avoids a second aggregate fetch on admin Overview). */
  resources?: K8sResource[];
  resourcesLoading?: boolean;
  resourcesError?: Error | null;
}

function itemsOfKind(items: K8sResource[], kind: HybridSovereignKind): K8sResource[] {
  return items.filter((i) => (i.kind || '') === kind);
}

/** spec.cloudRef.name — the CloudInfrastructure a cloud project or gateway sits on. */
function cloudRefOf(item: K8sResource): string {
  const ref = (item.spec as { cloudRef?: { name?: string } } | undefined)?.cloudRef;
  return typeof ref?.name === 'string' ? ref.name : '';
}

/** PlatformOpenshift type → kind of the cloud project named by spec.<type>.environment */
const PLATFORM_ENV_KIND: Record<string, HybridSovereignKind> = {
  hosted: 'CloudVirt',
  openstack: 'CloudOSO',
  aws: 'CloudAWS',
};

/** Cluster-scoped-ish kinds that genuinely live in one shared namespace. */
const PLATFORM_SCOPED_KINDS = new Set<string>(['HybridFabric', 'CloudInfrastructure']);

/**
 * Identity of a node in the graph. Tenant CRs live in `entity-<tenant>`
 * namespaces and their names are NOT globally unique (e.g. `local-virt` exists
 * in both `entity-acme-corp` and `entity-chad`), so every lookup has to be
 * keyed on namespace + kind + name — never on the bare name, and never on
 * array position.
 */
function nodeKey(kind: string, namespace: string | undefined, name: string): string {
  return `${kind}|${namespace ?? ''}|${name}`;
}

/** The entity that owns a tenant CR: its `.status.entity`, else `entity-<x>` namespace. */
function entityOf(item: K8sResource): string {
  const fromStatus = (item.status as { entity?: unknown } | undefined)?.entity;
  if (typeof fromStatus === 'string' && fromStatus) return fromStatus;
  const ns = item.metadata.namespace ?? '';
  return ns.startsWith('entity-') ? ns.slice('entity-'.length) : '';
}

const NODE_W = 150;
const NODE_H = 46;
const COL_GAP = 22; // horizontal gap between sibling nodes in a layer
const LAYER_GAP = 76; // vertical gap between layers — room for n:n edge fan-out
// Layer captions live in their own left gutter instead of floating over the
// first node of the row, which is what made the caption collide with the row.
const LABEL_GUTTER = 96;
const PAD_X = 16;
const PAD_Y = 16;
const LAYER_LABEL_H = 10;
// Edges leave/enter spread across the node edge rather than all stacking on the
// midpoint, so parallel n:n edges stay individually traceable.
const PORT_INSET = 16;
// Width of a routing lane reserved for a long edge passing through a layer.
const VIRTUAL_W = 14;

function statusFromReady(ready?: boolean, status?: string): TopologyNode['status'] {
  return normalizeHealth(ready, status);
}

function statusColor(status: TopologyNode['status']): string {
  if (status === 'ready') return 'var(--sc-success, #3e8635)';
  if (status === 'failed') return 'var(--sc-danger, #c9190b)';
  if (status === 'pending' || status === 'reconciling') return 'var(--sc-warning, #f0ab00)';
  return 'var(--sc-text-muted, #6a6e73)';
}

export interface TopologyLayer {
  title: string;
  y: number;
  /** Banding rect behind the row, so layers read apart at a glance. */
  bandY: number;
  bandH: number;
}

/**
 * Number of edge crossings between two adjacent, ordered layers.
 *
 * Two edges (u1→v1) and (u2→v2) cross when their endpoints are in opposite
 * order on the two layers. Counted directly: the layers here are tens of nodes,
 * not thousands, so the simple pairwise count is cheaper than the accumulator
 * tree it would take to do it in O(E log V).
 */
export function countCrossings(
  upper: string[],
  lower: string[],
  childrenOf: Map<string, string[]>,
): number {
  const upperIdx = new Map(upper.map((id, i) => [id, i]));
  const lowerIdx = new Map(lower.map((id, i) => [id, i]));
  const pairs: Array<[number, number]> = [];
  for (const u of upper) {
    const ui = upperIdx.get(u);
    if (ui === undefined) continue;
    for (const v of childrenOf.get(u) ?? []) {
      const vi = lowerIdx.get(v);
      if (vi !== undefined) pairs.push([ui, vi]);
    }
  }
  let crossings = 0;
  for (let i = 0; i < pairs.length; i += 1) {
    for (let j = i + 1; j < pairs.length; j += 1) {
      const [a1, b1] = pairs[i];
      const [a2, b2] = pairs[j];
      if ((a1 - a2) * (b1 - b2) < 0) crossings += 1;
    }
  }
  return crossings;
}

/**
 * Crossing reduction over the layered graph (the ordering phase of Sugiyama).
 *
 * A static per-layer sort — by owning entity, then kind, then name — cannot
 * lay out n:n relationships: once a child has several parents, and a parent
 * several children, no property of the node itself says where it belongs. The
 * position has to come from the graph. So: repeatedly reorder each layer by the
 * mean position of its neighbours in the adjacent layer (the barycentre),
 * sweeping down then up, and keep whichever ordering crossed least.
 *
 * The incoming order seeds the first pass and breaks ties thereafter, so the
 * result stays deterministic and still groups a tenant's resources together
 * wherever the graph leaves that free.
 */
export function reduceCrossings(
  layers: Array<{ title: string; nodes: TopologyNode[] }>,
  edges: Array<{ from: string; to: string }>,
  passes = 8,
): Array<{ title: string; nodes: TopologyNode[] }> {
  if (layers.length < 2) return layers;

  const childrenOf = new Map<string, string[]>();
  const parentsOf = new Map<string, string[]>();
  for (const e of edges) {
    if (!childrenOf.has(e.from)) childrenOf.set(e.from, []);
    childrenOf.get(e.from)!.push(e.to);
    if (!parentsOf.has(e.to)) parentsOf.set(e.to, []);
    parentsOf.get(e.to)!.push(e.from);
  }

  const nodeById = new Map<string, TopologyNode>();
  for (const l of layers) for (const n of l.nodes) nodeById.set(n.id, n);

  let order = layers.map((l) => l.nodes.map((n) => n.id));
  // Seed rank: the incoming sort. Used as the tie-break so nodes with no
  // neighbours in the adjacent layer hold their place instead of drifting.
  const seedRank = new Map<string, number>();
  order.forEach((ids) => ids.forEach((id, i) => seedRank.set(id, i)));

  const totalCrossings = (ord: string[][]): number => {
    let total = 0;
    for (let i = 0; i < ord.length - 1; i += 1) {
      total += countCrossings(ord[i], ord[i + 1], childrenOf);
    }
    return total;
  };

  const sweep = (ord: string[][], dir: 'down' | 'up'): string[][] => {
    const next = ord.map((ids) => ids.slice());
    const range =
      dir === 'down'
        ? Array.from({ length: next.length - 1 }, (_, k) => k + 1)
        : Array.from({ length: next.length - 1 }, (_, k) => next.length - 2 - k);
    for (const i of range) {
      const adjacent = dir === 'down' ? next[i - 1] : next[i + 1];
      const adjIdx = new Map(adjacent.map((id, k) => [id, k]));
      const neighbours = dir === 'down' ? parentsOf : childrenOf;
      const bary = new Map<string, number>();
      next[i].forEach((id, selfIdx) => {
        const ns = (neighbours.get(id) ?? [])
          .map((n) => adjIdx.get(n))
          .filter((v): v is number => v !== undefined);
        // No neighbour in that direction: stay put rather than collapse to 0.
        bary.set(id, ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : selfIdx);
      });
      next[i] = next[i]
        .map((id, k) => ({ id, k }))
        .sort(
          (a, b) =>
            (bary.get(a.id) ?? 0) - (bary.get(b.id) ?? 0) ||
            (seedRank.get(a.id) ?? 0) - (seedRank.get(b.id) ?? 0) ||
            a.k - b.k,
        )
        .map((e) => e.id);
    }
    return next;
  };

  let best = order;
  let bestScore = totalCrossings(order);
  for (let p = 0; p < passes && bestScore > 0; p += 1) {
    order = sweep(order, p % 2 === 0 ? 'down' : 'up');
    const score = totalCrossings(order);
    if (score < bestScore) {
      bestScore = score;
      best = order;
    }
  }

  return layers.map((l, i) => ({
    title: l.title,
    nodes: best[i].map((id) => nodeById.get(id)!).filter(Boolean),
  }));
}

/**
 * Split every edge that spans more than one layer into a chain of
 * single-layer hops joined by virtual nodes.
 *
 * This is the part a plain layered sort cannot do. A CloudInfrastructure links
 * straight to a tenant's cloud project, two layers below, so the edge is drawn
 * straight through the Entities row — over the top of entity nodes and across
 * every other long edge doing the same thing. On this cluster 9 of 24 edges
 * (37%) span more than one layer, and that fraction only grows with tenant
 * count, which is why large deployments turn into a hairball.
 *
 * Giving each long edge a reserved lane in the layers it crosses means it gets
 * ordered alongside everything else by the barycentre sweep, so it routes
 * *around* the nodes in between instead of over them.
 */
export function insertVirtualNodes(
  layers: Array<{ title: string; nodes: TopologyNode[] }>,
  edges: Array<{ from: string; to: string; failed?: boolean }>,
): {
  layers: Array<{ title: string; nodes: TopologyNode[] }>;
  segments: Array<{ from: string; to: string }>;
  routes: Map<string, string[]>;
} {
  const layerOf = new Map<string, number>();
  layers.forEach((l, i) => l.nodes.forEach((n) => layerOf.set(n.id, i)));

  const out = layers.map((l) => ({ title: l.title, nodes: l.nodes.slice() }));
  const segments: Array<{ from: string; to: string }> = [];
  const routes = new Map<string, string[]>();

  for (const e of edges) {
    const a = layerOf.get(e.from);
    const b = layerOf.get(e.to);
    if (a === undefined || b === undefined) continue;
    const edgeId = `${e.from}->${e.to}`;
    if (b - a <= 1) {
      segments.push({ from: e.from, to: e.to });
      routes.set(edgeId, []);
      continue;
    }
    const chain: string[] = [];
    let prev = e.from;
    for (let l = a + 1; l < b; l += 1) {
      const vid = `__virtual|${edgeId}|${l}`;
      out[l].nodes.push({
        id: vid,
        label: '',
        kind: 'Group',
        status: 'unknown',
        virtual: true,
      });
      segments.push({ from: prev, to: vid });
      chain.push(vid);
      prev = vid;
    }
    segments.push({ from: prev, to: e.to });
    routes.set(edgeId, chain);
  }

  return { layers: out, segments, routes };
}

/**
 * Top-down layered layout: one layer per row, flowing downward, matching the
 * layered look of the hybrid network topology diagram. Each layer is centred on
 * a common content width so parents sit above their children.
 *
 * Node widths vary: a virtual routing lane is a sliver, not a full box.
 */
function layoutLayers(layers: Array<{ title: string; nodes: TopologyNode[] }>): {
  nodes: TopologyNode[];
  rows: TopologyLayer[];
  width: number;
  height: number;
} {
  const widthOf = (n: TopologyNode) => (n.virtual ? VIRTUAL_W : NODE_W);
  const rowWidth = (ns: TopologyNode[]) =>
    ns.reduce((sum, n) => sum + widthOf(n), 0) + Math.max(ns.length - 1, 0) * COL_GAP;

  const contentW = Math.max(NODE_W, ...layers.map((l) => rowWidth(l.nodes)));
  const originX = PAD_X + LABEL_GUTTER;

  const placed: TopologyNode[] = [];
  const rows: TopologyLayer[] = [];
  let y = PAD_Y;

  for (const layer of layers) {
    const startX = originX + (contentW - rowWidth(layer.nodes)) / 2;
    const nodeY = y + LAYER_LABEL_H;
    rows.push({ title: layer.title, y, bandY: nodeY - 8, bandH: NODE_H + 16 });
    let x = startX;
    for (const node of layer.nodes) {
      placed.push({ ...node, x, y: nodeY, w: widthOf(node) });
      x += widthOf(node) + COL_GAP;
    }
    y = nodeY + NODE_H + LAYER_GAP;
  }

  return {
    nodes: placed,
    rows,
    width: originX + contentW + PAD_X,
    height: y - LAYER_GAP + PAD_Y,
  };
}

/**
 * Vertical cubic connector: leaves the bottom of `from`, enters the top of
 * `to`. `x1`/`x2` are port positions rather than node midpoints — with n:n
 * edges a shared midpoint turns every hub node into an unreadable starburst.
 */
function edgePath(
  from: TopologyNode,
  to: TopologyNode,
  x1: number,
  x2: number,
  waypoints: TopologyNode[] = [],
): string {
  const y1 = (from.y ?? 0) + NODE_H;
  const y2 = to.y ?? 0;
  if (!waypoints.length) {
    const my = (y1 + y2) / 2;
    return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
  }
  // Long edge. All sideways movement happens in the gap *between* layers; the
  // edge then drops straight down its reserved lane. Curving across the band
  // instead would sweep the line over the very nodes the lane exists to avoid.
  type Pt = { x: number; y: number; straight?: boolean };
  const pts: Pt[] = [{ x: x1, y: y1 }];
  for (const w of waypoints) {
    const wx = (w.x ?? 0) + (w.w ?? VIRTUAL_W) / 2;
    pts.push({ x: wx, y: w.y ?? 0 });
    // Vertical pass-through of the band, drawn as a line, not a curve.
    pts.push({ x: wx, y: (w.y ?? 0) + NODE_H, straight: true });
  }
  pts.push({ x: x2, y: y2 });

  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i += 1) {
    const prev = pts[i - 1];
    const cur = pts[i];
    if (cur.straight) {
      d += ` L ${cur.x} ${cur.y}`;
    } else {
      const my = (prev.y + cur.y) / 2;
      d += ` C ${prev.x} ${my}, ${cur.x} ${my}, ${cur.x} ${cur.y}`;
    }
  }
  return d;
}

/**
 * Spread each node's edges across its width instead of stacking them on the
 * midpoint. Outgoing ports are ordered by where the edge is heading and
 * incoming ports by where it came from, so ports and edges run in the same
 * left-to-right order and sibling edges stay parallel instead of braiding.
 */
function assignPorts(
  edges: TopologyEdge[],
  nodeById: Map<string, TopologyNode>,
): { out: Map<string, number>; in: Map<string, number> } {
  const out = new Map<string, number>();
  const inc = new Map<string, number>();
  const group = (key: (e: TopologyEdge) => string, other: (e: TopologyEdge) => string) => {
    const buckets = new Map<string, TopologyEdge[]>();
    for (const e of edges) {
      const k = key(e);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k)!.push(e);
    }
    return { buckets, other };
  };
  const place = (
    buckets: Map<string, TopologyEdge[]>,
    other: (e: TopologyEdge) => string,
    target: Map<string, number>,
  ) => {
    for (const [nodeId, group_] of buckets) {
      const self = nodeById.get(nodeId);
      if (!self) continue;
      const sorted = group_
        .slice()
        .sort(
          (a, b) =>
            ((nodeById.get(other(a))?.x ?? 0) - (nodeById.get(other(b))?.x ?? 0)) ||
            a.id.localeCompare(b.id),
        );
      const usable = (self.w ?? NODE_W) - PORT_INSET * 2;
      sorted.forEach((e, i) => {
        const t = sorted.length === 1 ? 0.5 : (i + 0.5) / sorted.length;
        target.set(e.id, (self.x ?? 0) + PORT_INSET + usable * t);
      });
    }
  };
  const o = group((e) => e.from, (e) => e.to);
  place(o.buckets, o.other, out);
  const i = group((e) => e.to, (e) => e.from);
  place(i.buckets, i.other, inc);
  return { out, in: inc };
}

/**
 * Status as a drawn shape as well as a colour, so the legend survives
 * greyscale, print and forced-colors mode.
 */
function StatusGlyph({ status, x, y }: { status: TopologyNode['status']; x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`} className="sc-topology-node__glyph">
      <circle cx={0} cy={0} r={5.5} fill={statusColor(status)} />
      {status === 'ready' && <path d="M -2.6 0 L -0.8 2 L 2.8 -2" className="sc-topology-node__mark" />}
      {status === 'failed' && (
        <path d="M -2.2 -2.2 L 2.2 2.2 M 2.2 -2.2 L -2.2 2.2" className="sc-topology-node__mark" />
      )}
      {(status === 'pending' || status === 'reconciling') && (
        <path d="M 0 -2.8 L 0 0 L 2.2 1.4" className="sc-topology-node__mark" />
      )}
      {status === 'unknown' && <path d="M -2.6 0 L 2.6 0" className="sc-topology-node__mark" />}
    </g>
  );
}

/** The same glyph at legend size, as a standalone inline SVG. */
function LegendGlyph({ status }: { status: TopologyNode['status'] }): React.ReactElement {
  return (
    <svg className="sc-topo-legend__glyph" width={14} height={14} viewBox="-7 -7 14 14" aria-hidden="true">
      <StatusGlyph status={status} x={0} y={0} />
    </svg>
  );
}

/** Live entity topology — layered SVG graph matching design-assets */
export function EntityTopology({
  entityNamespace,
  filterByPermissions = false,
  resources,
  resourcesLoading,
  resourcesError,
}: EntityTopologyProps): React.ReactElement {
  const ns = entityNamespace ?? '';
  const scoped = !!entityNamespace;
  // Admin platform view: never hit cluster-scoped list URLs (console proxy 404s).
  const useParentResources = !scoped && resources !== undefined;
  const overview = useOverviewCRs(0, { enabled: !scoped && !useParentResources });

  const teams = useK8sResourceList<K8sResource>('Team', {
    namespace: entityNamespace,
    enabled: scoped,
  });
  const projects = useK8sResourceList<K8sResource>('Project', {
    namespace: entityNamespace,
    enabled: scoped,
  });
  const assignments = useK8sResourceList<K8sResource>('Assignment', {
    namespace: entityNamespace,
    enabled: scoped,
  });
  const platforms = useK8sResourceList<K8sResource>('PlatformOpenshift', {
    namespace: entityNamespace,
    enabled: scoped,
  });
  const cloudOso = useK8sResourceList<K8sResource>('CloudOSO', {
    namespace: entityNamespace,
    enabled: scoped,
  });
  const cloudAws = useK8sResourceList<K8sResource>('CloudAWS', {
    namespace: entityNamespace,
    enabled: scoped,
  });
  const cloudVirt = useK8sResourceList<K8sResource>('CloudVirt', {
    namespace: entityNamespace,
    enabled: scoped,
  });
  // Tenants usually cannot list sovereign-cloud; infra nodes then come from cloudRef names alone.
  const cloudInfra = useK8sResourceList<K8sResource>('CloudInfrastructure', {
    namespace: 'sovereign-cloud',
    enabled: scoped,
  });

  const aggregateItems = useParentResources ? resources ?? [] : overview.items;
  const entityItems = scoped ? [] : itemsOfKind(aggregateItems, 'Entity');
  const teamItems = scoped ? teams.items : itemsOfKind(aggregateItems, 'Team');
  const projectItems = scoped ? projects.items : itemsOfKind(aggregateItems, 'Project');
  const assignmentItems = scoped ? assignments.items : itemsOfKind(aggregateItems, 'Assignment');
  const platformItems = scoped
    ? platforms.items
    : itemsOfKind(aggregateItems, 'PlatformOpenshift');
  const cloudOsoItems = scoped ? cloudOso.items : itemsOfKind(aggregateItems, 'CloudOSO');
  const cloudAwsItems = scoped ? cloudAws.items : itemsOfKind(aggregateItems, 'CloudAWS');
  const cloudVirtItems = scoped ? cloudVirt.items : itemsOfKind(aggregateItems, 'CloudVirt');
  const cloudInfraItems = scoped
    ? cloudInfra.error
      ? []
      : cloudInfra.items
    : itemsOfKind(aggregateItems, 'CloudInfrastructure');
  const fabricItems = scoped ? [] : itemsOfKind(aggregateItems, 'HybridFabric');
  const gatewayItems = scoped ? [] : itemsOfKind(aggregateItems, 'CloudGateway');

  const permNs = ns || 'sovereign-cloud';
  const teamPerm = useCanListKind(permNs, 'Team', { enabled: filterByPermissions });
  const projectPerm = useCanListKind(permNs, 'Project', { enabled: filterByPermissions });
  const assignmentPerm = useCanListKind(permNs, 'Assignment', { enabled: filterByPermissions });
  const platformPerm = useCanListKind(permNs, 'PlatformOpenshift', { enabled: filterByPermissions });
  const cloudOsoPerm = useCanListKind(permNs, 'CloudOSO', { enabled: filterByPermissions });
  const cloudAwsPerm = useCanListKind(permNs, 'CloudAWS', { enabled: filterByPermissions });
  const cloudVirtPerm = useCanListKind(permNs, 'CloudVirt', { enabled: filterByPermissions });

  const [zoom, setZoom] = useState(1);
  // Hovered/focused node. Dense n:n graphs are only readable one neighbourhood
  // at a time, so pointing at a node mutes everything it does not touch.
  const [focusId, setFocusId] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const graph = useMemo(() => {
    const allow = (ok: boolean) => !filterByPermissions || ok;
    const toNode = (item: K8sResource, kind: HybridSovereignKind): TopologyNode => ({
      id: nodeKey(kind, item.metadata.namespace, item.metadata.name),
      label: item.metadata.name,
      kind,
      namespace: item.metadata.namespace,
      status: statusFromReady(item.status?.ready, item.status?.status),
    });

    type AssignSpec = {
      team?: string;
      projects?: string[];
      openshift?: string;
      aws?: string;
      cloudoso?: string;
    };

    const entityNodes: TopologyNode[] = entityNamespace
      ? [
          {
            id: nodeKey('Entity', entityNamespace, entityNamespace.replace(/^entity-/, '')),
            label: entityNamespace.replace(/^entity-/, ''),
            kind: 'Entity',
            status: 'ready',
            namespace: entityNamespace,
          },
        ]
      : entityItems.map((e) => toNode(e, 'Entity'));

    const teamNodes = allow(teamPerm.allowed) ? teamItems.map((i) => toNode(i, 'Team')) : [];
    const projectNodes = allow(projectPerm.allowed)
      ? projectItems.map((i) => toNode(i, 'Project'))
      : [];
    const assignmentNodes = allow(assignmentPerm.allowed)
      ? assignmentItems.map((i) => toNode(i, 'Assignment'))
      : [];
    const platformNodes = allow(platformPerm.allowed)
      ? platformItems.map((i) => toNode(i, 'PlatformOpenshift'))
      : [];
    const visibleClouds: Array<{ item: K8sResource; kind: HybridSovereignKind }> = [
      ...(allow(cloudOsoPerm.allowed) ? cloudOsoItems.map((item) => ({ item, kind: 'CloudOSO' as const })) : []),
      ...(allow(cloudAwsPerm.allowed) ? cloudAwsItems.map((item) => ({ item, kind: 'CloudAWS' as const })) : []),
      ...(allow(cloudVirtPerm.allowed) ? cloudVirtItems.map((item) => ({ item, kind: 'CloudVirt' as const })) : []),
    ];
    const cloudNodes = visibleClouds.map(({ item, kind }) => toNode(item, kind));
    const fabricNodes = fabricItems.map((i) => toNode(i, 'HybridFabric'));

    // Site nodes: CloudInfrastructure objects, plus any cloudRef name we cannot read (tenant view).
    const infraNodes = cloudInfraItems.map((i) => toNode(i, 'CloudInfrastructure'));
    const infraNames = new Set(infraNodes.map((n) => n.label));
    const referencedInfra = [
      ...visibleClouds.map(({ item }) => cloudRefOf(item)),
      ...gatewayItems.map(cloudRefOf),
    ].filter(Boolean);
    for (const infraName of referencedInfra) {
      if (infraNames.has(infraName)) continue;
      infraNames.add(infraName);
      infraNodes.push({
        id: nodeKey('CloudInfrastructure', 'sovereign-cloud', infraName),
        label: infraName,
        kind: 'CloudInfrastructure',
        namespace: 'sovereign-cloud',
        status: 'unknown',
      });
    }

    // ---------------------------------------------------------------- edges
    // Every node is identified by namespace|kind|name. Tenant CR names are not
    // globally unique (`local-virt` exists in entity-acme-corp AND entity-chad),
    // so an edge is only ever built between two resolved node keys — never by
    // bare name and never by array position.
    const allNodes: TopologyNode[] = [
      ...entityNodes,
      ...teamNodes,
      ...projectNodes,
      ...assignmentNodes,
      ...platformNodes,
      ...cloudNodes,
      ...fabricNodes,
      ...infraNodes,
    ];
    const byKey = new Map(allNodes.map((n) => [n.id, n]));

    /**
     * Resolve a CR reference to a node key. A reference inside a tenant CR is
     * namespace-local, so it must resolve inside `ns`. Only the two
     * platform-scoped kinds (HybridFabric, CloudInfrastructure) may fall back
     * to the shared `sovereign-cloud` namespace.
     */
    const resolve = (kind: string, ns: string | undefined, name: string): string | undefined => {
      if (!name) return undefined;
      const local = nodeKey(kind, ns, name);
      if (byKey.has(local)) return local;
      if (PLATFORM_SCOPED_KINDS.has(kind)) {
        const shared = nodeKey(kind, 'sovereign-cloud', name);
        if (byKey.has(shared)) return shared;
      }
      return undefined;
    };

    const edgePairs: Array<{ from: string; to: string; failed?: boolean }> = [];
    const link = (from: string | undefined, to: string | undefined, failed?: boolean) => {
      if (!from || !to || from === to) return;
      edgePairs.push({ from, to, failed });
    };

    // Assignment ← Team / Project / PlatformOpenshift / CloudAWS / CloudOSO.
    // All of these refs are plain names inside the Assignment's own namespace.
    if (allow(assignmentPerm.allowed)) {
      for (const a of assignmentItems) {
        const ans = a.metadata.namespace;
        const spec = (a.spec || {}) as AssignSpec;
        const self = resolve('Assignment', ans, a.metadata.name);
        const failed = statusFromReady(a.status?.ready, a.status?.status) === 'failed';
        if (spec.team) link(resolve('Team', ans, spec.team), self, failed);
        for (const pName of spec.projects ?? []) link(resolve('Project', ans, pName), self, failed);
        if (spec.openshift) link(resolve('PlatformOpenshift', ans, spec.openshift), self, failed);
        if (spec.aws) link(resolve('CloudAWS', ans, spec.aws), self, failed);
        if (spec.cloudoso) link(resolve('CloudOSO', ans, spec.cloudoso), self, failed);
      }
    }

    // HybridFabric → CloudInfrastructure through each CloudGateway (fabricRef + cloudRef).
    for (const g of gatewayItems) {
      const gns = g.metadata.namespace;
      const fabricName = (g.spec as { fabricRef?: string } | undefined)?.fabricRef;
      const infraName = cloudRefOf(g);
      if (!fabricName || !infraName) continue;
      link(
        resolve('HybridFabric', gns, fabricName),
        resolve('CloudInfrastructure', gns, infraName),
        statusFromReady(g.status?.ready, g.status?.status) === 'failed',
      );
    }

    // CloudInfrastructure → tenant cloud project (spec.cloudRef → sovereign-cloud).
    for (const { item, kind } of visibleClouds) {
      const infraName = cloudRefOf(item);
      if (!infraName) continue;
      link(
        resolve('CloudInfrastructure', item.metadata.namespace, infraName),
        nodeKey(kind, item.metadata.namespace, item.metadata.name),
        statusFromReady(item.status?.ready, item.status?.status) === 'failed',
      );
    }

    // Cloud project → PlatformOpenshift (spec.<type>.environment, same namespace).
    const platformHasCloudParent = new Set<string>();
    if (allow(platformPerm.allowed)) {
      for (const p of platformItems) {
        const pns = p.metadata.namespace;
        const spec = (p.spec ?? {}) as { type?: string } & Record<string, unknown>;
        const cloudKind = PLATFORM_ENV_KIND[spec.type ?? ''];
        const env = (spec[spec.type ?? ''] as { environment?: string } | undefined)?.environment;
        if (!cloudKind || !env) continue;
        const cloud = resolve(cloudKind, pns, env);
        const self = nodeKey('PlatformOpenshift', pns, p.metadata.name);
        if (!cloud) continue;
        platformHasCloudParent.add(self);
        link(cloud, self, statusFromReady(p.status?.ready, p.status?.status) === 'failed');
      }
    }

    // Entity → everything it owns. Ownership comes from the resource's OWN
    // namespace (`entity-<name>`) or its `.status.entity`, never from name
    // similarity: that is what mis-attached `onix-aws` to entity `bulbasaur`.
    const entityNodeByName = new Map(entityNodes.map((e) => [e.label, e]));
    const ownerNode = (item: K8sResource): TopologyNode | undefined => {
      const name = entityOf(item);
      if (!name) return undefined;
      const e = entityNodeByName.get(name);
      // In scoped mode there is exactly one Entity node; only claim resources
      // that really sit in that entity's namespace.
      if (!e) return undefined;
      if (entityNamespace && item.metadata.namespace !== entityNamespace) return undefined;
      return e;
    };

    for (const { item, kind } of visibleClouds) {
      const e = ownerNode(item);
      if (!e) continue;
      link(
        e.id,
        nodeKey(kind, item.metadata.namespace, item.metadata.name),
        statusFromReady(item.status?.ready, item.status?.status) === 'failed',
      );
    }

    if (allow(teamPerm.allowed)) {
      for (const t of teamItems) {
        const e = ownerNode(t);
        link(e?.id, nodeKey('Team', t.metadata.namespace, t.metadata.name));
      }
    }

    // A PlatformOpenshift hangs off its cloud project when it has one; only
    // orphans attach straight to the entity, so the chain stays a single spine.
    if (allow(platformPerm.allowed)) {
      for (const p of platformItems) {
        const self = nodeKey('PlatformOpenshift', p.metadata.namespace, p.metadata.name);
        if (platformHasCloudParent.has(self)) continue;
        const e = ownerNode(p);
        link(e?.id, self, statusFromReady(p.status?.ready, p.status?.status) === 'failed');
      }
    }

    // Likewise, an Assignment only attaches to its entity if nothing upstream claimed it.
    if (allow(assignmentPerm.allowed)) {
      const claimed = new Set(edgePairs.map((ep) => ep.to));
      for (const a of assignmentItems) {
        const self = nodeKey('Assignment', a.metadata.namespace, a.metadata.name);
        if (claimed.has(self)) continue;
        const e = ownerNode(a);
        link(e?.id, self, statusFromReady(a.status?.ready, a.status?.status) === 'failed');
      }
    }

    // --------------------------------------------------------------- pruning
    const referenced = new Set<string>();
    for (const ep of edgePairs) {
      referenced.add(ep.from);
      referenced.add(ep.to);
    }
    const keep = (n: TopologyNode) =>
      n.kind === 'Entity' ||
      (!entityNamespace && (n.kind === 'HybridFabric' || n.kind === 'CloudInfrastructure')) ||
      referenced.has(n.id);

    // -------------------------------------------------------------- ordering
    // Sort each layer by owning entity, then kind, then name, so a tenant's
    // resources sit under its Entity and edges run mostly straight down.
    const entityOrder = new Map(entityNodes.map((e, i) => [e.label, i]));
    const ownerRank = (n: TopologyNode): number => {
      const name = (n.namespace ?? '').startsWith('entity-')
        ? (n.namespace ?? '').slice('entity-'.length)
        : '';
      return entityOrder.get(name) ?? Number.MAX_SAFE_INTEGER;
    };
    const byOwner = (a: TopologyNode, b: TopologyNode) =>
      ownerRank(a) - ownerRank(b) ||
      a.kind.localeCompare(b.kind) ||
      a.label.localeCompare(b.label);

    const sorted = (ns2: TopologyNode[]) => ns2.filter(keep).sort(byOwner);

    const filteredTeams = sorted(teamNodes);
    const filteredProjects = sorted(projectNodes);
    const filteredAssignments = sorted(assignmentNodes);
    const filteredPlatforms = sorted(platformNodes);
    const filteredClouds = sorted(cloudNodes);
    const filteredFabrics = fabricNodes.filter(keep);
    const filteredInfra = infraNodes.filter(keep).sort((a, b) => a.label.localeCompare(b.label));

    // --------------------------------------------------------- top-down layers
    const layers = (
      entityNamespace
        ? [
            { title: 'Entity', nodes: entityNodes },
            { title: 'Teams', nodes: filteredTeams },
            { title: 'Projects', nodes: filteredProjects },
            { title: 'Sites', nodes: filteredInfra },
            { title: 'Cloud projects', nodes: filteredClouds },
            { title: 'Clusters', nodes: filteredPlatforms },
            { title: 'Assignments', nodes: filteredAssignments },
          ]
        : [
            { title: 'Fabric', nodes: filteredFabrics },
            { title: 'Sites', nodes: filteredInfra },
            { title: 'Entities', nodes: entityNodes },
            { title: 'Cloud projects', nodes: filteredClouds },
            { title: 'Clusters', nodes: filteredPlatforms },
            { title: 'Assignments', nodes: filteredAssignments },
          ]
    ).filter((l) => l.nodes.length > 0);

    // Only edges between nodes that survived pruning can inform the ordering.
    const live = new Set(layers.flatMap((l) => l.nodes.map((n) => n.id)));
    const liveEdges = edgePairs.filter((ep) => live.has(ep.from) && live.has(ep.to));

    // Dedupe before routing so a repeated pair does not reserve two lanes.
    const uniquePairs: Array<{ from: string; to: string; failed?: boolean }> = [];
    const pairSeen = new Set<string>();
    for (const ep of liveEdges) {
      const id = `${ep.from}->${ep.to}`;
      if (pairSeen.has(id)) continue;
      pairSeen.add(id);
      uniquePairs.push(ep);
    }

    // Long edges get routing lanes first, then the whole augmented graph —
    // real nodes and lanes together — goes through crossing reduction.
    const withLanes = insertVirtualNodes(layers, uniquePairs);
    const ordered = reduceCrossings(withLanes.layers, withLanes.segments);
    const { nodes: allPlaced, rows, width, height } = layoutLayers(ordered);
    const placedByKey = new Map(allPlaced.map((n) => [n.id, n]));
    // Virtual lanes exist only to steer the routing; they are never drawn.
    const nodes = allPlaced.filter((n) => !n.virtual);

    const edges: TopologyEdge[] = [];
    for (const ep of uniquePairs) {
      const from = placedByKey.get(ep.from);
      const to = placedByKey.get(ep.to);
      if (!from || !to) continue;
      edges.push({ id: `${from.id}->${to.id}`, from: from.id, to: to.id, failed: ep.failed });
    }

    const ports = assignPorts(edges, placedByKey);
    const waypoints = new Map<string, TopologyNode[]>(
      edges.map((e) => [
        e.id,
        (withLanes.routes.get(e.id) ?? [])
          .map((vid) => placedByKey.get(vid))
          .filter((n): n is TopologyNode => !!n),
      ]),
    );

    // Adjacency drives the hover focus: in a dense n:n graph the only reliable
    // way to read one resource's relationships is to mute everything else.
    const neighbours = new Map<string, Set<string>>();
    const touch = (a: string, b: string) => {
      if (!neighbours.has(a)) neighbours.set(a, new Set());
      neighbours.get(a)!.add(b);
    };
    for (const e of edges) {
      touch(e.from, e.to);
      touch(e.to, e.from);
    }

    return {
      nodes,
      edges,
      rows,
      ports,
      waypoints,
      neighbours,
      width: Math.max(width, 480),
      height: Math.max(height, 200),
    };
  }, [
    entityNamespace,
    entityItems,
    teamItems,
    projectItems,
    assignmentItems,
    platformItems,
    cloudOsoItems,
    cloudAwsItems,
    cloudVirtItems,
    cloudInfraItems,
    fabricItems,
    gatewayItems,
    filterByPermissions,
    teamPerm.allowed,
    projectPerm.allowed,
    assignmentPerm.allowed,
    platformPerm.allowed,
    cloudOsoPerm.allowed,
    cloudAwsPerm.allowed,
    cloudVirtPerm.allowed,
  ]);

  const nodeById = useMemo(
    () => new Map(graph.nodes.map((n) => [n.id, n])),
    [graph.nodes],
  );

  const loading = scoped
    ? teams.loading ||
      projects.loading ||
      assignments.loading ||
      platforms.loading ||
      cloudOso.loading ||
      cloudAws.loading ||
      cloudVirt.loading
    : useParentResources
      ? !!resourcesLoading
      : overview.loading;

  const listError = scoped
    ? teams.error ||
      projects.error ||
      assignments.error ||
      platforms.error ||
      cloudOso.error ||
      cloudAws.error ||
      cloudVirt.error
    : useParentResources
      ? resourcesError ?? null
      : overview.error;

  if (loading && graph.nodes.length === 0) {
    return <Spinner aria-label="Loading topology" />;
  }

  if (listError && graph.nodes.length === 0) {
    return (
      <Alert variant="warning" title="Unable to load topology" isInline>
        {listError.message || 'Failed to list Hybrid Sovereign resources.'}
      </Alert>
    );
  }

  if (graph.nodes.length === 0) {
    return (
      <Alert variant="info" title="No topology data" isInline>
        {filterByPermissions
          ? `No resources visible for your access in ${
              entityNamespace ? `namespace ${entityNamespace}` : 'the platform'
            }.`
          : `No Hybrid Sovereign resources found for ${
              entityNamespace ? `namespace ${entityNamespace}` : 'the platform'
            }.`}
      </Alert>
    );
  }

  // The graph now flows top-down, so "fit" has to respect the viewport height
  // as well as its width.
  const fit = () => {
    const el = wrapRef.current;
    if (!el) return;
    const sw = (el.clientWidth - 16) / graph.width;
    const sh = el.clientHeight > 0 ? (el.clientHeight - 16) / graph.height : Infinity;
    setZoom(Math.max(0.4, Math.min(1, sw, sh)));
  };

  return (
    <div className="sc-topology-graph" aria-label="Entity topology">
      <div className="sc-topology-graph__toolbar">
        {/* Status is carried by the glyph shape and the text label as well as
            the colour, so it survives greyscale and forced-colors. */}
        <div className="sc-topo-legend">
          <span>
            <LegendGlyph status="ready" /> Healthy
          </span>
          <span>
            <LegendGlyph status="failed" /> Failed
          </span>
          <span>
            <LegendGlyph status="pending" /> Pending
          </span>
        </div>
        <div className="sc-topology-graph__controls">
          <Button variant="plain" size="sm" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}>
            <SearchPlusIcon />
          </Button>
          <Button variant="plain" size="sm" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}>
            <SearchMinusIcon />
          </Button>
          <Button variant="secondary" size="sm" icon={<CompressAltIcon />} onClick={fit}>
            Fit to view
          </Button>
          <Button
            variant="plain"
            size="sm"
            aria-label="Fullscreen"
            onClick={() => wrapRef.current?.requestFullscreen?.()}
          >
            <ExpandIcon />
          </Button>
        </div>
      </div>
      <div className="sc-topology-graph__viewport" ref={wrapRef}>
        <svg
          width={graph.width * zoom}
          height={graph.height * zoom}
          viewBox={`0 0 ${graph.width} ${graph.height}`}
          className="sc-topology-svg"
        >
          <defs>
            <marker
              id="sc-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#6a6e73" />
            </marker>
            <marker
              id="sc-arrow-failed"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#c9190b" />
            </marker>
          </defs>
          {/* Alternating bands: give each layer a readable horizontal lane. */}
          {graph.rows.map((r, i) => (
            <rect
              key={`band-${r.title}`}
              x={0}
              y={r.bandY}
              width={graph.width}
              height={r.bandH}
              className={i % 2 === 0 ? 'sc-topology-band' : 'sc-topology-band sc-topology-band--alt'}
            />
          ))}
          {/* Layer captions, in their own gutter so they never sit over a node. */}
          {graph.rows.map((r) => (
            <text
              key={r.title}
              x={PAD_X}
              y={r.bandY + r.bandH / 2}
              dominantBaseline="middle"
              className="sc-topology-layer__title"
            >
              {r.title}
            </text>
          ))}
          {graph.edges.map((e) => {
            const from = nodeById.get(e.from);
            const to = nodeById.get(e.to);
            if (!from || !to) return null;
            const x1 = graph.ports.out.get(e.id) ?? (from.x ?? 0) + NODE_W / 2;
            const x2 = graph.ports.in.get(e.id) ?? (to.x ?? 0) + NODE_W / 2;
            const related = !focusId || e.from === focusId || e.to === focusId;
            return (
              <path
                key={e.id}
                d={edgePath(from, to, x1, x2, graph.waypoints.get(e.id) ?? [])}
                className={[
                  'sc-topology-edge',
                  e.failed ? 'sc-topology-edge--failed' : '',
                  focusId && related ? 'is-focused' : '',
                  focusId && !related ? 'is-muted' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                markerEnd={e.failed ? 'url(#sc-arrow-failed)' : 'url(#sc-arrow)'}
              />
            );
          })}
          {graph.nodes.map((n) => {
            const related =
              !focusId || n.id === focusId || !!graph.neighbours.get(focusId)?.has(n.id);
            return (
              <g
                key={n.id}
                transform={`translate(${n.x}, ${n.y})`}
                className={[
                  'sc-topology-node',
                  `sc-topology-node--${n.status}`,
                  focusId === n.id ? 'is-focused' : '',
                  focusId && !related ? 'is-muted' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                tabIndex={0}
                role="button"
                aria-label={`${n.kind} ${n.label}${n.namespace ? ` in ${n.namespace}` : ''}, ${n.status}`}
                onMouseEnter={() => setFocusId(n.id)}
                onMouseLeave={() => setFocusId(null)}
                onFocus={() => setFocusId(n.id)}
                onBlur={() => setFocusId(null)}
              >
                <title>{`${n.kind} ${n.label}${n.namespace ? ` (${n.namespace})` : ''} — ${n.status}`}</title>
                <rect width={NODE_W} height={NODE_H} rx={3} ry={3} />
                <StatusGlyph status={n.status} x={14} y={NODE_H / 2} />
                <text x={26} y={19} className="sc-topology-node__kind">
                  {n.kind}
                </text>
                <text x={26} y={35} className="sc-topology-node__name">
                  {n.label.length > 16 ? `${n.label.slice(0, 15)}…` : n.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
