import { useEffect, useRef, useState } from "react";

type StreamProvider = "binance" | "kraken";

function makeWS(provider: StreamProvider) {
  if (provider === "binance") return new WebSocket("wss://stream.binance.com:9443/ws/xrpusdt@miniTicker");
  // Kraken requires a subscribe message
  return new WebSocket("wss://ws.kraken.com");
}

export default function XrpPrice() {
  const [price, setPrice] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "streaming" | "polling" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  // Dev mode + provider choice (persisted)
  const [devMode, setDevMode] = useState<boolean>(() => localStorage.getItem("xrp_dev_mode") === "1");
  const [provider, setProvider] = useState<StreamProvider>(() => (localStorage.getItem("xrp_provider") as StreamProvider) || "binance");
  useEffect(() => localStorage.setItem("xrp_dev_mode", devMode ? "1" : "0"), [devMode]);
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
              setPrice(p);
              setUpdatedAt(Date.now());
            }
          } else {
            // Kraken ticker: [channelID, { c: ["last","lot"] , ... }, "ticker", "XRP/USD"]
            if (Array.isArray(msg) && msg[2] === "ticker") {
              const pStr = msg[1]?.c?.[0];
              const p = pStr ? Number(pStr) : null;
              if (p && Number.isFinite(p)) {
                setPrice(p);
                setUpdatedAt(Date.now());
              }
            }
          }
        } catch {
          /* ignore parse errors */
        }
      };

      ws.onerror = (e) => {
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
          setPrice(v);
          setUpdatedAt(Date.now());
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

  // basic environment hints
  const online = typeof navigator !== "undefined" ? navigator.onLine : true;
  const pageSecure = typeof window !== "undefined" ? window.location.protocol === "https:" : false;

  return (
    <div style={{ fontFamily: "system-ui, Arial", padding: 24, maxWidth: 600, margin: "40px auto", lineHeight: 1.4 }}>
      {/* Header with Dev toggle & provider */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0 }}>XRP Price</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={devMode} onChange={(e) => setDevMode(e.target.checked)} />
            <span style={{ fontSize: 14, opacity: 0.85 }}>Dev mode</span>
          </label>
          {devMode && (
            <select value={provider} onChange={(e) => setProvider(e.target.value as StreamProvider)} style={{ padding: "4px 8px", borderRadius: 6 }}>
              <option value="binance">Binance WS</option>
              <option value="kraken">Kraken WS</option>
            </select>
          )}
        </div>
      </div>

      {/* Minimal readout */}
      <div style={{ marginTop: 16 }}>
        <p style={{ fontSize: 36, fontWeight: 800, margin: 0 }}>{formatPrice(price)}</p>
        <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>
          {updatedAt ? `Updated ${new Date(updatedAt).toLocaleTimeString()}` : ""}
        </p>
      </div>

      {/* Dev panel */}
      {devMode && (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #e3e3e3", borderRadius: 12, background: "#fafafa" }}>
          <div style={{ fontSize: 14, opacity: 0.85, marginBottom: 8 }}>
            Mode: <strong>
              {status === "streaming" ? "WebSocket (live)"
                : status === "polling" ? "REST fallback"
                : status === "error" ? "Error (retrying…)" : "Idle"}
            </strong>
            {errorMsg && <span style={{ color: "crimson", marginLeft: 8 }}>• {errorMsg}</span>}
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {/* Fallback refresh */}
            <div>
              <label style={{ fontSize: 14, opacity: 0.85 }}>Fallback refresh: <strong>{intervalSec}</strong>s</label>
              <input type="range" min={1} max={300} step={1}
                     value={sliderSec}
                     onChange={(e) => setSliderSec(Number(e.target.value))}
                     onPointerUp={() => setIntervalSec(sliderSec)}
                     onKeyUp={(e) => { if (e.key === "Enter" || e.key === " ") setIntervalSec(sliderSec); }}
                     style={{ width: "100%" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.7 }}>
                <span>1s</span><span>300s</span>
              </div>
            </div>

            {/* Decimals */}
            <div>
              <label style={{ fontSize: 14, opacity: 0.85 }}>Decimals: <strong>{decimals}</strong></label>
              <input type="range" min={1} max={4} step={1} value={decimals} onChange={(e) => setDecimals(Number(e.target.value))} style={{ width: "100%" }} />
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => fetchREST()} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ccc", cursor: "pointer" }}>
                Fetch once (REST)
              </button>
              <button onClick={() => { reconnectAttemptRef.current = 0; connectWS(); }}
                      style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ccc", cursor: "pointer" }}>
                Restart WS
              </button>
              <button onClick={() => setIntervalSec(1)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ccc", cursor: "pointer" }}>
                Turbo 1s
              </button>
            </div>

            {/* Diagnostics */}
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              <div>Online: <strong>{online ? "yes" : "no"}</strong></div>
              <div>Page secure (https): <strong>{pageSecure ? "yes" : "no"}</strong></div>
              <div>User agent: <code>{typeof navigator !== "undefined" ? navigator.userAgent : "n/a"}</code></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
