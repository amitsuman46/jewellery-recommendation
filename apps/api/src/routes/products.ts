import type { FastifyInstance } from "fastify";
import { loadCatalog } from "../lib/catalog.js";

export async function productsRoutes(app: FastifyInstance) {
  app.get("/api/products", async (_request, reply) => {
    const items = loadCatalog();
    return reply.send({ products: items });
  });
}
