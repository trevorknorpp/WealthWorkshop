import { useRef } from "react";

export default function WallpaperPicker({
  current,
  onChange,
  presets = [],
}: {
  current: string | null;
  onChange: (src: string | null) => void;
  presets?: string[];
}) {
  // keep last object URL to revoke if user uploads
  const lastObjectUrl = useRef<string | null>(null);

  // convert uploaded file to data URL so it persists in localStorage
  function fileToDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // if you prefer not to store base64, you can use objectURL but it won't persist across reloads
    const dataUrl = await fileToDataURL(file);
    onChange(dataUrl);
  }

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,.12)",
        borderRadius: 12,
        padding: 16,
        background: "rgba(0,0,0,.25)",
      }}
    >
      <div style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={() => onChange(null)}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,.2)",
            background: "rgba(255,255,255,.05)",
            color: "#eee",
            cursor: "pointer",
          }}
        >
          No wallpaper (use default)
        </button>

        <label
          style={{
            marginLeft: "auto",
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,.2)",
            background: "rgba(255,255,255,.05)",
            color: "#eee",
            cursor: "pointer",
          }}
        >
          Upload…
          <input
            type="file"
            accept="image/*"
            onChange={handleUpload}
            style={{ display: "none" }}
          />
        </label>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: 12,
        }}
      >
        {presets.map((src, i) => {
          const selected = current === src;
          return (
            <button
              key={i}
              onClick={() => onChange(src)}
              style={{
                position: "relative",
                aspectRatio: "16 / 9",
                borderRadius: 10,
                overflow: "hidden",
                padding: 0,
                border: selected
                  ? "2px solid #7db4ff"
                  : "1px solid rgba(255,255,255,.12)",
                boxShadow: selected ? "0 0 0 4px rgba(125,180,255,.2)" : "none",
                cursor: "pointer",
                background: "transparent",
              }}
            >
              <img
                src={src}
                alt={`Wallpaper ${i + 1}`}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(180deg, rgba(0,0,0,0) 60%, rgba(0,0,0,.25) 100%)",
                }}
              />
            </button>
          );
        })}
      </div>

      {current && (
        <div style={{ marginTop: 12, opacity: 0.8, fontSize: 12 }}>
          Selected: <code style={{ opacity: 0.8 }}>{current.slice(0, 64)}…</code>
        </div>
      )}
    </div>
  );
}
