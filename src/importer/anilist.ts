import { env } from "../config/env.ts";
import { logger } from "../logger/index.ts";
import { popularityFavoritesToTier } from "../character/rarity.ts";
import type { Rarity } from "../db/schema/characters.ts";

const ANILIST_QUERY = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      characters(sort: FAVOURITES_DESC) {
        id
        name { full native }
        description(asHtml: false)
        gender
        favourites
        image { large medium }
        siteUrl
      }
    }
  }
`;

interface AniListRawCharacter {
  id: number;
  name: { full: string | null; native: string | null };
  description: string | null;
  gender: string | null;
  favourites: number;
  image: { large: string | null; medium: string | null } | null;
  siteUrl: string | null;
}

interface AniListResponse {
  data?: { Page: { characters: AniListRawCharacter[] } };
  errors?: Array<{ message: string }>;
}

export interface NormalizedCharacter {
  anilistId: number;
  name: string;
  nativeName: string | null;
  description: string | null;
  gender: string | null;
  popularity: number;
  rarity: Rarity;
  sourceUrl: string | null;
  imageUrl: string | null;
}

export function normalize(raw: AniListRawCharacter): NormalizedCharacter {
  const imageUrl = raw.image?.large ?? raw.image?.medium ?? null;
  return {
    anilistId: raw.id,
    name: raw.name.full?.trim() || `Character ${raw.id}`,
    nativeName: raw.name.native ?? null,
    description: raw.description ?? null,
    gender: raw.gender ?? null,
    popularity: raw.favourites,
    rarity: popularityFavoritesToTier(raw.favourites),
    sourceUrl: raw.siteUrl ?? null,
    imageUrl,
  };
}

export async function fetchCharacters(
  page: number,
  perPage = 100,
): Promise<NormalizedCharacter[]> {
  const res = await fetch(env.ANILIST_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      query: ANILIST_QUERY,
      variables: { page, perPage },
    }),
  });

  if (!res.ok) {
    throw new Error(`AniList HTTP ${res.status}: ${res.statusText}`);
  }

  const json = (await res.json()) as AniListResponse;
  if (json.errors?.length) {
    throw new Error(`AniList GraphQL error: ${json.errors.map((e) => e.message).join("; ")}`);
  }

  const raws = json.data?.Page.characters ?? [];
  return raws.map(normalize);
}

if (import.meta.main) {
  try {
    const chars = await fetchCharacters(1, 5);
    logger.info({ count: chars.length, sample: chars[0] }, "AniList sample fetched");
  } catch (err) {
    logger.error({ err }, "AniList fetch failed");
    process.exit(1);
  }
}