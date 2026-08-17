import { db, closeDb } from "../src/db/client.ts";
import {
  guilds,
  characters,
  dailyWaifus,
  collections,
  claimHistory,
  auditLogs,
} from "../src/db/schema/index.ts";
import { eq } from "drizzle-orm";
import { attemptClaim } from "../src/claim/service.ts";
import { logger } from "../src/logger/index.ts";

const TEST_GUILD_DISCORD_ID = `stress-${Date.now()}`;
const TEST_CHARACTER_ANILIST_ID = 999_000_000 + Math.floor(Math.random() * 1000);
const NUM_CONCURRENT = 10;

async function setupFixtures(): Promise<{
  internalGuildId: string;
  characterId: string;
  dailyWaifuId: string;
}> {
  const insertedGuild = await db
    .insert(guilds)
    .values({ discordGuildId: TEST_GUILD_DISCORD_ID })
    .returning({ id: guilds.id });
  const internalGuildId = insertedGuild[0]?.id;
  if (!internalGuildId) throw new Error("Failed to insert guild");

  const insertedChar = await db
    .insert(characters)
    .values({
      anilistId: TEST_CHARACTER_ANILIST_ID,
      name: `Stress Test ${TEST_CHARACTER_ANILIST_ID}`,
      rarity: "Common",
    })
    .returning({ id: characters.id });
  const characterId = insertedChar[0]?.id;
  if (!characterId) throw new Error("Failed to insert character");

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  const insertedWaifu = await db
    .insert(dailyWaifus)
    .values({
      guildId: internalGuildId,
      characterId,
      expiresAt,
      status: "ACTIVE",
    })
    .returning({ id: dailyWaifus.id });
  const dailyWaifuId = insertedWaifu[0]?.id;
  if (!dailyWaifuId) throw new Error("Failed to insert daily_waifu");

  return { internalGuildId, characterId, dailyWaifuId };
}

async function cleanupFixtures(internalGuildId: string, characterId: string): Promise<void> {
  await db.delete(auditLogs).where(eq(auditLogs.guildId, internalGuildId));
  await db.delete(claimHistory).where(eq(claimHistory.guildId, internalGuildId));
  await db.delete(collections).where(eq(collections.guildId, internalGuildId));
  await db.delete(dailyWaifus).where(eq(dailyWaifus.guildId, internalGuildId));
  await db.delete(characters).where(eq(characters.id, characterId));
  await db.delete(guilds).where(eq(guilds.id, internalGuildId));
}

async function runStress(): Promise<void> {
  const { internalGuildId, characterId, dailyWaifuId } = await setupFixtures();
  logger.info({ dailyWaifuId }, "Fixtures inserted");

  const userIds = Array.from(
    { length: NUM_CONCURRENT },
    (_, i: number) => `stress-user-${i}-${Date.now()}`,
  );

  const results = await Promise.all(
    userIds.map((userId) => attemptClaim(dailyWaifuId, userId)),
  );

  const successes = results.filter((r) => r !== null);
  const rejects = results.filter((r) => r === null);

  console.log(JSON.stringify({
    totalClaims: NUM_CONCURRENT,
    successes: successes.length,
    rejected: rejects.length,
    successUserId: successes[0]?.userId ?? null,
    passed: successes.length === 1 && rejects.length === NUM_CONCURRENT - 1,
  }, null, 2));

  const collectionsCount = await db
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.guildId, internalGuildId));

  const historyCount = await db
    .select({ id: claimHistory.id })
    .from(claimHistory)
    .where(eq(claimHistory.guildId, internalGuildId));

  console.log(JSON.stringify({
    collectionsInserted: collectionsCount.length,
    historyRowsInserted: historyCount.length,
    collectionsExpected: 1,
    historyExpected: 1,
  }, null, 2));

  await cleanupFixtures(internalGuildId, characterId);
}

await runStress()
  .catch((err) => {
    logger.fatal({ err }, "Stress test failed");
    process.exitCode = 1;
  })
  .finally(() => closeDb());