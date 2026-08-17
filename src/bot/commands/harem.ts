import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import { and, eq, desc } from "drizzle-orm";
import { db } from "../../db/client.ts";
import {
  guilds as guildsTable,
  collections,
  characters,
} from "../../db/schema/index.ts";
import {
  buildPaginatedEmbed,
  buildPaginationRow,
  pageSlice,
  totalPages,
} from "../../commands/pagination.ts";
import { logger } from "../../logger/index.ts";

const HAREM_SCOPE = "harem";

interface HaremRow {
  id: string;
  name: string;
  rarity: string;
  sourceUrl: string | null;
  claimedAt: Date;
}

async function loadHaremRows(
  discordGuildId: string,
  userId: string,
): Promise<HaremRow[]> {
  const guildRows = await db
    .select({ id: guildsTable.id })
    .from(guildsTable)
    .where(eq(guildsTable.discordGuildId, discordGuildId))
    .limit(1);
  const internalGuildId = guildRows[0]?.id;
  if (!internalGuildId) return [];

  const rows = await db
    .select({
      id: collections.id,
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
    .orderBy(desc(collections.claimedAt));

  return rows;
}

export const haremCommand = {
  data: new SlashCommandBuilder()
    .setName("harem")
    .setDescription("Show your character collection (paginated)."),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({ content: "Server only.", flags: MessageFlags.Ephemeral });
      return;
    }

    try {
      const rows = await loadHaremRows(interaction.guildId, interaction.user.id);
      const total = rows.length;
      const page = 1;
      const totalPg = totalPages(total);

      const embed = buildPaginatedEmbed({
        title: `💖 Harem ${interaction.user.username}`,
        description: `Collection total: **${total}** characters`,
        rows: pageSlice(rows, page).map((row) => ({
          label: `${row.name}`,
          value: `${row.rarity} • ${row.sourceUrl ? `[AniList](${row.sourceUrl})` : "Unknown"} • <t:${Math.floor(row.claimedAt.getTime() / 1000)}:R>`,
          inline: false,
        })),
        page,
        scope: HAREM_SCOPE,
        authorId: interaction.user.id,
        totalRows: total,
      });

      const row = buildPaginationRow(HAREM_SCOPE, interaction.user.id, page, total);

      if (total === 0) {
        await interaction.reply({
          embeds: [embed],
          components: [],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.reply({
        embeds: [embed],
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
    } catch (err) {
      logger.error({ err, guildId: interaction.guildId, userId: interaction.user.id }, "/harem failed");
      await interaction.reply({ content: "Failed to load your harem.", flags: MessageFlags.Ephemeral });
    }
  },
};