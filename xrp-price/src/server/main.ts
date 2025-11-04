import { ClusterNode } from "../server/clusterServer";

const HOST = process.env.HOST ?? "127.0.0.1";
const PORT = parseInt(process.env.PORT ?? "50051", 10);
const PEERS = (process.env.PEERS ?? "").split(",").map(s => s.trim()).filter(Boolean);

(async () => {
  const node = new ClusterNode(HOST, PORT);
  await node.start(PEERS);
  process.on("SIGINT", () => node.stop().then(() => process.exit(0)));
})();
