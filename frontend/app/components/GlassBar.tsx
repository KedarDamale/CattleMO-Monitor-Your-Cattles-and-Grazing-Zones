"use client";
import { memo, type ReactElement } from "react";
import clsx from "clsx";

type TabKey = "main" | "animals" | "zones" | "analytics";

export function GlassBar({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (t: TabKey) => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 pb-[env(safe-area-inset-bottom)]">
      <div
        className={clsx(
          "glass",
          "mx-3 mb-3 rounded-2xl shadow-lg",
          // set text color via CSS var so it flips with theme
          "text-[color:var(--foreground)]"
        )}
      >
        <div className="mx-auto grid max-w-[520px] grid-cols-5 items-center justify-items-center gap-1 px-2 py-2 sm:gap-2 sm:px-4">
          <Tab
            aria="Main"
            selected={active === "main"}
            onClick={() => onChange("main")}
            icon={(sel) => (
              <svg width="28" height="28" viewBox="0 0 24 24" className={iconCls(sel)}>
                <path d="M12 3 3 11h2v8h5v-5h4v5h5v-8h2z" />
              </svg>
            )}
          />
          <Tab
            aria="Animals"
            selected={active === "animals"}
            onClick={() => onChange("animals")}
            icon={(sel) => (
              <svg width="28" height="28" viewBox="0 0 24 24" className={iconCls(sel)}>
                <path d="M5 11c0-3.866 3.134-7 7-7 2.761 0 5.158 1.59 6.29 3.889L21 9l-1 1-1-1v2l-1 1-1-1v3c0 2.761-2.239 5-5 5H8a3 3 0 0 1-3-3v-3l-1 1-1-1 1.71-1.111A6.97 6.97 0 0 1 5 11z"/>
              </svg>
            )}
          />
          <Tab
            aria="Grazing Zones"
            selected={active === "zones"}
            onClick={() => onChange("zones")}
            icon={(sel) => (
              <svg width="28" height="28" viewBox="0 0 24 24" className={iconCls(sel)}>
                <path d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z"/>
              </svg>
            )}
          />
          <Tab
            aria="Analytics"
            selected={active === "analytics"}
            onClick={() => onChange("analytics")}
            icon={(sel) => (
              <svg width="28" height="28" viewBox="0 0 24 24" className={iconCls(sel)}>
                <path d="M5 9h3v10H5zM10.5 5h3v14h-3zM16 12h3v7h-3z"/>
              </svg>
            )}
          />
          <DarkToggle />
        </div>
      </div>
    </div>
  );
}

function iconCls(selected?: boolean) {
  return [
    "transition-all",
    selected ? "drop-shadow-[0_2px_8px_rgba(0,0,0,0.25)] scale-110" : "opacity-80 hover:opacity-100",
    "fill-[color:var(--foreground)]",
  ].join(" ");
}

function Tab({ aria, selected, onClick, icon }: { aria: string; selected?: boolean; onClick: () => void; icon: (selected?: boolean) => ReactElement }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex h-12 w-12 items-center justify-center rounded-2xl sm:h-12 sm:w-12",
        selected ? "bg-white/35 dark:bg-white/10" : "hover:bg-black/10 dark:hover:bg-white/10"
      )}
      aria-label={aria}
      title={aria}
    >
      {icon(selected)}
    </button>
  );
}

const DarkToggle = memo(function DarkToggle() {
  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  return (
    <button
      aria-label="Toggle dark mode"
      onClick={() => {
        const html = document.documentElement;
        const next = !html.classList.contains("dark");
        html.classList.toggle("dark", next);
        // Update CSS variables to force theme regardless of Tailwind variant strategy
        html.style.setProperty("--background", next ? "#0a0a0a" : "#ffffff");
        html.style.setProperty("--foreground", next ? "#ededed" : "#171717");
        localStorage.setItem("theme", next ? "dark" : "light");
      }}
      className="flex h-12 w-12 items-center justify-center rounded-2xl hover:bg-black/10 dark:hover:bg-white/10"
    >
      {/* Sun/Moon icon with a rotate/scale animation */}
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        className="fill-[color:var(--foreground)] transition-all duration-200 hover:rotate-6 hover:scale-110"
      >
        {isDark ? (
          // Sun
          <path d="M6.76 4.84l-1.8-1.79L3.17 4.84l1.79 1.79 1.8-1.79zM1 13h3v-2H1v2zm10 10h2v-3h-2v3zM4.84 19.16l1.79 1.8 1.79-1.8-1.79-1.79-1.79 1.79zM20 13h3v-2h-3v2zm-1.76-8.16l-1.8 1.79 1.8 1.79 1.79-1.79-1.79-1.79zM12 6a6 6 0 100 12 6 6 0 000-12zm7.16 13.16l-1.79-1.79-1.8 1.79 1.8 1.8 1.79-1.8z" />
        ) : (
          // Moon
          <path d="M12.74 2a8.94 8.94 0 00-1.74.17A9 9 0 1012.74 2z" />
        )}
      </svg>
    </button>
  );
});


