// PhotoEditor.tsx
import React, { useEffect, useRef, useState } from "react";
import BackButton from "./Backbutton";

const ui = {
  text: "#e6e6e6",
  sub: "#a8a8a8",
  border: "rgba(255,255,255,0.10)",
  chipBg: "rgba(255,255,255,0.03)",
  panel: "rgba(0,0,0,0.35)",
};

const styles = {
  toolbar: {
    display: "flex",
    flexWrap: "wrap" as const,
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    borderRadius: 12,
    background: ui.panel,
    border: `1px solid ${ui.border}`,
    backdropFilter: "blur(6px)",
    color: ui.text,
  },
  group: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 8px",
    borderRadius: 10,
    background: ui.chipBg,
    border: `1px solid ${ui.border}`,
  },
  label: { margin: 0, fontSize: 12, color: ui.sub },
  btn: {
    height: 28,
    padding: "0 10px",
    borderRadius: 8,
    background: "#191919",
    border: `1px solid ${ui.border}`,
    color: ui.text,
    cursor: "pointer",
  },
  btnActive: {
    background: "#242424",
    boxShadow: "0 0 0 2px rgba(255,255,255,0.06) inset",
  },
  color: {
    width: 36,
    height: 24,
    padding: 0,
    border: `1px solid ${ui.border}`,
    borderRadius: 6,
    background: "#111",
  },
  range: {
    width: 160,
    height: 24,
    accentColor: "#ff2f6d",
  },
  num: { width: 28, textAlign: "right" as const, color: ui.sub, fontSize: 12 },
};

type Tool = "brush" | "eraser" | "pan";

export default function PhotoEditor({
  imageSrc,
  width = 900,
  height = 600,
  onBack,
}: {
  imageSrc?: string;   // optional initial image
  width?: number;
  height?: number;
  onBack?:() => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null); // holds the base photo
  const dpr = Math.max(1, typeof window !== "undefined" ? window.devicePixelRatio : 1);

  // viewport (for pan/zoom)
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // drawing state
  const [tool, setTool] = useState<Tool>("brush");
  const [color, setColor] = useState("#ff0066");
  const [size, setSize] = useState(12);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const panStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // history (lightweight: snapshots of canvas)
  const historyRef = useRef<ImageData[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  // load base image (if provided)
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      redraw(); // draw base on load
      pushHistory(); // snapshot
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // init/resize backing store @ DPR
  useEffect(() => {
    const canvas = canvasRef.current!;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    redraw();
  }, [width, height, dpr, scale, offset]);

  function getCtx() {
    const c = canvasRef.current;
    return c ? c.getContext("2d")! : null;
  }

  function clearCanvas() {
    const ctx = getCtx();
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  }

  function withViewport(ctx: CanvasRenderingContext2D, fn: () => void) {
    ctx.save();
    // canvas units are in device pixels; apply DPR first
    ctx.scale(dpr, dpr);
    // then our pan/zoom
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);
    fn();
    ctx.restore();
  }

  function redraw() {
    const ctx = getCtx();
    if (!ctx) return;
    clearCanvas();

    withViewport(ctx, () => {
      // draw base image (if any)
      const img = imgRef.current;
      if (img) {
        ctx.drawImage(img, 0, 0);
      }
      // NOTE: strokes are already on the canvas (we draw directly).
      // When we “redraw”, we’re clearing and re-compositing the current bitmap.
      // If you prefer layers, you can keep a separate offscreen canvas for strokes.
    });
  }

  function canvasToWorld(clientX: number, clientY: number) {
    // Convert pointer coordinates → canvas CSS pixels
    const rect = canvasRef.current!.getBoundingClientRect();
    const xCss = clientX - rect.left;
    const yCss = clientY - rect.top;
    // Undo pan/zoom (remember drawing happens inside withViewport transform)
    const x = (xCss - offset.x) / scale;
    const y = (yCss - offset.y) / scale;
    return { x, y };
  }

  function pushHistory() {
    const ctx = getCtx();
    if (!ctx) return;
    const snap = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    historyRef.current.push(snap);
    setCanUndo(historyRef.current.length > 1);
  }

  function undo() {
    const ctx = getCtx();
    const h = historyRef.current;
    if (!ctx || h.length < 2) return;
    h.pop(); // discard current
    const prev = h[h.length - 1];
    ctx.putImageData(prev, 0, 0);
    setCanUndo(h.length > 1);
  }

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);

    if (tool === "pan") {
      panStartRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
      return;
    }

    drawingRef.current = true;
    lastRef.current = canvasToWorld(e.clientX, e.clientY);

    // prepare brush
    const ctx = getCtx();
    if (!ctx) return;
    withViewport(ctx, () => {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = size;
      ctx.strokeStyle = color;
      ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
      ctx.beginPath();
      const { x, y } = lastRef.current!;
      ctx.moveTo(x, y);
      ctx.lineTo(x + 0.01, y + 0.01); // tiny dot to start
      ctx.stroke();
    });
    pushHistory();
  }

  function moveDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (tool === "pan" && panStartRef.current) {
      const { x, y, ox, oy } = panStartRef.current;
      setOffset({ x: ox + (e.clientX - x), y: oy + (e.clientY - y) });
      return;
    }

    if (!drawingRef.current) return;
    const ctx = getCtx();
    if (!ctx) return;

    const pt = canvasToWorld(e.clientX, e.clientY);
    withViewport(ctx, () => {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = size;
      ctx.strokeStyle = color;
      ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
      ctx.beginPath();
      const last = lastRef.current!;
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
    });
    lastRef.current = pt;
  }

  function endDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    (e.currentTarget as HTMLCanvasElement).releasePointerCapture(e.pointerId);
    drawingRef.current = false;
    lastRef.current = null;
    panStartRef.current = null;
  }

  function wheelZoom(e: React.WheelEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const zoomIntensity = 0.0015;
    const newScale = Math.min(8, Math.max(0.2, scale * (1 - e.deltaY * zoomIntensity)));

    // zoom around mouse position (nice UX)
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const dx = mx - offset.x;
    const dy = my - offset.y;

    const ratio = newScale / scale;
    setOffset({ x: mx - dx * ratio, y: my - dy * ratio });
    setScale(newScale);
  }

  function loadFromFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        imgRef.current = img;
        setScale(1);
        setOffset({ x: 0, y: 0 });
        redraw();
        pushHistory();
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function exportPNG() {
    const c = canvasRef.current!;
    const url = c.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "edited.png";
    a.click();
  }

  return (
  <div style={{ display: "grid"}}>

    <div style={{ marginTop: - 20 }}>
        {onBack && <BackButton onClick={onBack} />}   {/* 🔥 call the prop */}
    </div>
    
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.group}>
          <span style={styles.label}>Tool</span>
          <button
            onClick={() => setTool("brush")}
            aria-pressed={tool === "brush"}
            style={{ ...styles.btn, ...(tool === "brush" ? styles.btnActive : {}) }}
          >
            🖌️ Brush
          </button>
          <button
            onClick={() => setTool("eraser")}
            aria-pressed={tool === "eraser"}
            style={{ ...styles.btn, ...(tool === "eraser" ? styles.btnActive : {}) }}
          >
            🧽 Eraser
          </button>
          <button
            onClick={() => setTool("pan")}
            aria-pressed={tool === "pan"}
            style={{ ...styles.btn, ...(tool === "pan" ? styles.btnActive : {}) }}
          >
            ✋ Pan
          </button>
        </div>

        <div style={styles.group}>
          <span style={styles.label}>Color</span>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            style={styles.color}
          />
        </div>

        <div style={styles.group}>
          <span style={styles.label}>Size</span>
          <input
            type="range"
            min={1}
            max={64}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            style={styles.range}
          />
          <span style={styles.num}>{size}</span>
        </div>

        <div style={styles.group}>
          <button onClick={undo} disabled={!canUndo} style={styles.btn}>Undo</button>
          <button
            onClick={() => {
              imgRef.current = null;
              clearCanvas();
              pushHistory();
            }}
            style={styles.btn}
          >
            Clear
          </button>
        </div>

        {/* spacer pushes file/export to the right */}
        <div style={{ flex: 1 }} />

        <div style={styles.group}>
          <label style={{ ...styles.btn, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            Load
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) loadFromFile(f);
              }}
            />
          </label>
          <button onClick={exportPNG} style={styles.btn}>Export PNG</button>
        </div>
      </div>


      {/* Canvas */}
      <div
        style={{
          width,
          height,
          background: "#111",
          border: "1px solid #333",
          borderRadius: 12,
          overflow: "hidden",
          touchAction: tool === "pan" ? "none" : "pinch-zoom", // better pointer behavior on touch
        }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={startDraw}
          onPointerMove={moveDraw}
          onPointerUp={endDraw}
          onPointerCancel={endDraw}
          onWheel={wheelZoom}
        />
      </div>
    </div>
  );
}
