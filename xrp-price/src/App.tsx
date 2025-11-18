import { useEffect, useState, type CSSProperties } from "react";

//pull in views for buttons
import XrpPrice from "./XrpPrice";
import ChaoGarden3D from "./ChaoGarden3D";
import WallpaperPicker from "./WallpaperPicker";
import VideoPlayer from "./VideoPlayer";
import PhotoEditor from "./PhotoEditor";

// pull in assets
import xrpImg from "./assets/xrp.png";
import sa2Img from "./assets/sa2.png";
import paintImg from "./assets/paint.png";
import wallpaperImage from "./assets/wallpaperImage.png";
import ytImage from "./assets/yt.png";
import wp1 from "./assets/wallpapers/wp1.jpg";
import wp2 from "./assets/wallpapers/wp2.jpg";
import wp3 from "./assets/wallpapers/wp3.jpg";




const WALLPAPERS: string[] = [wp1, wp2, wp3];
const WALLPAPER_KEY = "wallpaper_v1";

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

//different pages to navigate to
type PageKey = "home" | "xrp" | "chao" | "paint" | "settings" | "video";
const LAST_PAGE_KEY = "last_page_v1";

type Tile = { key: Exclude<PageKey, "home" | "video">; title: string; image?: string };

//large image tiles
const TILES: Tile[] = [
  { key: "xrp", title: "", image: xrpImg },
  { key: "chao", title: "", image: sa2Img },
  { key: "paint", title: "", image: paintImg },
  { key: "settings", title: "", image: wallpaperImage },
];

//start here
export default function App() {

  //by default set page to home
  //changing page re-renders the UI to show selections
  const [page, setPage] = useState<PageKey>("home");

  //set wallpaper to stored setting or null (black background)
  const [wallpaper, setWallpaper] = useState<string | null>(() =>
    localStorage.getItem(WALLPAPER_KEY)
  );

  useEffect(() => {
    //when wallpaper changes, save it to local storage
    if (wallpaper) localStorage.setItem(WALLPAPER_KEY, wallpaper);
    //remove wallpaper when cleared
    else localStorage.removeItem(WALLPAPER_KEY);
  }, [wallpaper]);

  //set background CSS for the whole app
  const wallpaperBg: CSSProperties = wallpaper
    ? {
        backgroundImage: `linear-gradient(0deg, rgba(0,0,0,.55), rgba(0,0,0,.55)), url(${wallpaper})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      }
    : //no wallpaper, default black
      {
        background: "radial-gradient(1200px 600px at 50% 10%, #1a1a1a 0%, #0b0b0b 70%)",
      };

  
  //restore last page if valid, so we don't always go home
  useEffect(() => {
    const last = localStorage.getItem(LAST_PAGE_KEY) as PageKey | null;
    if (last && last !== "home" && (last === "video" || TILES.some(t => t.key === last))) {
      setPage(last);
    }
  }, []);

  //invalidate last page key if page is home
  useEffect(() => {
    if (page === "home") localStorage.removeItem(LAST_PAGE_KEY);
    else localStorage.removeItem(LAST_PAGE_KEY);
  }, [page]);


  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",   // stack YT button + main box vertically
        ...wallpaperBg,
        color: ui.button,
        fontFamily: "system-ui, Arial",
        lineHeight: 1.5,
      }}
    >

      {/* ,ain content box */}
      <div
        style={{
          marginTop: 16,
          width: page === "xrp" ? "min(720px, 96vw)" : "min(1000px, 96vw)",

          // tighter padding for xrp
          padding: page === "xrp" ? "16px 20px" : "clamp(16px, 3vw, 32px)",

          borderRadius: ui.radius,

          // xrp uses translucent + blur, others stay solid
          background: page === "xrp"
            ? "rgba(8,10,14,0.36)"   
            : ui.surface,

          border: page === "xrp" ? "none" : `1px solid ${ui.border}`,

          backdropFilter: page === "xrp" ? "saturate(120%) blur(8px)" : undefined,

          boxShadow: page === "xrp"
            ? "0 8px 28px rgba(255, 255, 255, 0)"
            : "0 8px 40px rgba(0,0,0,.45)",

          boxSizing: "border-box",
        }}
      >
        {page === "home" ? (
          <HomeGrid onOpen={setPage} />
        ) : (
          //switches windows based on page element
          <DetailPage
            page={page}
            onBack={() => setPage("home")}
            wallpaper={wallpaper}
            setWallpaper={setWallpaper}
          />
        )}
      </div>
      {page === "home" && (
        <div style={{ display: "flex", gap: 10, marginTop: 0 }}>
          <YouTubeQuickButton onClick={() => setPage("video")} />
        </div>
      )}
    </div>
    
  );
}

//small youtube button
function YouTubeQuickButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "8px 14px",
        borderRadius: 12,
        background: "transparent",              // solid black background
        border: "6px solid rgba(255, 255, 255, 0)",
        boxShadow: "0 6px 18px rgba(255, 255, 255, 0)",
        cursor: "pointer",
        transition: "transform 120ms ease",
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.96)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      <img src={ytImage} alt="YouTube" style={{ height: 38, width: 38, borderRadius: 6 }} />
    </button>
  );
}

//main 4 icons as grid of tiles that - scale when you hover on them with the mouse
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
          onClick={() => onOpen(t.key as PageKey)}
          aria-label={t.title}
          style={{
            position: "relative",
            padding: 0,
            border: `1px solid ${ui.border}`,
            borderRadius: t.key === "xrp" ? 0 : 14,   // 🔥 no rounding for XRP
            overflow: "hidden",
            background: t.key === "xrp" ? "black" : ui.surfaceLo,
            aspectRatio: "1 / 1",
            cursor: "pointer",
            transition: "transform 120ms ease, border 120ms ease, box-shadow 120ms ease",
            color: ui.button,
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
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
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, rgba(0,0,0,0.0) 50%, rgba(0,0,0,0.18) 100%)",
            }}
          />
        </button>
      ))}
    </div>
  );
}

//switches content view based on current page
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
      {page === "video" && (
        <div style={{ padding: 8 }}>
          <VideoPlayer onBack={onBack} />
        </div>
      )}

      {page === "xrp" && <XrpPrice onBack={onBack} />}
      {page === "chao" && (
        <div style={{ margin: "-28px 0px 0px 0px" }}>
          <ChaoGarden3D onBack={onBack} />
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
