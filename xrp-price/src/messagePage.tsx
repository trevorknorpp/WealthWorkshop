// MessagePage.tsx
// ----------------------------------------------------------------------------------
// 🧩 PURPOSE:
// UI to connect two running gRPC servers (ClusterNodes) via their HTTP bridges,
// then send a test message and show results.
//
// ✅ This version fixes "possibly null" issues by using `getValid(...)`
// which returns a guaranteed NodeParsed (or throws). No more A/B null errors.
//
// 🧠 FLOW:
//   - You enter Node A and Node B as "host:grpcPort" (e.g., local:50051).
//   - We auto-derive the HTTP bridge as (grpcPort + 1000), e.g., 51051.
//   - Steps on Connect & Send:
//       1) POST A:/join { peer: B.grpcAddress }
//       2) POST B:/join { peer: A.grpcAddress }
//       3) POST A:/broadcast { message }
// ----------------------------------------------------------------------------------

import { useMemo, useState } from "react";

type NodeParsed = {
  host: string;        // e.g. 127.0.0.1
  grpcPort: number;    // e.g. 50051
  httpBridge: string;  // e.g. http://127.0.0.1:51051
  grpcAddress: string; // e.g. 127.0.0.1:50051
};

export default function MessagePage({ onBack }: { onBack: () => void }) {
  // One-line inputs (friendly): "local:50051" or "192.168.1.10:50051"
  const [nodeA, setNodeA] = useState("local:50051");
  const [nodeB, setNodeB] = useState("local:50052");

  // The message to broadcast from A
  const [msg, setMsg] = useState("hello 👋");

  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("");

  // Parse the strings into structured node info.
  // These can be null if the input is malformed.
  const A = useMemo(() => parseNode(nodeA), [nodeA]);
  const B = useMemo(() => parseNode(nodeB), [nodeB]);

  const append = (line: string) => setLog((s) => s + line + "\n");

  // POST helper for the HTTP bridge
  async function postJSON(url: string, body: any) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json().catch(() => ({}));
  }

  // Main action
  const connectAndSend = async () => {
    setBusy(true);
    setLog("");

    try {
      // ✅ These throw if inputs are invalid AND give us non-null types after.
      const a = getValid(A, "Node A");
      const b = getValid(B, "Node B");

      append(`🔌 Linking peers A <-> B`);
      append(`• A HTTP bridge: ${a.httpBridge}`);
      append(`• B HTTP bridge: ${b.httpBridge}`);
      append(`• A gRPC: ${a.grpcAddress}`);
      append(`• B gRPC: ${b.grpcAddress}`);

      // 1) Tell A about B
      await postJSON(a.httpBridge + "/join", { peer: b.grpcAddress });
      append(`✅ A joined B (${b.grpcAddress})`);

      // 2) Tell B about A (symmetry is nice)
      await postJSON(b.httpBridge + "/join", { peer: a.grpcAddress });
      append(`✅ B joined A (${a.grpcAddress})`);

      // 3) Broadcast from A
      const res = await postJSON(a.httpBridge + "/broadcast", { message: msg });
      const delivered = Number(res.delivered ?? 0);
      append(`📣 Broadcast from A delivered to ${delivered} peer(s)!`);
    } catch (err: any) {
      // Friendly guidance for the common issues
      append(`❌ ${err?.message || String(err)}`);
      // If A/B were invalid, we may not have ports; show generic advice
      const aPort = A?.grpcPort ?? 50051;
      const bPort = B?.grpcPort ?? 50052;
      append(`⚠️  Check that your HTTP bridges are running (grpc+1000):`);
      append(`   A bridge: http://<host>:${aPort + 1000}`);
      append(`   B bridge: http://<host>:${bPort + 1000}`);
      append(`   Also ensure no CORS/firewall is blocking requests.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={pageBox}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onBack} style={btnStyle}>← Back</button>
        <h3 style={{ margin: 0, color: "white" }}>Server Messaging</h3>
      </div>

      {/* Inputs */}
      <label style={label}>
        Node A (host:port)
        <input
          style={input}
          value={nodeA}
          onChange={e => setNodeA(e.target.value)}
          placeholder="local:50051 or 192.168.1.10:50051"
        />
        <Helper a={A} />
      </label>

      <label style={label}>
        Node B (host:port)
        <input
          style={input}
          value={nodeB}
          onChange={e => setNodeB(e.target.value)}
          placeholder="local:50052 or 192.168.1.11:50052"
        />
        <Helper a={B} />
      </label>

      <label style={label}>
        Message
        <input
          style={input}
          value={msg}
          onChange={e => setMsg(e.target.value)}
          placeholder="Your test message"
        />
      </label>

      <button onClick={connectAndSend} disabled={busy} style={{ ...btnStyle, opacity: busy ? 0.6 : 1 }}>
        {busy ? "Working..." : "Connect & Send"}
      </button>

      <pre style={logBox}>{log}</pre>

      <div style={{ color: "rgba(255,255,255,0.6)", marginTop: 10 }}>
        💡 Quick start:<br />
        1) Run two ClusterNode instances (gRPC on 50051/50052; bridge on 51051/51052).<br />
        2) Enter <b>local:50051</b> and <b>local:50052</b> above.<br />
        3) Click <b>Connect &amp; Send</b>.
      </div>
    </div>
  );
}

/** Small helper that shows what we parsed (or an inline error) */
function Helper({ a }: { a: NodeParsed | null }) {
  if (!a) {
    return <div style={{ color: "salmon", fontSize: 12, marginTop: 4 }}>Format: host:port (e.g., local:50051)</div>;
  }
  return (
    <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 4 }}>
      gRPC: <code>{a.grpcAddress}</code> &nbsp;→&nbsp; HTTP bridge: <code>{a.httpBridge}</code>
    </div>
  );
}

// ----------------------------------------------------------------------------------
// 🔣 Parse "local:50051" → NodeParsed | null
// ----------------------------------------------------------------------------------
function parseNode(input: string): NodeParsed | null {
  try {
    const parts = input.split(":");
    if (parts.length !== 2) return null;
    let host = parts[0].trim();
    if (!host) return null;
    if (host === "local") host = "127.0.0.1";
    const grpcPort = parseInt(parts[1], 10);
    if (!Number.isFinite(grpcPort)) return null;
    return {
      host,
      grpcPort,
      httpBridge: `http://${host}:${grpcPort + 1000}`,
      grpcAddress: `${host}:${grpcPort}`,
    };
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------------------
// ✅ Non-null guard that also *returns* the parsed node
// (TS now knows the result is NodeParsed; no "possibly null" warnings.)
// ----------------------------------------------------------------------------------
function getValid(node: NodeParsed | null, name: string): NodeParsed {
  if (!node) throw new Error(`${name} is invalid. Use format host:port (e.g., local:50051)`);
  return node;
}

// ----------------------------------------------------------------------------------
// 💅 Styles (unchanged aesthetic)
// ----------------------------------------------------------------------------------
const pageBox: React.CSSProperties = {
  color: "white",
  display: "grid",
  gap: 12,
};

const label: React.CSSProperties = { color: "white", opacity: 0.9, fontSize: 14, display: "grid", gap: 6 };
const input: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(0,0,0,0.35)",
  color: "white",
};
const btnStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(255,255,255,0.1)",
  color: "white",
  cursor: "pointer",
};
const logBox: React.CSSProperties = {
  background: "rgba(0,0,0,0.5)",
  border: "1px solid rgba(255,255,255,0.1)",
  padding: 10,
  borderRadius: 8,
  whiteSpace: "pre-wrap",
  maxHeight: 200,
  overflowY: "auto",
  fontSize: 13,
};
