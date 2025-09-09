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
}: {
  decimals?: number;
  settingsMode?: boolean;
  height?: number;
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

  // layout
  const padding = { top: 14, right: 14, bottom: 24, left: 40 };
  const width = 720; // logical width; SVG will scale to container width via CSS

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

    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;
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
  }, [data, height]);

  // hover/tooltip
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current || !data.length) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    // find nearest point by x (binary search would be ideal; linear is fine for small N)
    let nearest = 0;
    let best = Infinity;
    for (let i = 0; i < data.length; i++) {
      const dx = Math.abs(px - xAtIndex(i));
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
      <div style={{ width: "100%", marginTop: 10 }}>
        {status === "loading" && (
          <div style={{ textAlign: "center", opacity: 0.7 }}>Loading history…</div>
        )}
        {status === "error" && (
          <div style={{ color: "crimson", textAlign: "center" }}>
            Failed to load history: {err}
          </div>
        )}
        {status === "ok" && (
          <div style={{ width: "100%" }}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${width} ${height}`}
              style={{ width: "100%", height, display: "block", background: "#2a2a2a", borderRadius: 12 }}
              onMouseMove={onMove}
              onMouseLeave={onLeave}
            >
              {/* grid lines */}
              <g opacity={0.15} stroke="#fff">
                {/* 4 horizontal lines */}
                {[0, 1, 2, 3, 4].map((i) => {
                  const y = padding.top + ((height - padding.top - padding.bottom) / 4) * i;
                  return <line key={i} x1={padding.left} x2={width - padding.right} y1={y} y2={y} />;
                })}
              </g>

              {/* price path */}
              <path d={pathD} stroke="#7db4ff" strokeWidth={2.5} fill="none" />

              {/* hover crosshair + dot + tooltip */}
              {hoverIdx !== null && (
                <>
                  {/* vertical guide */}
                  <line
                    x1={xAtIndex(hoverIdx)}
                    x2={xAtIndex(hoverIdx)}
                    y1={padding.top}
                    y2={height - padding.bottom}
                    stroke="#aaa"
                    strokeDasharray="4 4"
                    opacity={0.7}
                  />
                  {/* point */}
                  <circle
                    cx={xAtIndex(hoverIdx)}
                    cy={yAtIndex(hoverIdx)}
                    r={4}
                    fill="#fff"
                    stroke="#7db4ff"
                    strokeWidth={2}
                  />
                  {/* tooltip (pure SVG) */}
                  {hoverIdx !== null && (
                    <>
                      {/* vertical guide */}
                      <line
                        x1={xAtIndex(hoverIdx)}
                        x2={xAtIndex(hoverIdx)}
                        y1={padding.top}
                        y2={height - padding.bottom}
                        stroke="#aaa"
                        strokeDasharray="4 4"
                        opacity={0.7}
                        pointerEvents="none"
                      />
                      {/* point */}
                      <circle
                        cx={xAtIndex(hoverIdx)}
                        cy={yAtIndex(hoverIdx)}
                        r={4}
                        fill="#fff"
                        stroke="#7db4ff"
                        strokeWidth={2}
                        pointerEvents="none"
                      />

                      {/* tooltip box */}
                      {(() => {
                        const W = 180;
                        const H = 44;
                        // keep the tooltip inside the chart bounds
                        const rawX = xAtIndex(hoverIdx) + 8;
                        const x = Math.min(
                          Math.max(rawX, padding.left),
                          width - padding.right - W
                        );
                        const rawY = yAtIndex(hoverIdx) - H - 8; // prefer above the point
                        const y = Math.min(
                          Math.max(rawY, padding.top),
                          height - padding.bottom - H
                        );
                        return (
                          <g transform={`translate(${x}, ${y})`} pointerEvents="none">
                            <rect width={W} height={H} rx={8} fill="#000" opacity={0.7} />
                            <text x={10} y={18} fill="#fff" fontSize={12} opacity={0.9}>
                              {fmtDate(data[hoverIdx].t)}
                            </text>
                            <text x={10} y={34} fill="#fff" fontSize={12} fontWeight={700}>
                              {fmtPrice(data[hoverIdx].p)}
                            </text>
                          </g>
                        );
                      })()}
                    </>
                  )}
                </>
              )}

              {/* axes labels (min/max) */}
              <g fill="#bbb" fontSize={12}>
                <text x={8} y={padding.top + 12}>{fmtPrice(maxP)}</text>
                <text x={8} y={height - padding.bottom}>{fmtPrice(minP)}</text>
              </g>
            </svg>
          </div>
        )}
      </div>

      {/* Range buttons */}
      {settingsMode && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 10  }}>
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
