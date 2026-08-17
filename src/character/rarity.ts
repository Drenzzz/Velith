import type { Rarity } from "../db/schema/characters.ts";

export function popularityFavoritesToTier(favorites: number): Rarity {
  if (favorites > 100_000) return "Legendary";
  if (favorites >= 50_000) return "Epic";
  if (favorites >= 10_000) return "Rare";
  if (favorites >= 1_000) return "Uncommon";
  return "Common";
}

if (import.meta.main) {
  const samples = [0, 999, 5000, 30_000, 80_000, 150_000];
  for (const n of samples) {
    console.log(JSON.stringify({ favorites: n, tier: popularityFavoritesToTier(n) }));
  }
}