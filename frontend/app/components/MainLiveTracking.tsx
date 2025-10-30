"use client";
import "leaflet/dist/leaflet.css";
import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const API =
  process.env.NEXT_PUBLIC_API_BASE ||
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : "");

type NodeInfo = { name: string; rssi?: number; distance?: number };
type Log = {
  _id: string;
  time: string;
  time_parsed?: string;
  lat: number;
  lon: number;
  gps_connected: boolean;
  nodes: NodeInfo[];
};

type Animal = {
  _id: string;
  name?: string;
  node_name?: string;
  photo_base64?: string;
};

const DynamicMap = dynamic(() => import("./MapInner"), { ssr: false });

function getTimeAgo(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) {
    return `${seconds} seconds ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function MainLiveTracking() {
  const { data: logsData } = useSWR<{ items: Log[] }>(`${API}/logs?limit=500`, fetcher, { refreshInterval: 10000 });
  const { data: animalsData } = useSWR<Animal[]>(`${API}/animals`, fetcher, { refreshInterval: 60000 });
  const [scrubIndex, setScrubIndex] = useState<number>(0);
  const [, setTimeUpdate] = useState(0); // Force update for time display

  // Update time display every second
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeUpdate(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const nodeToAnimal = useMemo(() => {
    const map = new Map<string, Animal>();
    (animalsData || []).forEach((a) => {
      if (a.node_name) map.set(a.node_name, a);
    });
    return map;
  }, [animalsData]);

  const center = useMemo(() => {
    const first = logsData?.items?.[0];
    return first ? [first.lat, first.lon] : [19.076, 72.8777];
  }, [logsData]);

  const [focus, setFocus] = useState<[number, number] | null>(null);

  // Time-ordered timeline (oldest -> newest) for scrubbing
  const timeline = useMemo(() => {
    const allItems = logsData?.items || [];
    return [...allItems].sort((a, b) => {
      const dateA = new Date(a.time);
      const dateB = new Date(b.time);
      return dateA.getTime() - dateB.getTime(); // Oldest first
    });
  }, [logsData?.items]);

  // Default scrub position to the latest log when data loads/changes
  useEffect(() => {
    if (timeline.length > 0) {
      setScrubIndex(timeline.length - 1);
    }
  }, [timeline]);

  const selectedLog = timeline.length ? timeline[scrubIndex] : null;
  const effectiveItems = selectedLog ? [selectedLog] : [];
  const effectiveFocus = selectedLog ? ([selectedLog.lat, selectedLog.lon] as [number, number]) : focus || undefined;
  const effectiveCenter = selectedLog ? ([selectedLog.lat, selectedLog.lon] as [number, number]) : center;

  return (
    <div className="mx-auto w-full max-w-6xl p-4">
      <div className="glass mb-4 rounded-2xl px-4 py-3">
        <h2 className="text-xl font-semibold">Animal Monitoring</h2>
        <div className="mt-3">
          <input
            type="range"
            min={0}
            max={Math.max(0, timeline.length - 1)}
            value={Math.min(scrubIndex, Math.max(0, timeline.length - 1))}
            onChange={(e) => setScrubIndex(timeline.length - 1 - parseInt(e.target.value))}
            className="mt-1 w-full accent-emerald-500"
          />
          {selectedLog ? (
            <div className="mt-1 text-center space-y-1">
              <div className="text-sm text-white/80">
                {new Date(selectedLog.time).toLocaleString('en-US', {
                  timeZone: 'Asia/Kolkata',
                  year: 'numeric',
                  month: 'numeric',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: true
                })}
              </div>
              <div className="text-xs text-emerald-400">
                {getTimeAgo(selectedLog.time)}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <div className="relative h-[60dvh] overflow-hidden rounded-2xl">
        <div className="absolute inset-0 overflow-hidden rounded-2xl border border-white/15">
          <DynamicMap items={effectiveItems} center={effectiveCenter} nodeToAnimal={nodeToAnimal} focus={effectiveFocus} focusLog={selectedLog || undefined} />
        </div>
      </div>
    </div>
  );
}

