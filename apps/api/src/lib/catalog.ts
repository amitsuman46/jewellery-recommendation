import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { JewelryCategory, JewelryItem } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

let cache: JewelryItem[] | null = null;

export function loadCatalog(): JewelryItem[] {
  if (cache) return cache;
  const path = join(__dirname, "../../data/jewelry.json");
  const raw = readFileSync(path, "utf8");
  cache = JSON.parse(raw) as JewelryItem[];
  return cache;
}

export function filterByCategories(
  items: JewelryItem[],
  categories: JewelryCategory[] | undefined
): JewelryItem[] {
  if (!categories || categories.length === 0) return items;
  const set = new Set(categories);
  return items.filter((i) => set.has(i.category));
}

export function catalogPromptBlock(items: JewelryItem[]): string {
  return items
    .map(
      (j) =>
        `- id: ${j.id}\n  name: ${j.name}\n  category: ${j.category}\n  description: ${j.description}`
    )
    .join("\n\n");
}

export function byIdMap(items: JewelryItem[]): Map<string, JewelryItem> {
  return new Map(items.map((j) => [j.id, j]));
}
