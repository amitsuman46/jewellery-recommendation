export type JewelryCategory = "necklace" | "earring" | "bracelet";

export interface JewelryItem {
  id: string;
  name: string;
  category: JewelryCategory;
  description: string;
  imageUrl: string;
  imageUrls: string[];
  productPageUrl?: string;
  price?: string | number;
  currency?: string;
}

export interface RankingRow {
  rank: number;
  jewelry_id: string;
  style_note: string;
}

/** Up to 3 picks per category for each outfit image. */
export interface OutfitAnalysis {
  image_index: number;
  outfit_description: string;
  /**
   * False when the outfit is western / not suited to Indian ethnic jewelry.
   * When false, `rankings_by_category` must be empty. Omitted treated as true until set.
   */
  ethnic_jewelry_match?: boolean;
  /** Why we did or did not recommend (especially when match is false). */
  ethnic_match_note?: string;
  rankings_by_category: Partial<Record<JewelryCategory, RankingRow[]>>;
}

export interface RecommendResponse {
  outfit_analysis: OutfitAnalysis[];
}
