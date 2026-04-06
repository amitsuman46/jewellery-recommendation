import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { productsRoutes } from "./routes/products.js";
import { recommendRoutes } from "./routes/recommend.js";

const PORT = Number(process.env.PORT) || 3001;
const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:5173";

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: WEB_ORIGIN.split(",").map((s) => s.trim()),
    methods: ["GET", "POST", "OPTIONS"],
  });

  await app.register(productsRoutes);
  await app.register(recommendRoutes);

  app.get("/health", async () => ({ ok: true }));

  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`API listening on http://localhost:${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
