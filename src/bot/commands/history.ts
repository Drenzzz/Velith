import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import { eq, desc } from "drizzle-orm";
import { db } from "../../db/client.ts";
import {
  guilds as guildsTable,
  claimHistory,
  characters,
} from "../../db/schema/index.ts";
import {
  buildPaginatedEmbed,
  buildPaginationRow,
  pageSlice,
} from "../../commands/pagination.ts";
import { logger } from "../../logger/index.ts";

const HISTORY_SCOPE = "history";

interface HistoryRow {
  userId: string;
  characterName: string;
  rarity: string;
  claimedAt: Date;
}

async function loadHistory(discordGuildId: string): Promise<HistoryRow[]> {
  const guildRows = await db
    .select({ id: guildsTable.id })
    .from(guildsTable)
    .where(eq(guildsTable.discordGuildId, discordGuildId))
    .limit(1);
  const internalGuildId = guildRows[0]?.id;
  if (!internalGuildId) return [];

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

  return rows;
}

export const historyCommand = {
  data: new SlashCommandBuilder()
    .setName("history")
    .setDescription("Riwayat klaim daily waifu (paginated)."),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({ content: "Hanya untuk server.", flags: MessageFlags.Ephemeral });
      return;
    }

    try {
      const rows = await loadHistory(interaction.guildId);
      const total = rows.length;
      const page = 1;

      const embed = buildPaginatedEmbed({
        title: "📜 History Klaim",
        description: "10 klaim terakhir di server ini.",
        rows: pageSlice(rows, page).map((row) => ({
          label: `${row.characterName}`,
          value: `<@${row.userId}> • ${row.rarity} • <t:${Math.floor(row.claimedAt.getTime() / 1000)}:R>`,
          inline: false,
        })),
        page,
        scope: HISTORY_SCOPE,
        authorId: interaction.user.id,
        totalRows: total,
      });

      const components = total === 0
        ? []
        : [buildPaginationRow(HISTORY_SCOPE, interaction.user.id, page, total)];

      await interaction.reply({
        embeds: [embed],
        components,
        flags: MessageFlags.Ephemeral,
      });
    } catch (err) {
      logger.error({ err, guildId: interaction.guildId }, "/history failed");
      await interaction.reply({ content: "Gagal memuat history.", flags: MessageFlags.Ephemeral });
    }
  },
};