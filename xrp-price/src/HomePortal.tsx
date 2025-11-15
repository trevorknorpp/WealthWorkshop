import { Html } from "@react-three/drei";
import { useState } from "react";
import XrpPrice from "./XrpPrice";
import WallpaperPicker from "./WallpaperPicker";
import VideoPlayer from "./VideoPlayer";
import PhotoEditor from "./PhotoEditor";

type PageKey = "home" | "xrp" | "chao" | "paint" | "settings" | "video";

const WALLPAPERS: string[] = [
  "/src/assets/wallpapers/wp1.jpg",
  "/src/assets/wallpapers/wp2.jpg",
  "/src/assets/wallpapers/wp3.jpg"
];

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

export default function HomePortal({
  position = [0, 1.5, -2] as [number, number, number],
  onClose
}: {
  position?: [number, number, number];
  onClose: () => void;
}) {
  const [page, setPage] = useState<PageKey>("home");
  const [wallpaper, setWallpaper] = useState<string | null>(null);

  const wallpaperBg = wallpaper
    ? {
        backgroundImage: `linear-gradient(0deg, rgba(0,0,0,.55), rgba(0,0,0,.55)), url(${wallpaper})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      }
    : {
        background: "radial-gradient(1200px 600px at 50% 10%, #1a1a1a 0%, #0b0b0b 70%)",
      };

  return (
    <Html
      transform
      distanceFactor={2}
      position={position}
      occlude={false}
      pointerEvents="auto"
      zIndexRange={[100, 0]}
    >
      <div
        style={{
          width: "800px",
          height: "600px",
          borderRadius: "12px",
          overflow: "hidden",
          background: "rgba(0,0,0,0.9)",
          border: "2px solid rgba(255,255,255,0.2)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          ...wallpaperBg,
          color: ui.button,
          fontFamily: "system-ui, Arial",
          lineHeight: 1.5,
        }}
      >
        {/* Header with close button */}
        <div style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          padding: "8px 12px",
          background: "rgba(0,0,0,0.7)",
          borderBottom: "1px solid rgba(255,255,255,0.1)"
        }}>
          <button
            onClick={onClose}
            style={{
              padding: "4px 8px",
              borderRadius: "4px",
              border: "1px solid rgba(255,255,255,0.3)",
              background: "rgba(255,255,255,0.1)",
              color: "white",
              cursor: "pointer",
              fontSize: "10px"
            }}
          >
            ✕
          </button>
        </div>

        {/* Main content */}
        <div style={{
          padding: "16px",
          height: "calc(100% - 60px)",
          overflow: "auto"
        }}>
          {page === "home" ? (
            <HomeGrid onOpen={setPage} />
          ) : (
            <DetailPage
              page={page}
              onBack={() => setPage("home")}
              wallpaper={wallpaper}
              setWallpaper={setWallpaper}
            />
          )}
        </div>
      </div>
    </Html>
  );
}

type Tile = { key: Exclude<PageKey, "home" | "video">; title: string; image?: string };

const TILES: Tile[] = [
  { key: "xrp", title: "", image: "/src/assets/xrp.png" },
  { key: "chao", title: "", image: "/src/assets/sa2.png" },
  { key: "paint", title: "", image: "/src/assets/paint.png" },
  { key: "settings", title: "", image: "/src/assets/wallpaperImage.png" },
];

function HomeGrid({ onOpen }: { onOpen: (p: PageKey) => void }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        alignItems: "center",
        justifyContent: "center",
        height: "100%"
      }}
    >
      {/* Paint button - BIG */}
      <button
        onClick={() => onOpen("paint")}
        style={{
          width: "120px",
          height: "120px",
          border: `2px solid ${ui.border}`,
          borderRadius: 15,
          overflow: "hidden",
          background: ui.surfaceLo,
          cursor: "pointer",
          transition: "transform 120ms ease, border 120ms ease, box-shadow 120ms ease",
          color: ui.button,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "48px"
        }}
        onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.95)")}
        onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        🎨
      </button>

      {/* YouTube button - BIG */}
      <button
        onClick={() => onOpen("video")}
        style={{
          width: "120px",
          height: "120px",
          borderRadius: 15,
          background: "rgba(255,0,0,0.8)",
          border: "2px solid rgba(255,255,255,0.3)",
          cursor: "pointer",
          transition: "transform 120ms ease",
          color: "white",
          fontSize: "48px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
        onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.95)")}
        onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        📺
      </button>
    </div>
  );
}

function DetailPage({
  page,
  onBack,
  wallpaper,
  setWallpaper,
}: {
  page: PageKey;
  onBack: () => void;
  wallpaper: string | null;
  setWallpaper: (src: string | null) => void;
}) {
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={onBack}
          style={{
            padding: "6px 12px",
            borderRadius: "6px",
            border: "1px solid rgba(255,255,255,0.3)",
            background: "rgba(255,255,255,0.1)",
            color: "white",
            cursor: "pointer",
            fontSize: "12px"
          }}
        >
          ← Back to Home
        </button>
      </div>

      {page === "video" && (
        <div style={{ padding: 8 }}>
          <VideoPlayer onBack={onBack} />
        </div>
      )}

      {page === "xrp" && <XrpPrice onBack={onBack} />}
      {page === "chao" && (
        <div style={{ margin: "-16px 0px 0px 0px", transform: "scale(0.7)", transformOrigin: "top center" }}>
          <div style={{ pointerEvents: "none", opacity: 0.8 }}>
            <h4 style={{ color: "white", textAlign: "center", marginBottom: 8 }}>Nested Chao Garden disabled in portals</h4>
            <div style={{ width: "100%", height: "300px", background: "rgba(0,0,0,0.5)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
              🌸 3D Garden Preview
            </div>
          </div>
        </div>
      )}
      {page === "paint" && (
        <div style={{ padding: 16 }}>
          <PhotoEditor imageSrc="/some/photo.jpg" onBack={onBack}/>
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