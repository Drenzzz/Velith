import { sql } from "drizzle-orm";
import { db, closeDb } from "../src/db/client.ts";
import { characters, characterImages } from "../src/db/schema/index.ts";
import { logger } from "../src/logger/index.ts";

const NON_FEMALE = sql`LOWER(${characters.gender}) != 'female' OR ${characters.gender} IS NULL`;

async function countAffected(): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(characters)
    .where(NON_FEMALE);
  return result[0]?.count ?? 0;
}

async function countImagesForDeletion(): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(characterImages)
    .innerJoin(characters, sql`${characterImages.characterId} = ${characters.id}`)
    .where(NON_FEMALE);
  return result[0]?.count ?? 0;
}

async function runApply(): Promise<void> {
  const characterCount = await countAffected();
  const imageCount = await countImagesForDeletion();

  if (characterCount === 0) {
    logger.info("No non-female characters found, nothing to delete");
    return;
  }

  logger.warn(
    { characterCount, imageCount },
    "Deleting non-female characters (FK cascade will remove their images)",
  );

  const deleted = await db
    .delete(characters)
    .where(NON_FEMALE)
    .returning({ id: characters.id });

  logger.info(
    { deletedCount: deleted.length, expectedImageCleanup: imageCount },
    "Cleanup complete",
  );
}

async function runDryRun(): Promise<void> {
  const characterCount = await countAffected();
  const imageCount = await countImagesForDeletion();
  console.log(JSON.stringify({
    mode: "dry-run",
    charactersToDelete: characterCount,
    imagesToDeleteViaCascade: imageCount,
    message: "Re-run with --apply to perform deletion",
  }));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");

  try {
    if (apply) {
      await runApply();
    } else {
      await runDryRun();
    }
  } catch (err) {
    logger.fatal({ err }, "Cleanup aborted");
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}

await main();