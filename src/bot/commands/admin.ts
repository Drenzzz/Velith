import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../db/client.ts";
import {
  guilds as guildsTable,
  dailyWaifus,
  auditLogs,
} from "../../db/schema/index.ts";
import { pickRandomForGuild } from "../../waifu/spawn.ts";
import { postWaifuEmbed } from "../../waifu/post.ts";
import type { Client } from "discord.js";
import { logger } from "../../logger/index.ts";

async function getInternalGuildId(discordGuildId: string): Promise<string | null> {
  const rows = await db
    .select({ id: guildsTable.id })
    .from(guildsTable)
    .where(eq(guildsTable.discordGuildId, discordGuildId))
    .limit(1);
  return rows[0]?.id ?? null;
}

async function getActiveWaifuForGuild(discordGuildId: string) {
  const internalGuildId = await getInternalGuildId(discordGuildId);
  if (!internalGuildId) return null;
  const rows = await db
    .select({
      id: dailyWaifus.id,
      status: dailyWaifus.status,
    })
    .from(dailyWaifus)
    .where(
      and(
        eq(dailyWaifus.guildId, internalGuildId),
        inArray(dailyWaifus.status, ["ACTIVE", "CLAIMED"]),
      ),
    )
    .orderBy(desc(dailyWaifus.spawnedAt))
    .limit(1);
  return { internalGuildId, active: rows[0] ?? null };
}

async function expireActive(dailyWaifuId: string): Promise<void> {
  await db
    .update(dailyWaifus)
    .set({ status: "EXPIRED" })
    .where(
      and(
        eq(dailyWaifus.id, dailyWaifuId),
        inArray(dailyWaifus.status, ["ACTIVE", "CLAIMED"]),
      ),
    );
}

async function logAudit(
  guildId: string | null,
  userId: string,
  action: "reroll" | "spawn" | "reset",
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      guildId,
      userId,
      action,
      metadata,
    });
  } catch (err) {
    logger.warn({ err, action }, "Audit log insert failed (best-effort)");
  }
}

async function performAdminSpawn(
  interaction: ChatInputCommandInteraction,
  client: Client,
  action: "reroll" | "spawn" | "reset",
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "Server only.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: "Administrator permission required.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const ctx = await getActiveWaifuForGuild(interaction.guildId);
  if (!ctx?.internalGuildId) {
    await interaction.reply({
      content: "Server has not been set up yet. Run /setup first.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const guildConfigRows = await db
    .select({ waifuChannelId: guildsTable.waifuChannelId, cycleDurationHours: guildsTable.cycleDurationHours })
    .from(guildsTable)
    .where(eq(guildsTable.id, ctx.internalGuildId))
    .limit(1);
  const config = guildConfigRows[0];

  if (!config?.waifuChannelId) {
    await interaction.reply({
      content: "Waifu channel has not been set. Run /setup.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (ctx.active) {
    await expireActive(ctx.active.id);
  }

  const choice = await pickRandomForGuild(ctx.internalGuildId);
  if (!choice) {
    await interaction.reply({
      content: "Character pool is empty.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const expiresAt = new Date(Date.now() + config.cycleDurationHours * 60 * 60_000);

  const inserted = await db
    .insert(dailyWaifus)
    .values({
      guildId: ctx.internalGuildId,
      characterId: choice.characterId,
      expiresAt,
      status: "ACTIVE",
    })
    .returning({ id: dailyWaifus.id });
  const newId = inserted[0]?.id;
  if (!newId) throw new Error("Insert returned no id");

  await logAudit(ctx.internalGuildId, interaction.user.id, action, {
    dailyWaifuId: newId,
    characterId: choice.characterId,
    expiredPreviousId: ctx.active?.id ?? null,
  });

  const post = await postWaifuEmbed(client, config.waifuChannelId, choice, expiresAt);

  logger.info(
    {
      guildId: interaction.guildId,
      dailyWaifuId: newId,
      characterName: choice.name,
      action,
      posted: !!post,
    },
    "Admin action executed",
  );

  await interaction.reply({
    content: `Admin action **${action}** done. New character: **${choice.name}** (${choice.rarity}).`,
    flags: MessageFlags.Ephemeral,
  });
}

export const adminRerollCommand = {
  data: new SlashCommandBuilder()
    .setName("admin")
    .setDescription("Admin commands")
    .addSubcommand((sub) =>
      sub.setName("reroll").setDescription("Replace the active character with a new one."),
    )
    .addSubcommand((sub) =>
      sub.setName("spawn").setDescription("Force spawn a new character (mark expired and spawn)."),
    )
    .addSubcommand((sub) =>
      sub.setName("reset").setDescription("Reset the cycle manually: mark expired and spawn a new character."),
    ),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.client) {
      await interaction.reply({ content: "Internal error.", flags: MessageFlags.Ephemeral });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    if (subcommand !== "reroll" && subcommand !== "spawn" && subcommand !== "reset") {
      await interaction.reply({
        content: `Unknown subcommand: ${subcommand}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await performAdminSpawn(interaction, interaction.client, subcommand);
  },
};
