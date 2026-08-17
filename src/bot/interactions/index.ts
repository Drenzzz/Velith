import {
  InteractionType,
  MessageFlags,
  type ButtonInteraction,
  type EmbedBuilder,
  type ActionRowBuilder,
  type ButtonBuilder,
} from "discord.js";
import { and, eq } from "drizzle-orm";
import type { BotEvent } from "../types/discord.ts";
import { db } from "../../db/client.ts";
import {
  guilds as guildsTable,
  dailyWaifus,
  characters,
  characterImages,
  collections,
  claimHistory,
} from "../../db/schema/index.ts";
import { attemptClaim } from "../../claim/service.ts";
import { editMessageToClaimed } from "../../waifu/edit.ts";
import {
  buildPaginatedEmbed,
  buildPaginationRow,
  pageSlice,
} from "../../commands/pagination.ts";
import { logger } from "../../logger/index.ts";

const CLAIM_BUTTON_ID = "waifu:claim";
const PAGINATION_PREFIX = "pagination";
const PAGINATION_SCOPES = new Set(["harem", "leaderboard", "history"]);

interface ActiveWaifuWithDetails {
  dailyWaifuId: string;
  characterId: string;
  expiresAt: Date;
  name: string;
  rarity: string;
  popularity: number;
  sourceUrl: string | null;
  imageUrl: string | null;
}

async function loadActiveWaifuForGuild(
  discordGuildId: string,
): Promise<ActiveWaifuWithDetails | null> {
  const guildRows = await db
    .select({ id: guildsTable.id })
    .from(guildsTable)
    .where(eq(guildsTable.discordGuildId, discordGuildId))
    .limit(1);
  const internalGuildId = guildRows[0]?.id;
  if (!internalGuildId) return null;

  const waifuRows = await db
    .select({
      dailyWaifuId: dailyWaifus.id,
      characterId: dailyWaifus.characterId,
      expiresAt: dailyWaifus.expiresAt,
      name: characters.name,
      rarity: characters.rarity,
      popularity: characters.popularity,
      sourceUrl: characters.sourceUrl,
    })
    .from(dailyWaifus)
    .innerJoin(characters, eq(dailyWaifus.characterId, characters.id))
    .where(
      and(
        eq(dailyWaifus.guildId, internalGuildId),
        eq(dailyWaifus.status, "ACTIVE"),
      ),
    )
    .limit(1);

  const waifu = waifuRows[0];
  if (!waifu) return null;

  const imageRows = await db
    .select({ url: characterImages.url })
    .from(characterImages)
    .where(eq(characterImages.characterId, waifu.characterId))
    .limit(1);

  return {
    dailyWaifuId: waifu.dailyWaifuId,
    characterId: waifu.characterId,
    expiresAt: waifu.expiresAt,
    name: waifu.name,
    rarity: waifu.rarity,
    popularity: waifu.popularity,
    sourceUrl: waifu.sourceUrl,
    imageUrl: imageRows[0]?.url ?? null,
  };
}

export async function handleClaimButton(interaction: ButtonInteraction): Promise<void> {
  if (interaction.customId !== CLAIM_BUTTON_ID) {
    await interaction.reply({
      content: "Unknown button.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!interaction.guildId) {
    await interaction.reply({
      content: "Can only be used in a server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const active = await loadActiveWaifuForGuild(interaction.guildId);
  if (!active) {
    await interaction.reply({
      content: "Active waifu not found or has ended.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const result = await attemptClaim(active.dailyWaifuId, interaction.user.id);

  if (!result) {
    await interaction.reply({
      content: "This character was claimed by someone else first. Try again tomorrow!",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    await editMessageToClaimed(
      interaction.message,
      {
        characterId: active.characterId,
        name: active.name,
        rarity: active.rarity,
        popularity: active.popularity,
        imageUrl: active.imageUrl,
        sourceUrl: active.sourceUrl,
      },
      active.expiresAt,
      interaction.user.id,
    );
  } catch (err) {
    logger.warn(
      { err, messageId: interaction.message.id, dailyWaifuId: result.dailyWaifuId },
      "Embed edit failed (claim still valid)",
    );
  }

  const collectNote = result.collectedToCollection
    ? "Character added to your collection."
    : "You already own this character. The claim is recorded but your collection does not grow.";

  await interaction.reply({
    content: `<@${interaction.user.id}> won **${active.name}**! ${collectNote}`,
    flags: MessageFlags.Ephemeral,
  });
}

interface PaginationTarget {
  embed: EmbedBuilder;
  row: ActionRowBuilder<ButtonBuilder> | null;
}

async function rebuildPagination(
  scope: string,
  discordGuildId: string,
  userId: string,
  page: number,
): Promise<PaginationTarget | null> {
  const guildRows = await db
    .select({ id: guildsTable.id })
    .from(guildsTable)
    .where(eq(guildsTable.discordGuildId, discordGuildId))
    .limit(1);
  const internalGuildId = guildRows[0]?.id;
  if (!internalGuildId) return null;

  if (scope === "harem") {
    const rows = await db
      .select({
        name: characters.name,
        rarity: characters.rarity,
        sourceUrl: characters.sourceUrl,
        claimedAt: collections.claimedAt,
      })
      .from(collections)
      .innerJoin(characters, eq(collections.characterId, characters.id))
      .where(
        and(
          eq(collections.guildId, internalGuildId),
          eq(collections.userId, userId),
        ),
      )
      .orderBy(collections.claimedAt);

    const embed = buildPaginatedEmbed({
      title: `💖 Harem`,
      description: `Collection total: **${rows.length}** characters`,
      rows: pageSlice(rows, page).map((row) => ({
        label: row.name,
        value: `${row.rarity} • ${row.sourceUrl ? `[AniList](${row.sourceUrl})` : "Unknown"}`,
        inline: false,
      })),
      page,
      scope: "harem",
      authorId: userId,
      totalRows: rows.length,
    });

    return {
      embed,
      row: rows.length === 0 ? null : buildPaginationRow("harem", userId, page, rows.length),
    };
  }

  if (scope === "leaderboard") {
    const { sql, desc } = await import("drizzle-orm");
    const rows = await db
      .select({
        userId: collections.userId,
        count: sql<number>`count(*)::int`,
      })
      .from(collections)
      .where(eq(collections.guildId, internalGuildId))
      .groupBy(collections.userId)
      .orderBy(desc(sql`count(*)`));

    const embed = buildPaginatedEmbed({
      title: "🏆 Leaderboard",
      description: "Top collectors by character count.",
      rows: pageSlice(rows, page).map((row, idx) => ({
        label: `#${page * 10 - 10 + idx + 1} <@${row.userId}>`,
        value: `${row.count} characters`,
        inline: false,
      })),
      page,
      scope: "leaderboard",
      authorId: userId,
      totalRows: rows.length,
    });

    return {
      embed,
      row: rows.length === 0 ? null : buildPaginationRow("leaderboard", userId, page, rows.length),
    };
  }

  if (scope === "history") {
    const { desc } = await import("drizzle-orm");
    const rows = await db
      .select({
        userId: claimHistory.userId,
        characterName: characters.name,
        rarity: characters.rarity,
        claimedAt: claimHistory.claimedAt,
      })
      .from(claimHistory)
      .innerJoin(characters, eq(claimHistory.characterId, characters.id))
      .where(eq(claimHistory.guildId, internalGuildId))
      .orderBy(desc(claimHistory.claimedAt));

    const embed = buildPaginatedEmbed({
title: "📜 Claim History",
        description: "Last 10 claims in this server.",
      rows: pageSlice(rows, page).map((row) => ({
        label: row.characterName,
        value: `<@${row.userId}> • ${row.rarity} • <t:${Math.floor(row.claimedAt.getTime() / 1000)}:R>`,
        inline: false,
      })),
      page,
      scope: "history",
      authorId: userId,
      totalRows: rows.length,
    });

    return {
      embed,
      row: rows.length === 0 ? null : buildPaginationRow("history", userId, page, rows.length),
    };
  }

  return null;
}

function parsePaginationCustomIdV2(customId: string): {
  scope: string;
  authorId: string;
  page: number;
  direction: "prev" | "next";
} | null {
  const parts = customId.split(":");
  if (parts.length !== 4) return null;
  const scope = parts[0] ?? "";
  const direction = parts[1] ?? "";
  const authorId = parts[2] ?? "";
  const pageStr = parts[3] ?? "";
  if (direction !== "prev" && direction !== "next") return null;
  if (!PAGINATION_SCOPES.has(scope)) return null;
  const page = parseInt(pageStr, 10);
  if (!Number.isFinite(page) || page < 1) return null;
  return { scope, authorId, page, direction };
}

async function handlePaginationButton(interaction: ButtonInteraction): Promise<void> {
  const parsed = parsePaginationCustomIdV2(interaction.customId);
  if (!parsed) {
    await interaction.reply({
      content: "Invalid pagination button.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.user.id !== parsed.authorId) {
    await interaction.reply({
      content: "This button is not for you.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!interaction.guildId) {
    await interaction.reply({
      content: "Server only.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const target = await rebuildPagination(
    parsed.scope,
    interaction.guildId,
    parsed.authorId,
    parsed.page,
  );
  if (!target) {
    await interaction.reply({
      content: "Data not found.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.update({
    embeds: [target.embed],
    components: target.row ? [target.row] : [],
  });
}

export const interactionRouter: BotEvent<"interactionCreate"> = {
  name: "interactionCreate",
  async execute(interaction) {
    if (interaction.type === InteractionType.MessageComponent && interaction.isButton()) {
      if (interaction.customId === CLAIM_BUTTON_ID) {
        await handleClaimButton(interaction);
        return;
      }
      if (PAGINATION_SCOPES.has(interaction.customId.split(":")[0] ?? "")) {
        await handlePaginationButton(interaction);
        return;
      }
await interaction.reply({
        content: "Unknown button.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.type === InteractionType.ApplicationCommand && interaction.isChatInputCommand()) {
      const { commands } = await import("../commands/index.ts");
      const cmd = commands.get(interaction.commandName);
      if (!cmd) {
        await interaction.reply({
          content: "Command not found.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await cmd.execute(interaction);
      return;
    }
  },
};