"use client";
import useSWR from "swr";
import dynamic from "next/dynamic";

async function fetchClusters(): Promise<{ clusters: Cluster[] }> {
  const envBase = process.env.NEXT_PUBLIC_API_BASE;
  const makeUrl = (base: string) => `${base}/clusters`;
  const tryFetch = async (base: string) => {
    const res = await fetch(makeUrl(base));
    if (!res.ok) throw new Error(`Failed ${res.status}`);
    return res.json();
  };
  if (envBase) {
    return tryFetch(envBase);
  }
  if (typeof window !== "undefined") {
    const proto = window.location.protocol;
    const host = window.location.hostname;
    const cands = [
      `${proto}//${host}:8000`,
      `${proto}//${host}:5000`,
    ];
    for (const b of cands) {
      try {
        return await tryFetch(b);
      } catch (_) {}
    }
  }
  throw new Error("No reachable API base");
}

type Corner = { lat: number; lon: number };
type Cluster = { cluster: number; corners: Corner[] };

const ZonesMap = dynamic(() => import("./MapZonesInner"), { ssr: false });

export function GrazingZones() {
  const { data, isLoading, error } = useSWR<{ clusters: Cluster[] }>("clusters", fetchClusters, { refreshInterval: 30000 });
  const hasClusters = (data?.clusters?.length || 0) > 0;
  const first = hasClusters ? data!.clusters[0].corners[0] : { lat: 19.076, lon: 72.8777 };
  return (
    <div className="mx-auto w-full max-w-6xl p-4">
      <div className="glass mb-4 rounded-2xl px-4 py-3">
        <h2 className="text-xl font-semibold">Grazing Zones</h2>
        <div className="mt-1 text-sm text-white/60">
          {error ? "Error loading" : isLoading ? "Loading..." : `Clusters: ${data?.clusters?.length ?? 0}`}
        </div>
      </div>
      {!hasClusters ? (
        <div className="glass flex h-[30dvh] items-center justify-center rounded-2xl border border-white/15 text-white/70">
          {error ? "Failed to load clusters" : isLoading ? "Loading clusters..." : "No clusters detected."}
        </div>
      ) : (
        <div className="relative h-[68dvh] overflow-hidden rounded-2xl">
          <div className="absolute inset-0 overflow-hidden rounded-2xl border border-white/15">
            <ZonesMap clusters={data!.clusters} center={[first.lat, first.lon]} />
          </div>
        </div>
      )}
    </div>
  );
}


