import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/client.ts";
import { guilds, dailyWaifus, characters, characterImages } from "../../db/schema/index.ts";
import { buildActiveEmbed } from "../../waifu/embed.ts";
import { logger } from "../../logger/index.ts";

interface ActiveRow {
  dailyWaifuId: string;
  expiresAt: Date;
  characterId: string;
  name: string;
  rarity: string;
  popularity: number;
  sourceUrl: string | null;
  imageUrl: string | null;
}

async function loadActiveForGuild(discordGuildId: string): Promise<ActiveRow | null> {
  const rows = await db
    .select({
      dailyWaifuId: dailyWaifus.id,
      expiresAt: dailyWaifus.expiresAt,
      characterId: dailyWaifus.characterId,
      name: characters.name,
      rarity: characters.rarity,
      popularity: characters.popularity,
      sourceUrl: characters.sourceUrl,
    })
    .from(dailyWaifus)
    .innerJoin(guilds, eq(dailyWaifus.guildId, guilds.id))
    .innerJoin(characters, eq(dailyWaifus.characterId, characters.id))
    .where(
      and(
        eq(guilds.discordGuildId, discordGuildId),
        eq(dailyWaifus.status, "ACTIVE"),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const imageRows = await db
    .select({ url: characterImages.url })
    .from(characterImages)
    .where(eq(characterImages.characterId, row.characterId))
    .limit(1);

  return {
    dailyWaifuId: row.dailyWaifuId,
    expiresAt: row.expiresAt,
    characterId: row.characterId,
    name: row.name,
    rarity: row.rarity,
    popularity: row.popularity,
    sourceUrl: row.sourceUrl,
    imageUrl: imageRows[0]?.url ?? null,
  };
}

export const waifuCommand = {
  data: new SlashCommandBuilder()
    .setName("waifu")
    .setDescription("Show the active Waifu of the Day."),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({
        content: "This command can only be used inside a server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      const active = await loadActiveForGuild(interaction.guildId);

      if (!active) {
        await interaction.reply({
          content: "No active waifu yet. The scheduler tick will spawn one within 1 minute.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (active.expiresAt.getTime() <= Date.now()) {
        await interaction.reply({
          content: "Active waifu has expired. Waiting for the next scheduler tick.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const embed = buildActiveEmbed({
        choice: {
          characterId: active.characterId,
          name: active.name,
          rarity: active.rarity,
          popularity: active.popularity,
          imageUrl: active.imageUrl,
          sourceUrl: active.sourceUrl,
        },
        expiresAt: active.expiresAt,
      });

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      logger.error({ err, guildId: interaction.guildId }, "/waifu failed");
      await interaction.reply({
        content: "Failed to load the active waifu.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};