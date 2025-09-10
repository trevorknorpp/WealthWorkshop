import { useEffect, useRef, useState } from "react";
import { HistoryChart } from "./HistoryChart.tsx";

type StreamProvider = "binance" | "kraken";

function makeWS(provider: StreamProvider) {
  if (provider === "binance") return new WebSocket("wss://stream.binance.com:9443/ws/xrpusdt@miniTicker");
  // Kraken requires a subscribe message
  return new WebSocket("wss://ws.kraken.com");
}

export default function XrpPrice({onBack}: {onBack?: () => void;}) 
{
  const [price, setPrice] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "streaming" | "polling" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  // at top of XrpPrice.tsx (near other state)
  const LAST_PRICE_KEY = "xrp_last_price";

  const [isStale, setIsStale] = useState(false);               // true while showing cached value
  const [dir, setDir] = useState<"none" | "up" | "down" | "flat">("none"); // direction vs. last shown


  // Dev mode + provider choice (persisted)
  const [devMode, setDevMode] = useState<boolean>(() => localStorage.getItem("xrp_dev_mode") === "1");
  const [settingsMode, setSettingsMode] = useState<boolean>(() => localStorage.getItem("xrp_settings_mode") == "1");
  const [provider, setProvider] = useState<StreamProvider>(() => (localStorage.getItem("xrp_provider") as StreamProvider) || "binance");
  useEffect(() => localStorage.setItem("xrp_dev_mode", devMode ? "1" : "0"), [devMode]);
  useEffect(() => localStorage.setItem("xrp_settings_mode", settingsMode ? "1" : "0"), [settingsMode]);
  useEffect(() => localStorage.setItem("xrp_provider", provider), [provider]);

  // decimals and fallback poll interval (persisted)
  const [decimals, setDecimals] = useState<number>(() => {
    const n = Number(localStorage.getItem("xrp_decimals") ?? 4);
    return Math.min(4, Math.max(1, Number.isFinite(n) ? n : 4));
  });
  const [intervalSec, setIntervalSec] = useState<number>(() => {
    const n = Number(localStorage.getItem("xrp_refresh_sec") ?? 10);
    return Number.isFinite(n) && n >= 1 ? n : 10;
  });
  const [sliderSec, setSliderSec] = useState<number>(intervalSec);
  useEffect(() => localStorage.setItem("xrp_decimals", String(decimals)), [decimals]);
  useEffect(() => localStorage.setItem("xrp_refresh_sec", String(intervalSec)), [intervalSec]);

  // right after your other useEffects or before connectWS()
  useEffect(() => {
    const cached = Number(localStorage.getItem(LAST_PRICE_KEY));
    if (Number.isFinite(cached)) {
      setPrice(cached);       // show it immediately
      setIsStale(true);       // mark as cached -> purple
    }
  }, []);


  // --- WebSocket stream (with provider switch + diagnostics) ---
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connectWS = () => {
    try {
      wsRef.current?.close();
      const ws = makeWS(provider);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("streaming");
        setErrorMsg("");
        reconnectAttemptRef.current = 0;
        if (provider === "kraken") {
          ws.send(JSON.stringify({
            event: "subscribe",
            pair: ["XRP/USD"],
            subscription: { name: "ticker" }
          }));
        }
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          // Binance miniTicker: { c: "lastPrice" }
          if (provider === "binance") {
            const p = msg?.c ? Number(msg.c) : null;
            if (p && Number.isFinite(p)) {
              commitLivePrice(p);
            }
          } else {
            // Kraken ticker: [channelID, { c: ["last","lot"] , ... }, "ticker", "XRP/USD"]
            if (Array.isArray(msg) && msg[2] === "ticker") {
              const pStr = msg[1]?.c?.[0];
              const p = pStr ? Number(pStr) : null;
              if (p && Number.isFinite(p)) {
                commitLivePrice(p);
              }
            }
          }
        } catch {
          /* ignore parse errors */
        }
      };

      ws.onerror = (_e) => {
        setErrorMsg("WebSocket error (likely blocked or dropped). See console for details.");
      };

      ws.onclose = (e) => {
        // expose close code/reason for debugging
        setErrorMsg(`WS closed code=${e.code} reason=${e.reason || "(none)"}`);
        setStatus("polling");
        scheduleReconnect();
      };
    } catch (ex: any) {
      setStatus("error");
      setErrorMsg(`WS construct failed: ${String(ex?.message ?? ex)}`);
    }
  };

  const scheduleReconnect = () => {
    const attempt = Math.min(reconnectAttemptRef.current + 1, 10);
    reconnectAttemptRef.current = attempt;
    const base = Math.min(30_000, 500 * 2 ** attempt);
    const jitter = Math.random() * 500;
    const delay = base + jitter;
    if (reconnectTimeoutRef.current) window.clearTimeout(reconnectTimeoutRef.current);
    reconnectTimeoutRef.current = window.setTimeout(connectWS, delay);
  };

  useEffect(() => {
    connectWS();
    return () => {
      wsRef.current?.close();
      if (reconnectTimeoutRef.current) window.clearTimeout(reconnectTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  // --- REST fallback (CoinGecko -> Bitstamp) with diagnostics ---
  const abortRef = useRef<AbortController | null>(null);
  const backoffRef = useRef(0);

  const fetchREST = async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const tryEndpoints = [
      async () => {
        const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd", { cache: "no-store", signal: ctrl.signal });
        if (!r.ok) throw new Error(`CoinGecko HTTP ${r.status}`);
        const j = await r.json();
        const v = j?.ripple?.usd;
        if (v == null) throw new Error("CoinGecko payload missing ripple.usd");
        return Number(v);
      },
      async () => {
        const r = await fetch("https://www.bitstamp.net/api/v2/ticker/xrpusd", { cache: "no-store", signal: ctrl.signal });
        if (!r.ok) throw new Error(`Bitstamp HTTP ${r.status}`);
        const j = await r.json();
        const v = j?.last;
        if (v == null) throw new Error("Bitstamp payload missing last");
        return Number(v);
      },
    ];

    let lastErr: any = null;
    for (const step of tryEndpoints) {
      try {
        const v = await step();
        if (Number.isFinite(v)) {
          commitLivePrice(v);
          setStatus((s) => (s === "streaming" ? s : "polling"));
          backoffRef.current = 0;
          setErrorMsg("");
          return;
        }
      } catch (e: any) {
        lastErr = e;
      }
    }
    setStatus("error");
    setErrorMsg(`REST failed: ${String(lastErr?.message ?? lastErr)}`);
    backoffRef.current = Math.min(backoffRef.current + 1, 6);
  };

  useEffect(() => {
    const tick = () => {
      if (status === "streaming") return; // no need to poll
      const baseMs = Math.max(1, intervalSec) * 1000;
      const backoffMs = Math.min(60_000, 1000 * 2 ** backoffRef.current);
      fetchREST();
      id = window.setTimeout(tick, baseMs + Math.random() * 250 + backoffMs);
    };
    let id: number | undefined;
    tick();
    return () => { if (id) window.clearTimeout(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalSec, status]);

  const formatPrice = (n: number | null) => {
    if (n == null) return "No price";
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n);
  };

  const priceColor =
    isStale ? "#cac6d158" :           // purple while cached is showing
      dir === "up" ? "#85f28a" :      // green on first live if higher
        dir === "down" ? "#ff7b7b" :    // red if lower
          "#eee";                         // neutral

  // basic environment hints
  //const online = typeof navigator !== "undefined" ? navigator.onLine : true;
  //const pageSecure = typeof window !== "undefined" ? window.location.protocol === "https:" : false;

  // tick every second so "x seconds ago" stays fresh (no network)
  const [nowTs, setNowTs] = useState<number>(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // human-readable "x seconds/minutes/hours ago"
  function timeAgo(updatedAtMs: number | null, nowMs: number) {
    if (!updatedAtMs) return "";
    const s = Math.max(0, Math.floor((nowMs - updatedAtMs) / 1000));
    if (s < 5) return "just now";
    if (s < 60) return `${s} second${s === 1 ? "" : "s"} ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
    const h = Math.floor(m / 60);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }

  function commitLivePrice(p: number) {
    // compare to what’s currently on screen (cached or previous live)
    const prev = price;
    if (prev != null) {
      if (p > prev) setDir("up");
      else if (p < prev) setDir("down");
      else setDir("flat");
    } else {
      setDir("none");
    }

    setPrice(p);
    setIsStale(false);                           // we’re live now
    setUpdatedAt(Date.now());
    localStorage.setItem(LAST_PRICE_KEY, String(p));
  }

  return (
    // Viewport wrapper — centers the card both directions
    <div
      style={{
        position: "fixed",            //stays locked when scrolling
        inset: 0,                     // shorthand for "top:0 right:0 bottom:0 left:0"
        display: "grid",              // CSS grud box
        placeItems: "center",         // align and justify items to center
        background: "#000000ff",    // black background on the whole page
        zIndex: 0,                    // bottom of stacking order
      }}
    >
      {/* Card/container — finite width so it's truly centered */}
      <div
        style={{
          width: "min(700px, 96vw)",                // whichever is larger, 900px or 96% of viewport width
          padding: "clamp(12px, 2.2vw, 20px) clamp(16px, 3vw, 28px)",       // never smaller than px, never bigger than px, scales with viewport width in between.
          borderRadius: 16,                         //rounded corners (not inherite)
          lineHeight: 1.5,                          //vertical spacing between lines
          fontFamily: "system-ui, Arial",           //typeface
          color: "#ffffffff",                          //text color
          textAlign: "center",                      //aligns texts in box center horizontally
          boxSizing: "border-box",                  //changes how width and height are calculated, includes padding and border inside width
          background: "#000000ff",
        }}
      >
        {/* Header (XRP PRICE) + Exchange*/}
        <div
          style={{
          display: "flex",                        //turns a row into a grid container
            alignItems: "center",                   //align = vertical (start, center, end)
            //content = whole set of tracks/items, items =  alignment for all children, self = alignment for one specific child
            gap: 12,
          }}>

          {/* Back (left) */}
          {onBack ? (
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
          ) : (
            <span style={{ gridColumn: "1 / 2" }} /> // keeps the layout
          )}

          {/*"XRP Price"*/}
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(22px, 4.2vw, 48px)",
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            XRP</h1>

          {/*If settings mode selected, show api provider*/}
          {settingsMode ? (
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as StreamProvider)}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                fontSize: "clamp(12px, 2.2vw, 14px)",
                marginLeft: "auto",
              }}
            >
              <option value="binance">Binance WS</option>
              <option value="kraken">Kraken WS</option>
            </select>
          ) : (
            <span/> // spacer to mirror right slot
          )}
        </div>

        <div style={{ marginTop: 8, fontSize: "clamp(24px, 5vw, 44px)" }}>
          <p style={{
            fontSize: "clamp(28px, 6.5vw, 64px)",
            fontWeight: 800,
            margin: 0,
            color: priceColor,
            transition: "color 180ms ease",
          }}>
            {formatPrice(price)}
          </p>
        </div>

        {/*Chart*/}
        <HistoryChart decimals={decimals} settingsMode={settingsMode} square minimal />

        <div style={{ marginTop: 8, fontSize: "clamp(24px, 5vw, 44px)" }}>
          <p style={{ margin: 0, fontSize: "clamp(12px, 2vw, 14px)", opacity: 0.7 }}>
            {isStale
              ? "Showing cached price…"
              : updatedAt ? `Last updated ${timeAgo(updatedAt, nowTs)}` : ""}
          </p>
        </div>

        {/* Settings mode toggle*/}
        <div
          style={{
            display: "flex",
            gap: 16, // space between the two
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 12,
            marginTop: 10
          }}
        >
          <label style={{ display: "flex", alignItems: "center" }}>
            <input
              type="checkbox"
              checked={settingsMode}
              onChange={(e) => setSettingsMode(e.target.checked)}
            />
            Settings
          </label>

          <label style={{ display: "flex", alignItems: "center" }}>
            <input
              type="checkbox"
              checked={devMode}
              onChange={(e) => setDevMode(e.target.checked)}
            />
            Dev mode
          </label>
        </div>


        {/* Dev panel (left-aligned inside the card for readability)ggv */}
        {devMode && (
          <div
            style={{
              marginTop: 20,
              padding: 16,
              border: "1px solid #4a4a4a",
              borderRadius: 12,
              background: "#333",
              textAlign: "left",
            }}
          >
            <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 8 }}>
              Mode:{" "}
              <strong>
                {status === "streaming"
                  ? "WebSocket (live)"
                  : status === "polling"
                    ? "REST fallback"
                    : status === "error"
                      ? "Error (retrying…)"
                      : "Idle"}
              </strong>
              {errorMsg && <span style={{ color: "crimson", marginLeft: 8 }}>• {errorMsg}</span>}
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label style={{ fontSize: 14, opacity: 0.9 }}>
                  Fallback refresh: <strong>{intervalSec}</strong>s
                </label>
                <input
                  type="range"
                  min={1}
                  max={300}
                  step={1}
                  value={sliderSec}
                  onChange={(e) => setSliderSec(Number(e.target.value))}
                  onPointerUp={() => setIntervalSec(sliderSec)}
                  onKeyUp={(e) => {
                    if (e.key === "Enter" || e.key === " ") setIntervalSec(sliderSec);
                  }}
                  style={{ width: "100%" }}
                />
                <div style={{ display: "flex", justifyContent: "center", fontSize: 12, opacity: 0.7 }}>
                  <span>1s</span>
                  <span>300s</span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 14, opacity: 0.9 }}>
                  Decimals: <strong>{decimals}</strong>
                </label>
                <input
                  type="range"
                  min={1}
                  max={4}
                  step={1}
                  value={decimals}
                  onChange={(e) => setDecimals(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => fetchREST()}
                  style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #777", cursor: "pointer" }}
                >
                  Fetch once (REST)
                </button>
                <button
                  onClick={() => {
                    reconnectAttemptRef.current = 0;
                    connectWS();
                  }}
                  style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #777", cursor: "pointer" }}
                >
                  Restart WS
                </button>
                <button
                  onClick={() => setIntervalSec(1)}
                  style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #777", cursor: "pointer" }}
                >
                  Turbo 1s
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
