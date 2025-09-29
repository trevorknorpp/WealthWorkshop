// PhotoEditor.tsx
import React, { useEffect, useRef, useState } from "react";
import BackSection from "./BackSection"; // adjust path as needed

type Tool = "brush" | "eraser" | "pan";

export default function PhotoEditor({
  imageSrc,
  width = 900,
  height = 600,
}: {
  imageSrc?: string;   // optional initial image
  width?: number;
  height?: number;
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
    
    <div style={{ display: "grid", gap: 8 }}>

      <div>
        <BackSection /> 
      </div>

      <h1>Photo Editor</h1>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", color: "#eee" }}>
        <strong>Tool:</strong>
        <button onClick={() => setTool("brush")} aria-pressed={tool === "brush"}>
          🖌️ Brush
        </button>
        <button onClick={() => setTool("eraser")} aria-pressed={tool === "eraser"}>
          🧽 Eraser
        </button>
        <button onClick={() => setTool("pan")} aria-pressed={tool === "pan"}>
          ✋ Pan
        </button>

        <label style={{ marginLeft: 12 }}>
          Color <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          Size
          <input
            type="range"
            min={1}
            max={64}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
          />
          <span style={{ width: 28, textAlign: "right" }}>{size}</span>
        </label>

        <button onClick={() => undo()} disabled={!canUndo}>Undo</button>
        <button
          onClick={() => {
            imgRef.current = null;
            clearCanvas();
            pushHistory();
          }}
        >
          Clear
        </button>

        <label style={{ marginLeft: "auto" }}>
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
        <button onClick={exportPNG}>Export PNG</button>
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
