import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  initialUrl?: string; // optional starting video (mp4/webm or YouTube link)
  onBack?: () => void;
};

function isYouTube(url: string) {
  try {
    const u = new URL(url);
    return /(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(u.hostname);
  } catch {
    return false;
  }
}

function extractYouTubeId(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    if (u.searchParams.get("v")) return u.searchParams.get("v")!;
    // Support /embed/VIDEO_ID
    const parts = u.pathname.split("/");
    const i = parts.indexOf("embed");
    if (i >= 0 && parts[i + 1]) return parts[i + 1];
  } catch {}
  return null;
}

export default function VideoPlayer({ initialUrl = "", onBack }: Props) {
  const [url, setUrl] = useState<string>(initialUrl);
  const [objectUrl, setObjectUrl] = useState<string | null>(null); // for local files
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [progress, setProgress] = useState(0); // 0..1
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isYT = useMemo(() => url && isYouTube(url), [url]);
  const ytId = useMemo(() => (isYT ? extractYouTubeId(url) : null), [isYT, url]);

  // Cleanup any previous object URL
  useEffect(() => {
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [objectUrl]);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.volume = volume;
  }, [volume]);

  // Time/progress events
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onLoaded = () => setDuration(v.duration || 0);
    const onTime = () => {
      setTime(v.currentTime || 0);
      setProgress(v.duration ? v.currentTime / v.duration : 0);
    };
    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", () => setPlaying(false));
    return () => {
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("ended", () => setPlaying(false));
    };
  }, [url, objectUrl]);

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const blobUrl = URL.createObjectURL(f);
    setObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return blobUrl;
    });
    setUrl(""); // we’re using objectUrl instead
    setPlaying(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    const blobUrl = URL.createObjectURL(f);
    setObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return blobUrl;
    });
    setUrl("");
    setPlaying(false);
  };

  const currentSrc = objectUrl || (isYT ? "" : url);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) {
      v.pause();
      setPlaying(false);
    } else {
      v.play().then(() => setPlaying(true)).catch(() => {});
    }
  };

  const fmt = (s: number) => {
    if (!isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
    };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      style={{
        display: "grid",
        gap: 12,
        width: "100%",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(111, 91, 91, 0.4)",
              color: "#eee",
              cursor: "pointer",
            }}
          >
            ← Back
          </button>
        )}

        <input
          type="text"
          placeholder="Paste a video URL (mp4/webm) or YouTube link…"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setObjectUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return null;
            });
            setPlaying(false);
          }}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(0,0,0,0.2)",
            color: "#eee",
          }}
        />

        <label
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(0,0,0,0.2)",
            color: "#eee",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Pick file
          <input
            type="file"
            accept="video/mp4,video/webm"
            onChange={handlePick}
            style={{ display: "none" }}
          />
        </label>
      </div>

      {/* Player surface */}
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "16 / 9",
          borderRadius: 12,
          overflow: "hidden",
          background: "rgba(0,0,0,0.7)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 16px 50px rgba(0,0,0,0.4)",
        }}
      >
        {isYT && ytId ? (
          <iframe
            key={ytId}
            src={`https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`}
            title="YouTube"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            style={{ width: "100%", height: "100%", border: "0" }}
          />
        ) : currentSrc ? (
          <video
            ref={videoRef}
            src={currentSrc}
            controls={false}
            playsInline
            style={{ width: "100%", height: "100%", display: "block" }}
            onClick={togglePlay}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              color: "#bbb",
              fontSize: 14,
              textAlign: "center",
              padding: 12,
            }}
          >
            Drop a video file here, or paste a URL / YouTube link above.
          </div>
        )}

        {/* Controls (only for file/direct URL videos) */}
        {!isYT && currentSrc && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              display: "grid",
              gap: 8,
              padding: 10,
              background:
                "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.65) 60%, rgba(0,0,0,0.85) 100%)",
            }}
          >
            {/* Seek bar */}
            <input
              type="range"
              min={0}
              max={1}
              step={0.001}
              value={progress}
              onChange={(e) => {
                const v = videoRef.current;
                if (!v) return;
                const p = Number(e.target.value);
                v.currentTime = p * (v.duration || 0);
              }}
              style={{ width: "100%" }}
            />

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={togglePlay}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "rgba(0,0,0,0.2)",
                  color: "#eee",
                  cursor: "pointer",
                }}
              >
                {playing ? "Pause" : "Play"}
              </button>

              <span style={{ color: "#ddd", fontVariantNumeric: "tabular-nums" }}>
                {fmt(time)} / {fmt(duration)}
              </span>

              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#ccc", fontSize: 12 }}>Vol</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <small style={{ color: "#aaa" }}>
        Tips: Paste a YouTube link to embed, or drag an <code>.mp4/.webm</code> file here.
        Click the video to play/pause.
      </small>
    </div>
  );
}
