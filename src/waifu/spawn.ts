import { sql, notInArray, desc, eq, and } from "drizzle-orm";
import { db, closeDb } from "../db/client.ts";
import { characters, characterImages, dailyWaifus } from "../db/schema/index.ts";
import { logger } from "../logger/index.ts";

const COOLDOWN_WINDOW = 30;

export interface SpawnChoice {
  characterId: string;
  name: string;
  rarity: string;
  popularity: number;
  imageUrl: string | null;
  sourceUrl: string | null;
}

interface CharacterRow {
  id: string;
  name: string;
  rarity: string;
  popularity: number;
}

async function getCooldownCharacterIds(guildId: string): Promise<string[]> {
  const rows = await db
    .select({ characterId: dailyWaifus.characterId })
    .from(dailyWaifus)
    .where(eq(dailyWaifus.guildId, guildId))
    .orderBy(desc(dailyWaifus.spawnedAt))
    .limit(COOLDOWN_WINDOW);
  return rows.map((r) => r.characterId);
}

async function pickFromEligible(
  excludeIds: readonly string[],
): Promise<CharacterRow | null> {
  const where = excludeIds.length === 0
    ? undefined
    : notInArray(characters.id, excludeIds as string[]);

  const baseQuery = db
    .select({
      id: characters.id,
      name: characters.name,
      rarity: characters.rarity,
      popularity: characters.popularity,
    })
    .from(characters)
    .orderBy(sql`RANDOM()`)
    .limit(1);

  const rows = where ? await baseQuery.where(where) : await baseQuery;
  return rows[0] ?? null;
}

async function fetchAnyCharacter(): Promise<CharacterRow | null> {
  const rows = await db
    .select({
      id: characters.id,
      name: characters.name,
      rarity: characters.rarity,
      popularity: characters.popularity,
    })
    .from(characters)
    .orderBy(sql`RANDOM()`)
    .limit(1);
  return rows[0] ?? null;
}

async function fetchPrimaryImage(characterId: string): Promise<string | null> {
  const rows = await db
    .select({ url: characterImages.url })
    .from(characterImages)
    .where(and(
      eq(characterImages.characterId, characterId),
      eq(characterImages.isPrimary, true),
    ))
    .limit(1);
  return rows[0]?.url ?? null;
}

export async function pickRandomForGuild(guildId: string): Promise<SpawnChoice | null> {
  const cooldownIds = await getCooldownCharacterIds(guildId);
  let chosen = await pickFromEligible(cooldownIds);

  if (!chosen) {
    logger.warn(
      { guildId, cooldownCount: cooldownIds.length },
      "Eligible pool empty; falling back to any character",
    );
    chosen = await fetchAnyCharacter();
  }

  if (!chosen) {
    logger.error({ guildId }, "No characters in pool at all");
    return null;
  }

  const [imageUrl, sourceRow] = await Promise.all([
    fetchPrimaryImage(chosen.id),
    db
      .select({ sourceUrl: characters.sourceUrl })
      .from(characters)
      .where(eq(characters.id, chosen.id))
      .limit(1),
  ]);

  return {
    characterId: chosen.id,
    name: chosen.name,
    rarity: chosen.rarity,
    popularity: chosen.popularity,
    imageUrl,
    sourceUrl: sourceRow[0]?.sourceUrl ?? null,
  };
}

if (import.meta.main) {
  const testGuildId = "00000000-0000-0000-0000-000000000000";
  try {
    const choice = await pickRandomForGuild(testGuildId);
    console.log(JSON.stringify({ choice }));
  } catch (err) {
    logger.error({ err }, "Spawn test failed");
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}