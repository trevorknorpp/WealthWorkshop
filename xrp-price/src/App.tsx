// App.tsx
import { useEffect, useState } from "react";
import XrpPrice from "./XrpPrice";
import ChaoGarden3D from "./ChaoGarden3D";
import xrpImg from "./assets/xrp.png";
import sa2Img from "./assets/sa2.png";
import paintImg from "./assets/paint.png";
import wallpaperImage from "./assets/wallpaperImage.png";

import type { CSSProperties } from "react";

import WallpaperPicker from "./WallpaperPicker";
import wp1 from "./assets/wallpapers/wp1.jpg";
import wp2 from "./assets/wallpapers/wp2.jpg";
import wp3 from "./assets/wallpapers/wp3.jpg";
import PhotoEditor from "./assets/PhotoEditor";

const WALLPAPERS: string[] = [wp1, wp2, wp3];
const WALLPAPER_KEY = "wallpaper_v1";

//general ui styled
const ui = {
  brand: "#000000ff",
  surface: "#000000ff",
  surfaceHi: "#000000ff",
  surfaceLo: "#000000ff",
  text: "#000000ff",
  faint: "rgba(0, 0, 0, 1)",
  border: "rgba(0, 0, 0, 1)",
  radius: 16,
  button: "rgba(82, 69, 69, 1)",
};

type PageKey = "home" | "xrp" | "chao" | "paint" | "settings";
const LAST_PAGE_KEY = "last_page_v1";

type Tile = { key: PageKey; title: string; image?: string };

const TILES: Tile[] = [
  { key: "xrp", title: "", image: xrpImg },
  { key: "chao", title: "", image: sa2Img },
  { key: "paint", title: "", image: paintImg },
  { key: "settings", title: "", image: wallpaperImage },
];

//home screen
export default function App() {
  const [page, setPage] = useState<PageKey>("home");

  // persisted wallpaper (string | null) – can be URL, data: URI, or import
  const [wallpaper, setWallpaper] = useState<string | null>(
    () => localStorage.getItem(WALLPAPER_KEY)
  );

  //when wallpaper is updated, store update in local
  useEffect(() => {
    if (wallpaper) localStorage.setItem(WALLPAPER_KEY, wallpaper);
    else localStorage.removeItem(WALLPAPER_KEY);
  }, [wallpaper]);


  const wallpaperBg: CSSProperties = wallpaper
    ? {
      backgroundImage: `linear-gradient(0deg, rgba(0,0,0,.55), rgba(0,0,0,.55)), url(${wallpaper})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      backgroundAttachment: "fixed",
    }
    : {
      background:
        "radial-gradient(1200px 600px at 50% 10%, #1a1a1a 0%, #0b0b0b 70%)",
    };

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
    else localStorage.removeItem(LAST_PAGE_KEY);
    //else localStorage.setItem(LAST_PAGE_KEY, page);
  }, [page]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        ...wallpaperBg,
        //background: "radial-gradient(1200px 600px at 50% 10%, #1a1a1a 0%, #0b0b0b 70%)",
        color: ui.button,
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
          <DetailPage page={page} onBack={() => setPage("home")} wallpaper={wallpaper} setWallpaper={setWallpaper}/>
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
            color: ui.button,
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

function DetailPage({
  page,
  onBack,
  wallpaper,                   // <-- add
  setWallpaper,                // <-- add
}: {
  page: PageKey;
  onBack: () => void;
  wallpaper: string | null;
  setWallpaper: (src: string | null) => void;
}) {
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
        <h2 style={{ margin: 0, fontSize: "clamp(18px, 3.2vw, 28px)" }}>{title}</h2>
      </div>

      {page === "xrp" && (
        <XrpPrice onBack={onBack} />
      )}
      {page === "chao" && (
        <div style={{ margin: "-28px 0px 0px 0px" }}>
          <ChaoGarden3D onBack={onBack} />
        </div>
      )}
      {page === "paint" && (
        <div style={{ padding: 16 }}>
          <PhotoEditor imageSrc="/some/photo.jpg" />
        </div>
      )}
      {page === "settings" && (
        <WallpaperPicker
          current={wallpaper}
          onChange={setWallpaper}
          presets={WALLPAPERS}
          onBack={onBack}
        />
      )}
    </div>
  );
}
