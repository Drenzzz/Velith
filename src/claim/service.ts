import { eq, and, isNull, gt } from "drizzle-orm";
import { db } from "../db/client.ts";
import {
  dailyWaifus,
  collections,
  claimHistory,
  auditLogs,
} from "../db/schema/index.ts";
import { logger } from "../logger/index.ts";

export type ClaimOutcome =
  | "success"
  | "already_claimed"
  | "expired"
  | "not_found"
  | "duplicate_collection";

export interface ClaimResult {
  outcome: ClaimOutcome;
  dailyWaifuId: string;
  guildId: string;
  characterId: string;
  userId: string;
  collectedToCollection: boolean;
}

const PG_UNIQUE_VIOLATION = "23505";

export async function attemptClaim(
  dailyWaifuId: string,
  userId: string,
): Promise<ClaimResult | null> {
  const claimed = await db
    .update(dailyWaifus)
    .set({
      status: "CLAIMED",
      claimedBy: userId,
      claimedAt: new Date(),
    })
    .where(
      and(
        eq(dailyWaifus.id, dailyWaifuId),
        eq(dailyWaifus.status, "ACTIVE"),
        isNull(dailyWaifus.claimedBy),
        gt(dailyWaifus.expiresAt, new Date()),
      ),
    )
    .returning({
      id: dailyWaifus.id,
      guildId: dailyWaifus.guildId,
      characterId: dailyWaifus.characterId,
    });

  const row = claimed[0];
  if (!row) {
    logger.warn({ dailyWaifuId, userId }, "Claim rejected (already claimed/expired/missing)");
    return null;
  }

  let collected = false;
  let duplicateNotice = false;

  try {
    await db.insert(collections).values({
      guildId: row.guildId,
      userId,
      characterId: row.characterId,
      dailyWaifuId: row.id,
    });
    collected = true;
  } catch (err) {
    if ((err as { code?: string }).code === PG_UNIQUE_VIOLATION) {
      duplicateNotice = true;
      logger.info(
        { dailyWaifuId: row.id, userId, characterId: row.characterId },
        "User already owns this character. Collection skipped, claim still valid",
      );
    } else {
      logger.error({ err, dailyWaifuId: row.id, userId }, "Collection insert failed");
      throw err;
    }
  }

  try {
    await db.insert(claimHistory).values({
      guildId: row.guildId,
      dailyWaifuId: row.id,
      characterId: row.characterId,
      userId,
    });
  } catch (err) {
    logger.error({ err, dailyWaifuId: row.id, userId }, "Claim history insert failed");
    throw err;
  }

  try {
    await db.insert(auditLogs).values({
      guildId: row.guildId,
      userId,
      action: "claim",
      metadata: {
        dailyWaifuId: row.id,
        characterId: row.characterId,
        collectedToCollection: collected,
      },
    });
  } catch (err) {
    logger.warn({ err, dailyWaifuId: row.id }, "Audit log insert failed (best-effort)");
  }

  logger.info(
    {
      dailyWaifuId: row.id,
      userId,
      characterId: row.characterId,
      collectedToCollection: collected,
    },
    "Claim successful",
  );

  const outcome: ClaimOutcome = duplicateNotice ? "duplicate_collection" : "success";

  return {
    outcome,
    dailyWaifuId: row.id,
    guildId: row.guildId,
    characterId: row.characterId,
    userId,
    collectedToCollection: collected,
  };
}

if (import.meta.main) {
  const sampleDailyWaifuId = "00000000-0000-0000-0000-000000000000";
  try {
    const result = await attemptClaim(sampleDailyWaifuId, "test-user-id");
    console.log(JSON.stringify({ result }));
  } catch (err) {
    logger.error({ err }, "Sample claim failed");
    process.exitCode = 1;
  }
}