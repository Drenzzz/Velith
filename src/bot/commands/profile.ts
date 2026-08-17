import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db/client.ts";
import {
  guilds as guildsTable,
  collections,
  characters,
  claimHistory,
} from "../../db/schema/index.ts";
import { logger } from "../../logger/index.ts";

const rarityRank: Record<string, number> = {
  Common: 1,
  Uncommon: 2,
  Rare: 3,
  Epic: 4,
  Legendary: 5,
};

async function getInternalGuildId(discordGuildId: string): Promise<string | null> {
  const rows = await db
    .select({ id: guildsTable.id })
    .from(guildsTable)
    .where(eq(guildsTable.discordGuildId, discordGuildId))
    .limit(1);
  return rows[0]?.id ?? null;
}

export const profileCommand = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Show your collection statistics."),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({ content: "Server only.", flags: MessageFlags.Ephemeral });
      return;
    }

    try {
      const internalGuildId = await getInternalGuildId(interaction.guildId);
      if (!internalGuildId) {
        await interaction.reply({
          content: "Server has not been set up yet. Run /setup first.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const collectionRows = await db
        .select({
          rarity: characters.rarity,
        })
        .from(collections)
        .innerJoin(characters, eq(collections.characterId, characters.id))
        .where(
          and(
            eq(collections.guildId, internalGuildId),
            eq(collections.userId, interaction.user.id),
          ),
        );

      const totalClaimsRows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(claimHistory)
        .where(
          and(
            eq(claimHistory.guildId, internalGuildId),
            eq(claimHistory.userId, interaction.user.id),
          ),
        );

      const total = collectionRows.length;
      const totalClaims = totalClaimsRows[0]?.count ?? 0;

      const rarityCount: Record<string, number> = {};
      let topRarity = "Common";
      let topRank = 0;
      for (const c of collectionRows) {
        rarityCount[c.rarity] = (rarityCount[c.rarity] ?? 0) + 1;
        const rank = rarityRank[c.rarity] ?? 0;
        if (rank > topRank) {
          topRank = rank;
          topRarity = c.rarity;
        }
      }

      const breakdown = ["Legendary", "Epic", "Rare", "Uncommon", "Common"]
        .filter((r) => rarityCount[r])
        .map((r) => `${r}: ${rarityCount[r]}`)
        .join(" • ");

      const embed = new EmbedBuilder()
        .setTitle(`📊 Profile ${interaction.user.username}`)
        .setColor(0x3498db)
        .addFields(
          { name: "Collection", value: `${total}`, inline: true },
          { name: "Total claims", value: `${totalClaims}`, inline: true },
          { name: "Top rarity", value: topRarity, inline: true },
          { name: "Breakdown", value: breakdown || "(empty)", inline: false },
        );

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } catch (err) {
      logger.error({ err, guildId: interaction.guildId, userId: interaction.user.id }, "/profile failed");
      await interaction.reply({ content: "Failed to load profile.", flags: MessageFlags.Ephemeral });
    }
  },
};