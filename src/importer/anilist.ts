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

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 8_000;

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

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

function delayMs(attempt: number): number {
  const exponential = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
  const jitter = Math.floor(Math.random() * 500);
  return exponential + jitter;
}

async function attemptFetch(
  page: number,
  perPage: number,
): Promise<Response> {
  return await fetch(env.ANILIST_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      query: ANILIST_QUERY,
      variables: { page, perPage },
    }),
  });
}

export async function fetchCharacters(
  page: number,
  perPage = 100,
): Promise<NormalizedCharacter[]> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await attemptFetch(page, perPage);
    } catch (err) {
      lastError = err as Error;
      logger.warn({ attempt, err: lastError.message }, "AniList fetch network error, will retry");
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, delayMs(attempt)));
        continue;
      }
      break;
    }

    if (!res.ok && isRetryableStatus(res.status) && attempt < MAX_ATTEMPTS) {
      logger.warn({ attempt, status: res.status }, "AniList returned retryable status, will retry");
      await new Promise((resolve) => setTimeout(resolve, delayMs(attempt)));
      continue;
    }

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

  throw new Error(
    `AniList API failed after ${MAX_ATTEMPTS} attempts: ${lastError?.message ?? "unknown error"}`,
  );
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