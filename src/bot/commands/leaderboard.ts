import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from "discord.js";
import { sql, eq, desc } from "drizzle-orm";
import { db } from "../../db/client.ts";
import {
  guilds as guildsTable,
  collections,
} from "../../db/schema/index.ts";
import {
  buildPaginatedEmbed,
  buildPaginationRow,
  pageSlice,
} from "../../commands/pagination.ts";
import { resolveDisplayNames } from "../display-name.ts";
import { logger } from "../../logger/index.ts";

const LEADERBOARD_SCOPE = "leaderboard";

interface LeaderRow {
  userId: string;
  count: number;
}

async function loadLeaderboard(discordGuildId: string): Promise<LeaderRow[]> {
  const guildRows = await db
    .select({ id: guildsTable.id })
    .from(guildsTable)
    .where(eq(guildsTable.discordGuildId, discordGuildId))
    .limit(1);
  const internalGuildId = guildRows[0]?.id;
  if (!internalGuildId) return [];

  const rows = await db
    .select({
      userId: collections.userId,
      count: sql<number>`count(*)::int`,
    })
    .from(collections)
    .where(eq(collections.guildId, internalGuildId))
    .groupBy(collections.userId)
    .orderBy(desc(sql`count(*)`));

  return rows;
}

export const leaderboardCommand = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Rank users by character count (paginated)."),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guild = interaction.guild;
    if (!interaction.guildId || !guild) {
      await interaction.reply({ content: "Server only.", flags: MessageFlags.Ephemeral });
      return;
    }

    try {
      const rows = await loadLeaderboard(interaction.guildId);
      const total = rows.length;
      const page = 1;
      const pageRows = pageSlice(rows, page);
      const displayNames = await resolveDisplayNames(guild, pageRows.map((row) => row.userId));

      const embed = buildPaginatedEmbed({
        title: "🏆 Leaderboard",
        description: "Top collectors by character count.",
        rows: pageRows.map((row, idx) => ({
          label: `#${page * 10 - 10 + idx + 1} ${displayNames.get(row.userId) ?? "Unknown user"}`,
          value: `${row.count} characters`,
          inline: false,
        })),
        page,
        scope: LEADERBOARD_SCOPE,
        authorId: interaction.user.id,
        totalRows: total,
      });

      const components = total === 0
        ? []
        : [buildPaginationRow(LEADERBOARD_SCOPE, interaction.user.id, page, total)];

      await interaction.reply({
        embeds: [embed],
        components,
        flags: MessageFlags.Ephemeral,
      });
    } catch (err) {
      logger.error({ err, guildId: interaction.guildId }, "/leaderboard failed");
      await interaction.reply({ content: "Failed to load leaderboard.", flags: MessageFlags.Ephemeral });
    }
  },
};
