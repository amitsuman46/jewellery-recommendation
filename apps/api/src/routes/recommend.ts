import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import {
  byIdMap,
  filterByCategories,
  loadCatalog,
} from "../lib/catalog.js";
import { runRecommendation } from "../lib/gemini.js";
import type { JewelryCategory } from "../types.js";

const MAX_FILES = 8;
const MAX_FILE_MB = 12;

const CATS: JewelryCategory[] = ["necklace", "earring", "bracelet"];

function hydrateRanking(
  map: ReturnType<typeof byIdMap>,
  r: { rank: number; jewelry_id: string; style_note: string }
) {
  const product = map.get(r.jewelry_id);
  return {
    rank: r.rank,
    jewelry_id: r.jewelry_id,
    style_note: r.style_note,
    product: product
      ? {
          id: product.id,
          name: product.name,
          category: product.category,
          imageUrl: product.imageUrl,
          imageUrls: product.imageUrls,
          productPageUrl: product.productPageUrl,
        }
      : null,
  };
}

export async function recommendRoutes(app: FastifyInstance) {
  await app.register(multipart, {
    limits: { fileSize: MAX_FILE_MB * 1024 * 1024 },
  });

  app.post("/api/recommend", async (request, reply) => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return reply.status(503).send({
        error: "GEMINI_API_KEY is not set. Add it to your environment.",
      });
    }

    const parts = request.parts();
    const buffers: { mimeType: string; data: Buffer }[] = [];
    let categoriesRaw = "";

    for await (const part of parts) {
      if (part.type === "file" && part.fieldname === "images") {
        if (buffers.length >= MAX_FILES) continue;
        const buf = await part.toBuffer();
        const mime = part.mimetype || "image/jpeg";
        buffers.push({ mimeType: mime, data: buf });
      } else if (part.type === "field" && part.fieldname === "categories") {
        categoriesRaw = String((part as { value?: string }).value ?? "");
      }
    }

    if (buffers.length === 0) {
      return reply.status(400).send({
        error: "Upload at least one image (field name: images).",
      });
    }

    let categories: JewelryCategory[] | undefined;
    try {
      if (categoriesRaw && categoriesRaw.trim()) {
        const parsed = JSON.parse(categoriesRaw) as string[];
        categories = parsed as JewelryCategory[];
      }
    } catch {
      return reply.status(400).send({ error: "Invalid categories JSON." });
    }

    const all = loadCatalog();
    const slice = filterByCategories(all, categories);
    if (slice.length === 0) {
      return reply.status(400).send({
        error: "No products match the selected categories.",
      });
    }

    let raw;
    try {
      raw = await runRecommendation(key, slice, buffers);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Recommendation failed.";
      return reply.status(502).send({ error: msg });
    }

    const map = byIdMap(slice);
    const hydrated = {
      outfit_analysis: (raw.outfit_analysis ?? []).map((oa) => {
        const byCat: Record<string, unknown> = {};
        for (const c of CATS) {
          const rows = oa.rankings_by_category?.[c];
          if (!rows?.length) continue;
          byCat[c] = rows.map((r) => hydrateRanking(map, r));
        }
        return {
          image_index: oa.image_index,
          outfit_description: oa.outfit_description,
          ethnic_jewelry_match: oa.ethnic_jewelry_match !== false,
          ethnic_match_note: oa.ethnic_match_note,
          rankings_by_category: byCat,
        };
      }),
    };

    return reply.send(hydrated);
  });
}
