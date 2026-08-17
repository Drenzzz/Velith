import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Client } from "discord.js";
import { db } from "../db/client.ts";
import { guilds, dailyWaifus, type DailyWaifu } from "../db/schema/index.ts";
import { pickRandomForGuild, type SpawnChoice } from "../waifu/spawn.ts";
import { postWaifuEmbed } from "../waifu/post.ts";
import { logger } from "../logger/index.ts";

export interface GuildTickResult {
  guildId: string;
  action: "noop" | "expired" | "spawned" | "empty_pool";
  dailyWaifuId?: string;
  characterId?: string;
  messageId?: string;
}

interface ActiveRow {
  id: string;
  characterId: string;
  expiresAt: Date;
  status: DailyWaifu["status"];
}

async function loadActiveForGuild(guildId: string): Promise<ActiveRow | null> {
  const rows = await db
    .select({
      id: dailyWaifus.id,
      characterId: dailyWaifus.characterId,
      expiresAt: dailyWaifus.expiresAt,
      status: dailyWaifus.status,
    })
    .from(dailyWaifus)
    .where(
      and(
        eq(dailyWaifus.guildId, guildId),
        inArray(dailyWaifus.status, ["ACTIVE", "CLAIMED"]),
      ),
    )
    .orderBy(desc(dailyWaifus.spawnedAt))
    .limit(1);
  return rows[0] ?? null;
}

async function markExpired(id: string): Promise<void> {
  await db
    .update(dailyWaifus)
    .set({ status: "EXPIRED" })
    .where(
      and(
        eq(dailyWaifus.id, id),
        inArray(dailyWaifus.status, ["ACTIVE", "CLAIMED"]),
      ),
    );
}

async function insertSpawn(
  guildId: string,
  choice: SpawnChoice,
  expiresAt: Date,
): Promise<string> {
  const inserted = await db
    .insert(dailyWaifus)
    .values({
      guildId,
      characterId: choice.characterId,
      expiresAt,
      status: "ACTIVE",
    })
    .returning({ id: dailyWaifus.id });
  const id = inserted[0]?.id;
  if (!id) throw new Error("Failed to insert daily_waifu");
  return id;
}

async function getGuildConfig(guildId: string): Promise<{
  waifuChannelId: string | null;
  cycleDurationHours: number;
}> {
  const rows = await db
    .select({
      waifuChannelId: guilds.waifuChannelId,
      cycleDurationHours: guilds.cycleDurationHours,
    })
    .from(guilds)
    .where(eq(guilds.id, guildId))
    .limit(1);
  return {
    waifuChannelId: rows[0]?.waifuChannelId ?? null,
    cycleDurationHours: rows[0]?.cycleDurationHours ?? 24,
  };
}

export async function tickOnceForGuild(
  guildId: string,
  client: Client | null = null,
): Promise<GuildTickResult> {
  const active = await loadActiveForGuild(guildId);

  if (active && active.expiresAt.getTime() > Date.now()) {
    return { guildId, action: "noop" };
  }

  if (active) {
    await markExpired(active.id);
    logger.info({ guildId, dailyWaifuId: active.id }, "Marked daily waifu as expired");
  }

  const choice = await pickRandomForGuild(guildId);
  if (!choice) {
    return { guildId, action: "empty_pool" };
  }

  const config = await getGuildConfig(guildId);
  const expiresAt = new Date(Date.now() + config.cycleDurationHours * 60 * 60_000);

  const dailyWaifuId = await insertSpawn(guildId, choice, expiresAt);

  let messageId: string | undefined;
  if (client && config.waifuChannelId) {
    const post = await postWaifuEmbed(client, config.waifuChannelId, choice, expiresAt);
    if (post) {
      messageId = post.messageId;
    }
  }

  logger.info(
    {
      guildId,
      dailyWaifuId,
      characterId: choice.characterId,
      characterName: choice.name,
      posted: !!messageId,
    },
    "Daily waifu spawned",
  );

  return {
    guildId,
    action: "spawned",
    dailyWaifuId,
    characterId: choice.characterId,
    messageId,
  };
}

export async function tickOnceAll(client: Client | null = null): Promise<GuildTickResult[]> {
  const configuredGuilds = await db
    .select({ id: guilds.id })
    .from(guilds)
    .where(sql`${guilds.waifuChannelId} IS NOT NULL`);

  const results: GuildTickResult[] = [];
  for (const g of configuredGuilds) {
    const result = await tickOnceForGuild(g.id, client);
    results.push(result);
  }

  logger.info(
    {
      guildsProcessed: results.length,
      spawned: results.filter((r) => r.action === "spawned").length,
      noop: results.filter((r) => r.action === "noop").length,
      empty: results.filter((r) => r.action === "empty_pool").length,
    },
    "Scheduler tick complete",
  );

  return results;
}

if (import.meta.main) {
  try {
    const results = await tickOnceAll();
    console.log(JSON.stringify(results, null, 2));
  } catch (err) {
    logger.fatal({ err }, "Tick failed");
    process.exitCode = 1;
  }
}
