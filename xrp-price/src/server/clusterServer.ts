// clusterServer.ts
// -----------------------------------------------------------------------------
// Minimal gRPC "cluster" node in TypeScript (Node.js) that can run multiple
// instances and talk to each other. This version:
//
// - Avoids parameter properties (compatible with erasableSyntaxOnly toolchains).
// - Strongly types request/response shapes so `res` is never `unknown`.
// - Uses a `ClusterClient` interface to tell TS what the dynamic client exposes.
// - Binds client methods (client.Ping.bind(client)) so `this` is correct.
// -----------------------------------------------------------------------------

import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { v4 as uuidv4 } from "uuid";
import path from "node:path";

// -----------------------------------------------------------------------------
// Shared types (match your .proto)
// -----------------------------------------------------------------------------
type NodeInfo = { id: string; address: string };

type JoinRequest = { me: NodeInfo };
type JoinResponse = { peers: NodeInfo[] };

type PingRequest = { from: string };
type PingReply = { ack: string };

type BroadcastRequest = { from: string; message: string };
type BroadcastReply = { delivered: number };

// What methods the generated client exposes for the Cluster service.
// (This gives TypeScript enough info to infer TReq/TRes at callsites.)
type ClusterClient = {
  Join(req: JoinRequest, cb: (e: grpc.ServiceError | null, r: JoinResponse) => void): void;
  Ping(req: PingRequest, cb: (e: grpc.ServiceError | null, r: PingReply) => void): void;
  Broadcast(req: BroadcastRequest, cb: (e: grpc.ServiceError | null, r: BroadcastReply) => void): void;
};

// -----------------------------------------------------------------------------
// Load proto package (dynamic) and keep "any" at the very edge.
// We reintroduce strong typing via ClusterClient above.
// -----------------------------------------------------------------------------
const PROTO_PATH = path.join(__dirname, "..", "..", "server", "protos", "cluster.proto");
const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
});
const proto = grpc.loadPackageDefinition(packageDef) as any;

// -----------------------------------------------------------------------------
// Service implementation type for the server side (handlers).
// -----------------------------------------------------------------------------
type ClusterServiceImpl = {
  Join: (call: grpc.ServerUnaryCall<JoinRequest, JoinResponse>, cb: grpc.sendUnaryData<JoinResponse>) => void;
  Ping: (call: grpc.ServerUnaryCall<PingRequest, PingReply>, cb: grpc.sendUnaryData<PingReply>) => void;
  Broadcast: (
    call: grpc.ServerUnaryCall<BroadcastRequest, BroadcastReply>,
    cb: grpc.sendUnaryData<BroadcastReply>
  ) => void;
};

// -----------------------------------------------------------------------------
// Cluster node
// -----------------------------------------------------------------------------
export class ClusterNode {
  // Public identity/address
  readonly id: string;
  readonly address: string;

  // gRPC server instance
  private server: grpc.Server;

  // Known peers (roster) and connected clients
  private peers = new Map<string, NodeInfo>();     // id -> NodeInfo
  private clients = new Map<string, ClusterClient>(); // id -> gRPC client

  // NOTE: Avoid TS parameter properties (not allowed in erasableSyntaxOnly).

  // Regular constructor: assign fields explicitly.
  constructor(host: string, port: number) {
    this.id = uuidv4();
    this.address = `${host}:${port}`;
    this.server = new grpc.Server();
  }

  // Build the service implementation (Join/Ping/Broadcast)
  private makeServiceImpl(): ClusterServiceImpl {
    return {
      // A peer calls Join to introduce itself. We add it to our roster and
      // return our current peer list (including us).
      Join: (call, cb) => {
        const me = call.request.me as NodeInfo;
        this.peers.set(me.id, me);
        if (!this.clients.has(me.id)) this.connectToPeer(me);

        const peers = Array.from(this.peers.values());
        // include ourselves in the list we return
        peers.push({ id: this.id, address: this.address });

        cb(null, { peers });
        console.log(`[${this.id}] ${me.address} joined. Peers now: ${peers.length}`);
      },

      // Simple liveness check
      Ping: (call, cb) => {
        cb(null, { ack: `ack from ${this.id} to ${call.request.from}` });
      },

      // “Broadcast” demo: we just Ping each peer to prove fan-out. In a real
      // app you’d define another RPC that carries your message payload.
      Broadcast: async (call, cb) => {
        const { from, message } = call.request;
        let delivered = 0;

        for (const [peerId, client] of this.clients) {
          if (peerId === from) continue;
          try {
            // Bind the method so the client `this` is correct.
            await unary(client.Ping.bind(client), { from: this.id });
            delivered++;
          } catch {
            // Peer may be down; ignore for demo purposes.
          }
        }

        cb(null, { delivered });
        console.log(`[${this.id}] Broadcast from ${from}: "${message}" -> ${delivered} peers`);
      },
    };
  }

  // Maintain a gRPC client for a peer so we can call its RPCs.
  private connectToPeer(peer: NodeInfo) {
    if (peer.id === this.id) return;
    const client = new proto.cluster.Cluster(
      peer.address,
      grpc.credentials.createInsecure()
    ) as ClusterClient;

    this.clients.set(peer.id, client);
  }

  // Best-effort bootstrap: introduce ourselves to a known node and merge its roster.
  private async joinPeer(address: string) {
    const client = new proto.cluster.Cluster(
      address,
      grpc.credentials.createInsecure()
    ) as ClusterClient;

    // Call Join on the remote peer. Binding is important for `this`.
    const res = await unary(client.Join.bind(client), { me: { id: this.id, address: this.address } });
    const peers = res.peers ?? [];

    for (const p of peers) {
      this.peers.set(p.id, p);
      if (!this.clients.has(p.id)) this.connectToPeer(p);
    }
    console.log(`[${this.id}] Synced peers from ${address}: ${peers.length}`);
  }

  // Start the local gRPC server and optionally bootstrap to known peers.
  async start(bootstrapPeers: string[] = []) {
    this.server.addService(proto.cluster.Cluster.service, this.makeServiceImpl());

    // bindAsync starts the server listening on host:port
    await new Promise<void>((resolve, reject) =>
      this.server.bindAsync(this.address, grpc.ServerCredentials.createInsecure(), (err) =>
        err ? reject(err) : resolve()
      )
    );

    this.server.start();
    console.log(`[${this.id}] listening on ${this.address}`);

    // Try to join each known peer; failures are non-fatal.
    for (const addr of bootstrapPeers) {
      try {
        await this.joinPeer(addr);
      } catch {
        /* ignore */
      }
    }
  }

  // Graceful shutdown
  async stop() {
    await new Promise<void>((resolve) => this.server.tryShutdown(() => resolve()));
  }
}

// -----------------------------------------------------------------------------
// Promisified unary-call helper with strong typing.
// Pass a *bound* client method, e.g. `unary(client.Ping.bind(client), req)`.
// -----------------------------------------------------------------------------
function unary<TReq, TRes>(
  method: (req: TReq, cb: (err: grpc.ServiceError | null, res: TRes) => void) => void,
  req: TReq
): Promise<TRes> {
  return new Promise<TRes>((resolve, reject) => {
    method(req, (err, res) => (err ? reject(err) : resolve(res)));
  });
}
