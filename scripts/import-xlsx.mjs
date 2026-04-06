import XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const xlsxPath = path.join(root, "jewellery-dataset.xlsx");
const outPath = path.join(root, "apps", "api", "data", "jewelry.json");

function normKey(k) {
  return String(k).trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeCategory(raw) {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return "necklace";
  if (s.includes("bracelet")) return "bracelet";
  if (s.includes("earring") && !s.includes("necklace")) return "earring";
  if (s.includes("necklace")) return "necklace";
  if (s === "necklace") return "necklace";
  return s;
}

const wb = XLSX.readFile(xlsxPath);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });

const items = rows
  .map((row) => {
    const o = {};
    for (const [k, v] of Object.entries(row)) {
      o[normKey(k)] = v;
    }
    const imageUrls = [o.image_url_1, o.image_url_2, o.image_url_3, o.image_url_4]
      .filter((u) => u && String(u).trim())
      .map((u) => String(u).trim().replace(/&amp;/g, "&"));
    const id = String(o.id ?? "").trim();
    return {
      id,
      name: String(o.name ?? "").trim(),
      category: normalizeCategory(o.category),
      description: String(o.description ?? "").trim(),
      imageUrl: imageUrls[0] ?? "",
      imageUrls,
      productPageUrl: o.product_page_url
        ? String(o.product_page_url).trim()
        : undefined,
      price: o.price !== undefined && o.price !== "" ? o.price : undefined,
      currency: o.currency ? String(o.currency).trim() : undefined,
    };
  })
  .filter((x) => x.id);

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(items, null, 2), "utf8");
console.log(`Wrote ${items.length} items to ${outPath}`);
