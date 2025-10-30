"use client";
import L from "leaflet";
import { useEffect, useRef, useState } from "react";

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
type Animal = { _id: string; name?: string; node_name?: string; photo_base64?: string };

function pinSvgDataUrl(color: string, size = 32): string {
  const inner = Math.floor(size * 0.22);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 11.5A4.5 4.5 0 1 1 12 4a4.5 4.5 0 0 1 0 9.5z" fill="${color}"/>
  <circle cx="12" cy="9.5" r="${inner}" fill="#ffffff"/>
  <ellipse cx="12" cy="22" rx="4" ry="1.3" fill="rgba(0,0,0,0.15)"/>
  <circle cx="12" cy="9.5" r="${Math.max(1, inner-3)}" fill="rgba(0,0,0,0.08)"/>
  <path d="M8 6c1.2-1.1 2.7-1.7 4-1.7" stroke="rgba(255,255,255,0.7)" stroke-width="0.8" fill="none" stroke-linecap="round"/>
 </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

function toPinIcon(color: string) {
  return L.icon({
    iconUrl: pinSvgDataUrl(color, 32),
    iconSize: [32, 32],
    iconAnchor: [16, 31],
    popupAnchor: [0, -28],
  });
}

function angleForKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return ((h % 360) * Math.PI) / 180;
}

function buildPopupHtml(title: string, log: Log, child?: string, minimal?: boolean) {
  if (minimal) {
    return `
    <div style="font-size:12px">
      <div>${new Date(log.time).toLocaleString()}</div>
    </div>`;
  }
  const statusBg = log.gps_connected ? "#dcfce7" : "#fef9c3";
  const statusText = log.gps_connected ? "#166534" : "#854d0e";
  const statusLabel = log.gps_connected ? "Connected" : "Disconnected";
  const nodesHtml = Array.isArray(log.nodes) && log.nodes.length
    ? `<div style="margin-top:6px"><div style="font-weight:600;font-size:12px">Distance Data:</div>${log.nodes
        .map((n) => {
          const name = n.name || "Unknown";
          const dist = typeof n.distance === "number" ? `${n.distance.toFixed(2)} m` : "";
          const rssi = typeof n.rssi === "number" ? `${n.rssi} dBm` : "";
          return `<div style=\"margin-top:4px;padding-left:6px;border-left:2px solid rgba(255,255,255,0.2);font-size:12px\"><div>Node: ${name}</div>${
            dist ? `<div>Distance: ${dist}</div>` : ""
          }${rssi ? `<div>RSSI: ${rssi}</div>` : ""}</div>`;
        })
        .join("")}</div>`
    : "";
  return `
    <div style="font-size:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div style="font-weight:600">${title}</div>
        <span style="display:inline-flex;align-items:center;padding:2px 6px;border-radius:8px;font-size:11px;font-weight:600;background:${statusBg};color:${statusText}">${statusLabel}</span>
      </div>
      <div>Lat: ${log.lat.toFixed(6)}, Lon: ${log.lon.toFixed(6)}</div>
      <div>Time: ${new Date(log.time).toLocaleString()}</div>
      ${child ? `<div>Node: ${child}</div>` : ""}
      ${nodesHtml}
    </div>
  `;
}

export default function MapInner({
  items,
  center,
  nodeToAnimal,
  focus,
  focusLog,
}: {
  items: Log[];
  center: [number, number] | number[];
  nodeToAnimal: Map<string, Animal>;
  focus?: [number, number];
  focusLog?: Log;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Defer map creation until after client mount to avoid double init during SSR/Strict
    const t = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Generate a stable per-mount key BEFORE any conditional returns to keep hook order stable
  const [mapKey] = useState(() => `map-${Date.now()}-${Math.random()}`);

  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Initialize map only once (declare hook before any conditional returns)
  useEffect(() => {
    if (!ready) return;
    if (!mapDivRef.current) return;
    if (mapRef.current) return;
    const [lat, lon] = center as any;
    const map = L.map(mapDivRef.current).setView([lat, lon], 14);
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);
  }, [ready, center]);

  // Update markers whenever items/focusLog change
  useEffect(() => {
    if (!ready) return;
    const layer = markersLayerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();
    if (focusLog) {
      // Draw the focused log marker (main device)
      const title = "Main";
      const centerLat = focusLog.lat;
      const centerLon = focusLog.lon;
      const main = L.marker([centerLat, centerLon], { icon: toPinIcon("#ef4444") });
      main.bindPopup(buildPopupHtml(title, focusLog, undefined, true));
      main.addTo(layer);

      // In scrub mode, keep minimal visuals (no decorative circle)

      // Plot surrounding nodes around the center using polar offsets based on distance
      const latRad = (centerLat * Math.PI) / 180;
      const metersPerDegLat = 111320;
      const metersPerDegLon = Math.cos(latRad) * 111320;
      const nodes = Array.isArray(focusLog.nodes) ? focusLog.nodes : [];
      nodes.forEach((n, i) => {
        const dist = typeof n.distance === "number" ? n.distance : undefined;
        if (!dist || dist <= 0) return;
        const angle = angleForKey(n.name || String(i));
        const dLat = (dist / metersPerDegLat) * Math.sin(angle);
        const dLon = (dist / metersPerDegLon) * Math.cos(angle);
        const nodeLat = centerLat + dLat;
        const nodeLon = centerLon + dLon;
        const mapped = n.name ? nodeToAnimal.get(n.name) : undefined;
        const label = mapped?.name || n.name || "Node";
        const color = mapped ? "#10b981" : "#6366f1"; // green if mapped to animal else purple
        const singleNodeMarker = L.marker([nodeLat, nodeLon], { icon: toPinIcon(color) });
        singleNodeMarker.addTo(layer);
      });
    } else {
      // Default: draw all items normally
      items.forEach((log, i) => {
        const title = "Main";
        const marker = L.marker([log.lat, log.lon], { icon: toPinIcon("#ef4444") });
        marker.bindPopup(buildPopupHtml(title, log, undefined));
        marker.addTo(layer);
        // For each detected node, add a node pin and a child pin (if mapped)
        const nodes = Array.isArray(log.nodes) ? log.nodes : [];
        if (nodes.length > 0) {
          const latRad = (log.lat * Math.PI) / 180;
          const metersPerDegLat = 111320;
          const metersPerDegLon = Math.cos(latRad) * 111320;
          nodes.forEach((n, ni) => {
            const dist = typeof n.distance === "number" ? n.distance : undefined;
            if (!dist || dist <= 0) return;
            const angle = angleForKey(n.name || String(ni));
            const dLat = (dist / metersPerDegLat) * Math.sin(angle);
            const dLon = (dist / metersPerDegLon) * Math.cos(angle);
            const mapped = n.name ? nodeToAnimal.get(n.name) : undefined;
            const label = mapped?.name || n.name || "Node";
            const color = mapped ? "#10b981" : "#6366f1"; // green if mapped to animal else purple
            const singleNodeMarker = L.marker([log.lat + dLat, log.lon + dLon], { icon: toPinIcon(color) });
            singleNodeMarker.bindPopup(`<div style=\"font-size:12px\"><div style=\"font-weight:600\">${label}</div><div>~${Math.round(dist)} m from main</div></div>`);
            singleNodeMarker.addTo(layer);
          });
        }
        if (i === 0) {
          const circle = L.circle([log.lat, log.lon], {
            radius: 100,
            color: "#2563eb",
            opacity: 0.5,
            weight: 1,
            fillColor: "#3b82f6",
            fillOpacity: 0.2,
          });
          circle.addTo(layer);
        }
      });
    }
  }, [ready, items, nodeToAnimal, focusLog]);

  // Fly to focused point
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !focus) return;
    map.flyTo(focus as any, 16, { duration: 0.6 });
  }, [ready, focus]);

  if (!ready) {
    return <div style={{ height: "100%", width: "100%" }} />;
  }

  return <div key={mapKey} ref={mapDivRef} style={{ height: "100%", width: "100%" }} />;
}

