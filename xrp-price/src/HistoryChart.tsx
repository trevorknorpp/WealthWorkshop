// ---- HistoryChart.tsx (or inline above your component) ----
import { useEffect, useMemo, useRef, useState } from "react";

type RangeKey = "1D" | "7D" | "30D" | "90D" | "1Y";
const RANGE_TO_DAYS: Record<RangeKey, number> = {
  "1D": 1,
  "7D": 7,
  "30D": 30,
  "90D": 90,
  "1Y": 365,
};

type Pt = { t: number; p: number };

export function HistoryChart({
  decimals = 4,
  settingsMode = false,
  height = 260,
  square = true,        // NEW: make the plot square by default
  minimal = true,       // NEW: minimalist styling
}: {
  decimals?: number;
  settingsMode?: boolean;
  height?: number;
  square?: boolean;
  minimal?: boolean;
}) {

  const [range, setRange] = useState<RangeKey>("7D");
  const [data, setData] = useState<Pt[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [err, setErr] = useState<string>("");

  // cache key so quick toggles don't refetch
  const cacheKey = `xrp_hist_${range}`;
  const abortRef = useRef<AbortController | null>(null);

  const fetchHist = async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      setStatus((s) => (s === "ok" ? "ok" : "loading"));

      // try cache first (valid for ~2 minutes)
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { ts, points } = JSON.parse(cached);
        if (Date.now() - ts < 2 * 60 * 1000) {
          setData(points);
          setStatus("ok");
          return;
        }
      }

      const days = RANGE_TO_DAYS[range];
      const url =
        `https://api.coingecko.com/api/v3/coins/ripple/market_chart` +
        `?vs_currency=usd&days=${days}&precision=${Math.min(6, Math.max(0, decimals))}`;

      const r = await fetch(url, { cache: "no-store", signal: ctrl.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();

      // CoinGecko returns { prices: [[ms, price], ...] }
      const points: Pt[] = Array.isArray(j?.prices)
        ? j.prices.map((row: [number, number]) => ({ t: row[0], p: row[1] }))
        : [];

      if (!points.length) throw new Error("Empty historical data");

      setData(points);
      setStatus("ok");
      localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), points }));
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setStatus("error");
      setErr(String(e?.message ?? e));
    }
  };

  useEffect(() => {
    fetchHist();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, decimals, settingsMode]);

  const padding = { top: 12, right: 12, bottom: 20, left: 36 };
  const W = 720;                         // logical width (viewBox units)
  const H = square ? W : height;         // square if wanted

  // scales
  const { pathD, minP, maxP, xAtIndex, yAtIndex } = useMemo(() => {
    if (!data.length) {
      return {
        pathD: "",
        minP: 0,
        maxP: 0,
        xAtIndex: (_i: number) => 0,
        yAtIndex: (_i: number) => 0,
      };
    }
    const xs = data.map((d) => d.t);
    const ys = data.map((d) => d.p);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const innerW = W - padding.left - padding.right;
    const innerH = H - padding.top - padding.bottom;

    const x = (t: number) =>
      padding.left + ((t - minX) / Math.max(1, maxX - minX)) * innerW;
    const y = (p: number) =>
      padding.top + (1 - (p - minY) / Math.max(1e-12, maxY - minY)) * innerH;

    let dstr = "";
    data.forEach((pt, i) => {
      const X = x(pt.t);
      const Y = y(pt.p);
      dstr += i === 0 ? `M ${X} ${Y}` : ` L ${X} ${Y}`;
    });

    return {
      pathD: dstr,
      minP: minY,
      maxP: maxY,
      xAtIndex: (i: number) => x(data[i].t),
      yAtIndex: (i: number) => y(data[i].p),
    };
  }, [data, height, square]);

  // hover/tooltip
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

function onMove(e: React.MouseEvent<SVGSVGElement>) {
  if (!svgRef.current || !data.length) return;
  const rect = svgRef.current.getBoundingClientRect();

  // mouse X in CSS px relative to the SVG
  const pxCss = e.clientX - rect.left;

  // ✅ convert to viewBox units (0..W) so it matches xAtIndex()
  const pxView = (pxCss / rect.width) * W;

  // find nearest point in the same coordinate space
  let nearest = 0;
  let best = Infinity;
  for (let i = 0; i < data.length; i++) {
    const dx = Math.abs(pxView - xAtIndex(i)); // both in viewBox units
    if (dx < best) {
      best = dx;
      nearest = i;
    }
  }
  setHoverIdx(nearest);
}
  
  function onLeave() {
    setHoverIdx(null);
  }

  const fmtPrice = (n: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n);

  const fmtDate = (ms: number) => {
    const d = new Date(ms);
    const opts: Intl.DateTimeFormatOptions =
      range === "1D"
        ? { hour: "numeric", minute: "2-digit" }
        : { month: "short", day: "numeric" };
    return d.toLocaleString(undefined, opts);
  };

  return (
    <div style={{ width: "100%", marginTop: 12 }}>
      {/* Chart */}
      <div style={{ width: "100%", marginTop: 6 }}>
        {status === "loading" && (
          <div style={{ textAlign: "center", opacity: 0.7 }}>Loading history…</div>
        )}
        {status === "error" && (
          <div style={{ color: "crimson", textAlign: "center" }}>
            Failed to load history: {err}
          </div>
        )}
        {status === "ok" && (
          // Outer box keeps a square aspect by default
          <div
            style={{
              width: "clamp(260px, 58vmin, 620px)",
              marginInline: "auto",
              position: "relative",
              ...(square ? { aspectRatio: "1 / 1" } : { height }), // responsive square
              borderRadius: 12,
              border: minimal ? "1px solid rgba(255,255,255,.08)" : "none",
              background: "transparent",
              boxShadow: minimal ? "none" : "inset 0 0 0 1px rgba(0,0,0,.2)",
            }}
          >
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                display: "block",
                borderRadius: 12,
              }}
              onMouseMove={settingsMode ? onMove : undefined}
              onMouseLeave={settingsMode ? onLeave : undefined}
            >
              {/* grid lines (minimal: 2 faint lines; classic: 4) */}
              <g opacity={minimal ? 0.12 : 0.15} stroke="#fff">
                {(minimal ? [1, 3] : [0, 1, 2, 3, 4]).map((i) => {
                  const y = padding.top + ((H - padding.top - padding.bottom) / 4) * i;
                  return (
                    <line
                      key={i}
                      x1={padding.left}
                      x2={W - padding.right}
                      y1={y}
                      y2={y}
                    />
                  );
                })}
              </g>

              {/* price path */}
              <path
                d={pathD}
                stroke="#88baff"
                strokeWidth={2.25}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* hover crosshair + dot + tooltip (only in settings) */}
              {settingsMode && hoverIdx !== null && (
                <>
                  <line
                    x1={xAtIndex(hoverIdx)}
                    x2={xAtIndex(hoverIdx)}
                    y1={padding.top}
                    y2={H - padding.bottom}
                    stroke="#aaa"
                    strokeDasharray="4 4"
                    opacity={0.6}
                    pointerEvents="none"
                  />
                  <circle
                    cx={xAtIndex(hoverIdx)}
                    cy={yAtIndex(hoverIdx)}
                    r={3.5}
                    fill="#fff"
                    stroke="#88baff"
                    strokeWidth={2}
                    pointerEvents="none"
                  />
                  {(() => {
                    const Wt = 160, Ht = 40;
                    const rawX = xAtIndex(hoverIdx) + 8;
                    const x = Math.min(Math.max(rawX, padding.left), W - padding.right - Wt);
                    const rawY = yAtIndex(hoverIdx) - Ht - 8;
                    const y = Math.min(Math.max(rawY, padding.top), H - padding.bottom - Ht);
                    return (
                      <g transform={`translate(${x}, ${y})`} pointerEvents="none">
                        <rect width={Wt} height={Ht} rx={8} fill="#000" opacity={0.7} />
                        <text x={10} y={17} fill="#fff" fontSize={12} opacity={0.9}>
                          {fmtDate(data[hoverIdx].t)}
                        </text>
                        <text x={10} y={32} fill="#fff" fontSize={12} fontWeight={700}>
                          {fmtPrice(data[hoverIdx].p)}
                        </text>
                      </g>
                    );
                  })()}
                </>
              )}

              {/* axes labels (hidden in minimal mode) */}
              {!minimal && (
                <g fill="#bbb" fontSize={12}>
                  <text x={8} y={padding.top + 12}>{fmtPrice(maxP)}</text>
                  <text x={8} y={H - padding.bottom}>{fmtPrice(minP)}</text>
                </g>
              )}
            </svg>
          </div>
        )}
      </div>

      {/* Range buttons */}
      {settingsMode && (
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "center",
            flexWrap: "wrap",
            marginTop: 10,
          }}
        >
          {(["1D", "7D", "30D", "90D", "1Y"] as RangeKey[]).map((rk) => (
            <button
              key={rk}
              onClick={() => setRange(rk)}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: rk === range ? "1px solid #aaa" : "1px solid #555",
                background: rk === range ? "#444" : "#2e2e2e",
                color: "#eee",
                cursor: "pointer",
              }}
            >
              {rk}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
