import { GoogleGenerativeAI } from "@google/generative-ai";
import type { JewelryCategory, JewelryItem } from "../types.js";
import { catalogPromptBlock } from "./catalog.js";
import type { OutfitAnalysis, RankingRow, RecommendResponse } from "../types.js";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash"; // default for new AI Studio keys

const TOP_N = 3;

function categoriesInCatalog(catalog: JewelryItem[]): JewelryCategory[] {
  const s = new Set<JewelryCategory>();
  for (const j of catalog) s.add(j.category);
  return Array.from(s);
}

function buildPrompt(allowedIds: string[], catalog: JewelryItem[]): string {
  const block = catalogPromptBlock(catalog);
  const cats = categoriesInCatalog(catalog);
  const catList = cats.join(", ");
  return `You are a jewelry stylist for a store that sells INDIAN ETHNIC jewelry only (necklaces, earrings, bracelets in traditional/festive Indian styles).

The user uploaded one or more photos of themselves wearing outfits.

CRITICAL — When NOT to recommend anything:
- If the outfit is clearly WESTERN (e.g. jeans and t-shirt, western dress, office western wear, sportswear, generic party dress with no Indian ethnic context), or otherwise NOT a good context for Indian ethnic jewelry, you MUST NOT recommend any pieces.
- In that case set "ethnic_jewelry_match": false, use empty object {} for "rankings_by_category", and set "ethnic_match_note" to a brief, polite one-sentence explanation (e.g. that this catalog is for Indian ethnic occasions and the outfit reads as western/casual western).

When TO recommend (ethnic_jewelry_match: true):
- Outfits that fit Indian ethnic styling: saree, lehenga, salwar kameez, kurta sets, indo-western with clear ethnic elements, festive/traditional Indian occasion wear, or similar.
- Then recommend ONLY from this inventory (exact "id" field). Do not invent IDs.

INVENTORY:
${block}

Allowed jewelry_id values (exact strings): ${JSON.stringify(allowedIds)}

Categories present in this inventory: ${catList}

For EACH uploaded image in order (first image = index 0, second = index 1, ...), first decide ethnic_jewelry_match, then if true, for EACH category in the inventory (${catList}) pick at most the TOP ${TOP_N} best-matching items. Within each category, rank 1 = best, 2 = second, 3 = third.
- Prefer complementary or harmonious colors, appropriate formality, and neckline/wrist/ear visibility.
- style_note: 1-2 sentences explaining why this piece works for THIS outfit.

If a category has fewer than ${TOP_N} items in inventory, return only those available (still at most ${TOP_N}).

Return ONLY valid JSON with this exact shape (no markdown):
{
  "outfit_analysis": [
    {
      "image_index": 0,
      "outfit_description": "short label of the outfit",
      "ethnic_jewelry_match": true,
      "ethnic_match_note": "optional short note",
      "rankings_by_category": {
        "necklace": [ { "rank": 1, "jewelry_id": "NCK-01", "style_note": "..." } ],
        "bracelet": [ { "rank": 1, "jewelry_id": "BR-01", "style_note": "..." } ]
      }
    }
  ]
}

If ethnic_jewelry_match is false, use:
"ethnic_jewelry_match": false,
"ethnic_match_note": "one sentence reason",
"rankings_by_category": {}

Use only these category keys as needed: "necklace", "earring", "bracelet" — only when ethnic_jewelry_match is true and that category exists in the inventory.

Include one outfit_analysis entry per uploaded image. image_index must be 0,1,2,... in order matching upload order.`;
}

export async function runRecommendation(
  apiKey: string,
  catalogSlice: JewelryItem[],
  imageParts: { mimeType: string; data: Buffer }[]
): Promise<RecommendResponse> {
  if (catalogSlice.length === 0) {
    throw new Error("No jewelry items match the selected categories.");
  }
  const allowedIds = catalogSlice.map((j) => j.id);
  const idToItem = new Map(catalogSlice.map((j) => [j.id, j]));
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.4,
    },
  });

  const prompt = buildPrompt(allowedIds, catalogSlice);
  const contentParts: (
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  )[] = [{ text: prompt }];

  for (const img of imageParts) {
    contentParts.push({
      inlineData: {
        mimeType: img.mimeType,
        data: img.data.toString("base64"),
      },
    });
  }

  const result = await model.generateContent({
    contents: [{ role: "user", parts: contentParts }],
  });
  const text = result.response.text();
  let parsed: RecommendResponse;
  try {
    parsed = JSON.parse(text) as RecommendResponse;
  } catch {
    throw new Error("Model did not return valid JSON.");
  }

  sanitizeResponse(parsed, allowedIds, imageParts.length, idToItem);
  return parsed;
}

function sanitizeResponse(
  data: RecommendResponse,
  allowedIds: string[],
  imageCount: number,
  idToItem: Map<string, JewelryItem>
): void {
  const allow = new Set(allowedIds);
  if (!data.outfit_analysis || !Array.isArray(data.outfit_analysis)) {
    throw new Error("Invalid response: missing outfit_analysis array.");
  }
  for (const oa of data.outfit_analysis) {
    normalizeOutfitAnalysis(oa, allow, idToItem);
  }
  if (data.outfit_analysis.length !== imageCount) {
    console.warn(
      `Expected ${imageCount} outfit blocks, got ${data.outfit_analysis.length}`
    );
  }
}

/** Normalize to rankings_by_category, max TOP_N per category; supports legacy flat "rankings". */
function normalizeOutfitAnalysis(
  oa: OutfitAnalysis & { rankings?: RankingRow[] },
  allow: Set<string>,
  idToItem: Map<string, JewelryItem>
): void {
  const cats: JewelryCategory[] = ["necklace", "earring", "bracelet"];

  if (oa.ethnic_jewelry_match === false) {
    oa.rankings_by_category = {};
    delete (oa as { rankings?: unknown }).rankings;
    if (!oa.ethnic_match_note?.trim()) {
      oa.ethnic_match_note =
        "This outfit does not match the Indian ethnic style for this catalog.";
    }
    return;
  }

  let byCat: Partial<Record<JewelryCategory, RankingRow[]>> = {};

  const raw = oa.rankings_by_category;
  if (raw && typeof raw === "object") {
    for (const c of cats) {
      const rows = raw[c];
      if (!Array.isArray(rows)) continue;
      byCat[c] = capAndRenumber(rows.filter((r) => allow.has(r.jewelry_id)));
    }
  }

  const hasAny = cats.some((c) => (byCat[c]?.length ?? 0) > 0);
  const legacy = oa.rankings;
  if (
    !hasAny &&
    legacy &&
    Array.isArray(legacy) &&
    legacy.length > 0
  ) {
    byCat = mergeWithLegacyFlat(legacy, allow, idToItem);
  }

  for (const c of cats) {
    const rows = byCat[c];
    if (!rows || rows.length === 0) delete byCat[c];
  }

  oa.rankings_by_category = byCat;
  delete (oa as { rankings?: unknown }).rankings;
}

function capAndRenumber(rows: RankingRow[]): RankingRow[] {
  const sorted = [...rows].sort((a, b) => a.rank - b.rank);
  return sorted.slice(0, TOP_N).map((r, i) => ({ ...r, rank: i + 1 }));
}

function mergeWithLegacyFlat(
  rankings: RankingRow[],
  allow: Set<string>,
  idToItem: Map<string, JewelryItem>
): Partial<Record<JewelryCategory, RankingRow[]>> {
  const sorted = [...rankings]
    .filter((r) => allow.has(r.jewelry_id))
    .sort((a, b) => a.rank - b.rank);
  const counts: Record<JewelryCategory, number> = {
    necklace: 0,
    earring: 0,
    bracelet: 0,
  };
  const out: Partial<Record<JewelryCategory, RankingRow[]>> = {};
  for (const c of ["necklace", "earring", "bracelet"] as const) {
    out[c] = [];
  }
  for (const r of sorted) {
    const item = idToItem.get(r.jewelry_id);
    if (!item) continue;
    const cat = item.category;
    if (counts[cat] >= TOP_N) continue;
    out[cat]!.push({ ...r, rank: counts[cat] + 1 });
    counts[cat]++;
  }
  for (const c of ["necklace", "earring", "bracelet"] as const) {
    out[c] = capAndRenumber(out[c] ?? []);
    if (out[c]!.length === 0) delete out[c];
  }
  return out;
}
