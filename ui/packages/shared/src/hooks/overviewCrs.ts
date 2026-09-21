import { useCallback, useEffect, useState } from 'react';
import {
  API_VERSION_FULL,
  HybridSovereignKind,
  KIND_PLURALS,
  K8sResource,
} from '../types';
import { getK8sClientConfig } from './k8s';

export interface OverviewCRsResult {
  items: K8sResource[];
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

/** Kinds shown on the admin Overview (aggregated list). */
const OVERVIEW_KINDS: HybridSovereignKind[] = [
  'Entity',
  'Team',
  'Project',
  'Assignment',
  'Persona',
  'PlatformOpenshift',
  'CloudOSO',
  'CloudAWS',
  'CloudVirt',
  'HybridFabric',
  'CloudGateway',
  'TransportLink',
  'UIHealthChecker',
  'RbacConfig',
  'AAPConfig',
  'QuayConfig',
  'Vault',
];

async function listKind(
  kind: HybridSovereignKind,
  fetchFn: typeof fetch,
  baseUrl: string,
  headers: Record<string, string>,
): Promise<K8sResource[]> {
  const plural = KIND_PLURALS[kind];
  const url = `${baseUrl}/apis/${API_VERSION_FULL}/${plural}`;
  const r = await fetchFn(url, { headers });
  if (!r.ok) {
    // Missing CRD / no access — treat as empty, don't fail whole overview
    if (r.status === 404 || r.status === 403) return [];
    throw new Error(`K8s API error ${r.status}: ${r.statusText} (${kind})`);
  }
  const data = (await r.json()) as { items?: K8sResource[] };
  return (data.items ?? []).map((item) => ({ ...item, kind: item.kind || kind }));
}

/**
 * Aggregated CR fetch for admin Overview.
 * - dashboard style: Express `/api/overview/crs`
 * - raw / console style: list each kind via Kubernetes API proxy
 */
export function useOverviewCRs(pollIntervalMs = 0): OverviewCRsResult {
  const [items, setItems] = useState<K8sResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const cfg = getK8sClientConfig();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (cfg.token) headers.Authorization = `Bearer ${cfg.token}`;
    const fetchFn = cfg.fetchFn ?? fetch;

    const run = async () => {
      if (cfg.apiStyle === 'dashboard') {
        const r = await fetchFn('/api/overview/crs', { headers });
        if (!r.ok) throw new Error(`K8s API error ${r.status}: ${r.statusText}`);
        const data: unknown = await r.json();
        return Array.isArray(data) ? (data as K8sResource[]) : [];
      }

      const base = cfg.baseUrl ?? '/api/kubernetes';
      const lists = await Promise.all(
        OVERVIEW_KINDS.map((kind) =>
          listKind(kind, fetchFn, base, headers).catch(() => [] as K8sResource[]),
        ),
      );
      return lists.flat();
    };

    run()
      .then((data) => {
        if (cancelled) return;
        setItems(data);
        setError(null);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tick]);

  useEffect(() => {
    if (!pollIntervalMs) return;
    const id = setInterval(refresh, pollIntervalMs);
    return () => clearInterval(id);
  }, [pollIntervalMs, refresh]);

  return { items, loading, error, refresh };
}
