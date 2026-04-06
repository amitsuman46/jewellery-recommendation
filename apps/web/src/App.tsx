import { useCallback, useEffect, useState } from "react";

type Category = "necklace" | "earring" | "bracelet";

interface Product {
  id: string;
  name: string;
  category: Category;
  description: string;
  imageUrl: string;
  imageUrls: string[];
  productPageUrl?: string;
}

interface Ranking {
  rank: number;
  jewelry_id: string;
  style_note: string;
  product: {
    id: string;
    name: string;
    category: Category;
    imageUrl: string;
    imageUrls: string[];
    productPageUrl?: string;
  } | null;
}

interface OutfitBlock {
  image_index: number;
  outfit_description: string;
  ethnic_jewelry_match?: boolean;
  ethnic_match_note?: string;
  rankings_by_category: Partial<Record<Category, Ranking[]>>;
}

const API = "/api";

export default function App() {
  const [view, setView] = useState<"browse" | "ai">("browse");
  const [products, setProducts] = useState<Product[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [cat, setCat] = useState<Record<Category, boolean>>({
    necklace: true,
    earring: true,
    bracelet: true,
  });
  const [loading, setLoading] = useState(false);
  const [recErr, setRecErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ outfit_analysis: OutfitBlock[] } | null>(
    null
  );
  const [resultOutfitUrls, setResultOutfitUrls] = useState<string[]>([]);
  const [pickerThumbUrls, setPickerThumbUrls] = useState<string[]>([]);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPickerThumbUrls(urls);
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [files]);

  useEffect(() => {
    return () => {
      resultOutfitUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [resultOutfitUrls]);

  useEffect(() => {
    fetch(`${API}/products`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: { products: Product[] }) => setProducts(d.products))
      .catch((e) => setLoadErr(String(e.message)));
  }, []);

  const byCategory = useCallback(() => {
    const m: Record<Category, Product[]> = {
      necklace: [],
      earring: [],
      bracelet: [],
    };
    for (const p of products) {
      if (m[p.category]) m[p.category].push(p);
    }
    return m;
  }, [products]);

  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    setFiles(list ? Array.from(list) : []);
  };

  const submitAi = async () => {
    setRecErr(null);
    setResultOutfitUrls([]);
    setResult(null);
    if (files.length === 0) {
      setRecErr("Add at least one outfit photo.");
      return;
    }
    const picked = (["necklace", "earring", "bracelet"] as Category[]).filter(
      (c) => cat[c]
    );
    if (picked.length === 0) {
      setRecErr("Select at least one jewelry type.");
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      for (const f of files) fd.append("images", f);
      if (picked.length < 3) {
        fd.append("categories", JSON.stringify(picked));
      }
      const res = await fetch(`${API}/recommend`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const outfitUrls = files.map((f) => URL.createObjectURL(f));
      setResultOutfitUrls(outfitUrls);
      setResult(data);
    } catch (e) {
      setRecErr(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const copyJson = () => {
    if (!result) return;
    void navigator.clipboard.writeText(JSON.stringify(result, null, 2));
  };

  const grouped = byCategory();

  return (
    <div className="min-h-svh bg-stone-50 text-stone-900">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <button
            type="button"
            onClick={() => setView("browse")}
            className="text-left font-semibold tracking-tight text-stone-800"
          >
            Anoree
          </button>
          <nav className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setView("browse")}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                view === "browse"
                  ? "bg-stone-900 text-white"
                  : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              Shop
            </button>
            <button
              type="button"
              onClick={() => setView("ai")}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
                view === "ai"
                  ? "bg-violet-600 text-white"
                  : "bg-violet-100 text-violet-800 hover:bg-violet-200"
              }`}
            >
              <span aria-hidden>✨</span>
              AI outfit match
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {view === "browse" && (
          <div>
            <h1 className="mb-2 text-2xl font-semibold tracking-tight">
              Curated jewelry
            </h1>
            <p className="mb-8 text-stone-600">
              Browse necklaces, earrings, and bracelets — then try AI styling for your outfit.
            </p>
            {loadErr && (
              <p className="rounded-lg bg-red-50 p-3 text-red-800">
                Could not load catalog: {loadErr}
              </p>
            )}
            {(["necklace", "earring", "bracelet"] as const).map((c) => (
              <section key={c} className="mb-12">
                <h2 className="mb-4 capitalize text-lg font-medium text-stone-800">
                  {c}s
                </h2>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {grouped[c].map((p) => (
                    <article
                      key={p.id}
                      className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
                    >
                      <div className="aspect-[4/3] bg-stone-100">
                        <img
                          src={p.imageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div className="p-4 text-left">
                        <p className="text-xs uppercase tracking-wide text-stone-500">
                          {p.id}
                        </p>
                        <h3 className="font-medium text-stone-900">{p.name}</h3>
                        <p className="mt-2 line-clamp-3 text-sm text-stone-600">
                          {p.description}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {view === "ai" && (
          <div>
            <h1 className="mb-2 text-2xl font-semibold tracking-tight">
              AI outfit & jewelry match
            </h1>
            <p className="mb-6 text-stone-600">
              Upload photos of your outfit. You get up to three picks per category (necklaces, earrings, bracelets) with short style notes.
            </p>

            <div className="mb-8 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <label className="block text-sm font-medium text-stone-700">
                Outfit photos
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={onFiles}
                className="mt-2 block w-full text-sm"
              />
              {files.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm text-stone-500">
                    {files.length} photo(s) selected
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {pickerThumbUrls.map((url) => (
                      <img
                        key={url}
                        src={url}
                        alt=""
                        className="h-20 w-20 rounded-lg border border-stone-200 object-cover"
                      />
                    ))}
                  </div>
                </div>
              )}

              <p className="mt-6 text-sm font-medium text-stone-700">
                Include jewelry types
              </p>
              <div className="mt-2 flex flex-wrap gap-4">
                {(["necklace", "earring", "bracelet"] as const).map((c) => (
                  <label
                    key={c}
                    className="flex cursor-pointer items-center gap-2 text-sm capitalize"
                  >
                    <input
                      type="checkbox"
                      checked={cat[c]}
                      onChange={(e) =>
                        setCat((s) => ({ ...s, [c]: e.target.checked }))
                      }
                    />
                    {c}s
                  </label>
                ))}
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={() => void submitAi()}
                className="mt-6 rounded-full bg-violet-600 px-6 py-3 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {loading ? "Analyzing…" : "Get recommendations"}
              </button>
            </div>

            {recErr && (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
                {recErr}
              </div>
            )}

            {result && (
              <div className="space-y-10">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={copyJson}
                    className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm hover:bg-stone-50"
                  >
                    Copy JSON
                  </button>
                </div>

                {result.outfit_analysis.map((oa, idx) => {
                  const ii = oa.image_index ?? idx;
                  const outfitSrc = resultOutfitUrls[ii];
                  return (
                    <section
                      key={`${oa.image_index}-${idx}`}
                      className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
                    >
                      <h2 className="text-lg font-semibold text-stone-900">
                        Outfit {idx + 1}
                        {oa.outfit_description ? ` — ${oa.outfit_description}` : ""}
                      </h2>
                      <div className="mt-4 flex flex-col gap-6 md:flex-row md:items-start">
                        {outfitSrc && (
                          <div className="shrink-0 md:max-w-xs">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
                              Your photo
                            </p>
                            <img
                              src={outfitSrc}
                              alt="Your outfit"
                              className="max-h-80 w-full rounded-xl border border-stone-200 object-cover shadow-sm md:w-72"
                            />
                          </div>
                        )}
                        <div className="min-w-0 flex-1 space-y-8 text-left">
                          {oa.ethnic_jewelry_match === false ? (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-left text-amber-950">
                              <p className="font-medium">No ethnic jewelry suggestions</p>
                              <p className="mt-2 text-sm leading-relaxed opacity-90">
                                {oa.ethnic_match_note ??
                                  "Our catalog is Indian ethnic jewelry. This outfit does not fit that context."}
                              </p>
                            </div>
                          ) : (
                            <>
                              {(["necklace", "earring", "bracelet"] as const).map(
                                (catKey) => {
                                  const rows = oa.rankings_by_category?.[catKey];
                                  if (!rows?.length) return null;
                                  return (
                                    <div key={catKey}>
                                      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
                                        Top picks — {catKey}s
                                      </h3>
                                      <ol className="space-y-4">
                                        {rows
                                          .slice()
                                          .sort((a, b) => a.rank - b.rank)
                                          .map((r) => (
                                            <li
                                              key={`${catKey}-${r.jewelry_id}-${r.rank}`}
                                              className="flex gap-4 border-t border-stone-100 pt-4 first:border-t-0 first:pt-0"
                                            >
                                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-800">
                                                {r.rank}
                                              </span>
                                              <div className="min-w-0 flex-1">
                                                {r.product?.imageUrl && (
                                                  <img
                                                    src={r.product.imageUrl}
                                                    alt=""
                                                    className="mb-3 h-36 w-36 rounded-lg object-cover"
                                                  />
                                                )}
                                                <p className="font-medium text-stone-900">
                                                  {r.product?.name ?? r.jewelry_id}
                                                </p>
                                                <p className="mt-1 text-sm text-stone-600">
                                                  {r.style_note}
                                                </p>
                                              </div>
                                            </li>
                                          ))}
                                      </ol>
                                    </div>
                                  );
                                }
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
