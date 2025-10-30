"use client";
import { PropsWithChildren, useEffect, useState } from "react";

export function ThemeRoot({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("theme") : null;
    const dark = saved === "dark";
    document.documentElement.classList.toggle("dark", dark);
    const root = document.documentElement;
    root.style.setProperty("--background", dark ? "#0a0a0a" : "#ffffff");
    root.style.setProperty("--foreground", dark ? "#ededed" : "#171717");
    setReady(true);
  }, []);
  return <>{children}</>;
}


