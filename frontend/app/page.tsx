"use client";
import { useMemo, useState } from "react";
import { GlassBar } from "./components/GlassBar";
import { MainLiveTracking } from "./components/MainLiveTracking";
import { Animals } from "./components/Animals";
import { GrazingZones } from "./components/GrazingZones";
import { Analytics } from "./components/Analytics";

type TabKey = "main" | "animals" | "zones" | "analytics";

export default function Home() {
  const [tab, setTab] = useState<TabKey>("main");

  const view = useMemo(() => {
    switch (tab) {
      case "main":
        return <MainLiveTracking />;
      case "animals":
        return <Animals />;
      case "zones":
        return <GrazingZones />;
      case "analytics":
        return <Analytics />;
      default:
        return null;
    }
  }, [tab]);

  return (
    <div className="min-h-dvh pb-4">
      {view}
      <GlassBar active={tab} onChange={setTab} />
    </div>
  );
}
