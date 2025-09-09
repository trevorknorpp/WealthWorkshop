 // App.tsx
import { useEffect, useState } from "react";
import XrpPrice from "./XrpPrice";
// If you already built XrpPrice, import it. Otherwise keep the stub below.
// import XrpPrice from "./XrpPrice";

type PageKey = "home" | "xrp" | "news" | "watchlist" | "settings";
const LAST_PAGE_KEY = "last_page_v1";

const ui = {
  brand: "#000000ff",
  surface: "#000000ff",
  surfaceHi: "#000000ff",
  surfaceLo: "#000000ff",
  text: "#000000ff",
  faint: "rgba(0, 0, 0, 1)",
border: "rgba(0, 0, 0, 1)",
  radius: 16,
};

import xrpImg from "./assets/xrp.png";

type Tile = { key: PageKey; title: string; image?: string };

const TILES: Tile[] = [
  { key: "xrp", title: "XRP", image: xrpImg }, 
  { key: "news", title: "2", image: "📰" },
  { key: "watchlist", title: "3", image: "📌" },
  { key: "settings", title: "4", image: "⚙️" },
];

export default function App() {
  const [page, setPage] = useState<PageKey>("home");

  // Load last page on first mount
  useEffect(() => {
    const last = localStorage.getItem(LAST_PAGE_KEY) as PageKey | null;
    if (last && last !== "home" && TILES.some(t => t.key === last)) {
      setPage(last);
    }
  }, []);

  // Persist page (don’t persist home)
  useEffect(() => {
    if (page === "home") localStorage.removeItem(LAST_PAGE_KEY);
    //else localStorage.removeItem(LAST_PAGE_KEY);
    else localStorage.setItem(LAST_PAGE_KEY, page);
  }, [page]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        background: "radial-gradient(1200px 600px at 50% 10%, #1a1a1a 0%, #0b0b0b 70%)",
        color: ui.text,
        fontFamily: "system-ui, Arial",
        lineHeight: 1.5,
      }}
    >
      <div
        style={{
          width: "min(1000px, 96vw)",
          padding: "clamp(16px, 3vw, 32px)",
          borderRadius: ui.radius,
          background: ui.surface,
          border: `1px solid ${ui.border}`,
          boxShadow: "0 8px 40px rgba(0,0,0,.45)",
          boxSizing: "border-box",
        }}
      >
        {page === "home" ? (
          <HomeGrid onOpen={setPage} />
        ) : (
          <DetailPage page={page} onBack={() => setPage("home")} />
        )}
      </div>
    </div>
  );
}

function HomeGrid({ onOpen }: { onOpen: (p: PageKey) => void }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: 16,
      }}
    >
      {TILES.map((t) => (
        <button
          key={t.key}
          onClick={() => onOpen(t.key)}
          aria-label={t.title}
          style={{
            position: "relative",
            padding: 0,
            border: `1px solid ${ui.border}`,
            borderRadius: 14,
            overflow: "hidden",
            background: ui.surfaceLo,
            aspectRatio: "1 / 1",              // perfect square
            cursor: "pointer",
            transition: "transform 120ms ease, border 120ms ease, box-shadow 120ms ease",
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          {/* image */}
          <img
            src={t.image}
            alt={t.title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              filter: t.key === "xrp" ? "none" : "saturate(0.9)",
              background: "white",
            }}
          />

          {/* optional subtle gradient + focus ring */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.0) 50%, rgba(0,0,0,0.18) 100%)",
            }}
          />
        </button>
      ))}
    </div>
  );
}

function DetailPage({ page, onBack }: { page: PageKey; onBack: () => void }) {
  const title =
    TILES.find((t) => t.key === page)?.title ??
    (page.charAt(0).toUpperCase() + page.slice(1));

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <button
          onClick={onBack}
          style={{
            padding: "8px 12px",
            borderRadius: 999,
            border: `1px solid ${ui.border}`,
            background: ui.surfaceLo,
            color: ui.text,
            cursor: "pointer",
          }}
        >
          ← Back
        </button>
        <h2 style={{ margin: 0, fontSize: "clamp(18px, 3.2vw, 28px)" }}>{title}</h2>
      </div>

      {page === "xrp" && (
        <XrpPrice onBack={onBack}/>
      )}

      {page === "news" && (
        <Placeholder>News page content goes here.</Placeholder>
      )}
      {page === "watchlist" && (
        <Placeholder>Watchlist page content goes here.</Placeholder>
      )}
      {page === "settings" && (
        <Placeholder>Settings page content goes here.</Placeholder>
      )}
    </div>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 24,
        borderRadius: 12,
        border: `1px solid ${ui.border}`,
        background: ui.surfaceLo,
        color: ui.text,
      }}
    >
      {children}
    </div>
  );
}
