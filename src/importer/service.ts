import { eq } from "drizzle-orm";
import { db, closeDb } from "../db/client.ts";
import { characters, characterImages } from "../db/schema/index.ts";
import { logger } from "../logger/index.ts";
import type { NormalizedCharacter } from "./anilist.ts";

export interface UpsertResult {
  characterId: string;
  inserted: boolean;
}

export async function upsertCharacter(
  char: NormalizedCharacter,
): Promise<UpsertResult> {
  const inserted = await db
    .insert(characters)
    .values({
      anilistId: char.anilistId,
      name: char.name,
      nativeName: char.nativeName,
      description: char.description,
      gender: char.gender,
      rarity: char.rarity,
      popularity: char.popularity,
      sourceUrl: char.sourceUrl,
    })
    .onConflictDoUpdate({
      target: characters.anilistId,
      set: {
        name: char.name,
        nativeName: char.nativeName,
        description: char.description,
        gender: char.gender,
        rarity: char.rarity,
        popularity: char.popularity,
        sourceUrl: char.sourceUrl,
        updatedAt: new Date(),
      },
    })
    .returning({ id: characters.id });

  const characterId = inserted[0]?.id;
  if (!characterId) {
    throw new Error(`Upsert returned no id for anilist ${char.anilistId}`);
  }

  if (char.imageUrl) {
    const existingImage = await db
      .select({ id: characterImages.id })
      .from(characterImages)
      .where(eq(characterImages.characterId, characterId))
      .limit(1);

    if (existingImage.length === 0) {
      await db.insert(characterImages).values({
        characterId,
        url: char.imageUrl,
        source: "anilist",
        isPrimary: true,
      });
    }
  }

  return { characterId, inserted: inserted.length > 0 };
}

if (import.meta.main) {
  const sample: NormalizedCharacter = {
    anilistId: 99999999,
    name: "Test Sample",
    nativeName: null,
    description: "Round-trip test",
    gender: "Female",
    popularity: 0,
    rarity: "Common",
    sourceUrl: null,
    imageUrl: null,
  };

  try {
    const result = await upsertCharacter(sample);
    logger.info({ result }, "Sample upsert OK");

  } catch (err) {
    logger.error({ err }, "Sample upsert failed");
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}