import { useEffect, useRef, useState } from "react";

export default function WallpaperPicker({
  current,
  onChange,
  presets = [],
  onBack, // <-- optional
}: {
  current: string | null;
  onChange: (src: string | null) => void;
  presets?: string[];
  onBack?: () => void;
}) {
  // If you ever switch to object URLs instead of data URLs, you'll use this.
  const lastObjectUrl = useRef<string | null>(null);

  // Local "preview" selection. Starts with the current wallpaper.
  const [preview, setPreview] = useState<string | null>(current);

  // keep preview in sync if parent changes `current`
  useEffect(() => {
    setPreview(current);
  }, [current]);

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
    const dataUrl = await fileToDataURL(file);
    setPreview(dataUrl); // preview only; apply happens when user clicks Apply
  }

  function handleApply() {
    // apply the previewed wallpaper to the app
    onChange(preview ?? null);
  }

  function handleUseDefault() {
    setPreview(null);      // preview shows default
    onChange(null);        // immediately apply default
  }

  function handleClearPreview() {
    setPreview(current ?? null); // revert preview back to current selection
  }

  const hasChanges = preview !== current;

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,.12)",
        borderRadius: 12,
        padding: 16,
        background: "rgba(0,0,0,.25)",
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && onBack) onBack();
      }}
    >
      {/* Header / Actions */}
      <div style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,.2)",
              background: "transparent",
              color: "#eee",
              cursor: "pointer",
            }}
            aria-label="Back"
          >
            ← Back
          </button>
        )}

        <div style={{ fontWeight: 600, color: "#eee" }}>Choose a wallpaper</div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <label
            style={{
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

          <button
            onClick={handleUseDefault}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,.2)",
              background: "rgba(255,255,255,.05)",
              color: "#eee",
              cursor: "pointer",
            }}
          >
            Use default
          </button>

          <button
            onClick={handleClearPreview}
            disabled={!hasChanges}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,.2)",
              background: hasChanges ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.03)",
              color: hasChanges ? "#eee" : "rgba(238,238,238,.5)",
              cursor: hasChanges ? "pointer" : "default",
              opacity: hasChanges ? 1 : 0.6,
            }}
            title="Revert preview to current selection"
          >
            Revert
          </button>

          <button
            onClick={handleApply}
            disabled={!hasChanges}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid rgba(125,180,255,.5)",
              background: hasChanges ? "rgba(125,180,255,.15)" : "rgba(125,180,255,.06)",
              color: hasChanges ? "#cfe1ff" : "rgba(207,225,255,.6)",
              cursor: hasChanges ? "pointer" : "default",
              fontWeight: 600,
            }}
          >
            Apply
          </button>
        </div>
      </div>

      {/* Presets grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: 12,
        }}
      >
        {presets.map((src, i) => {
          const isPreviewed = preview === src;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setPreview(src)}
              style={{
                position: "relative",
                aspectRatio: "16 / 9",
                borderRadius: 10,
                overflow: "hidden",
                padding: 0,
                border: isPreviewed
                  ? "2px solid #7db4ff"
                  : "1px solid rgba(255,255,255,.12)",
                boxShadow: isPreviewed ? "0 0 0 4px rgba(125,180,255,.2)" : "none",
                cursor: "pointer",
                background: "transparent",
                transition: "transform 120ms ease, box-shadow 120ms ease, border 120ms ease",
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
              onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
              aria-pressed={isPreviewed}
              aria-label={`Wallpaper ${i + 1}${isPreviewed ? " (previewed)" : ""}`}
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
              {isPreviewed && (
                <div
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    padding: "2px 6px",
                    borderRadius: 999,
                    border: "1px solid rgba(125,180,255,.5)",
                    background: "rgba(125,180,255,.15)",
                    fontSize: 12,
                    color: "#cfe1ff",
                    fontWeight: 600,
                  }}
                >
                  ✓ Selected
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Status line */}
      <div style={{ marginTop: 12, opacity: 0.85, fontSize: 12, color: "#ddd" }}>
        Previewing:{" "}
        <code style={{ opacity: 0.9 }}>
          {preview ? `${preview.slice(0, 64)}…` : "Default"}
        </code>
        {hasChanges && (
          <span style={{ marginLeft: 8 }}>(Apply to save)</span>
        )}
      </div>
    </div>
  );
}
