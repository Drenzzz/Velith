import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  ChannelType,
  MessageFlags,
} from "discord.js";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client.ts";
import { guilds } from "../../db/schema/index.ts";
import { logger } from "../../logger/index.ts";

const cycleHoursSchema = z.number().int().min(1).max(168);

const setupCommandData = new SlashCommandBuilder()
  .setName("setup")
  .setDescription("Configure the daily waifu channel and cycle duration")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption((opt) =>
    opt
      .setName("channel")
      .setDescription("Channel to post daily waifu embeds")
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true),
  )
  .addIntegerOption((opt) =>
    opt
      .setName("cycle_duration_hours")
      .setDescription("How long each daily waifu stays (1-168 hours)")
      .setMinValue(1)
      .setMaxValue(168)
      .setRequired(false),
  );

export const setupCommand = {
  data: setupCommandData,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({
        content: "Setup can only be used inside a server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: "You need the Administrator permission to run this command.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const channel = interaction.options.getChannel("channel", true);
    const rawHours = interaction.options.getInteger("cycle_duration_hours");
    const hoursParsed = cycleHoursSchema.safeParse(rawHours ?? 24);

    if (!hoursParsed.success) {
      await interaction.reply({
        content: "cycle_duration_hours must be between 1 and 168.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const cycleDurationHours = hoursParsed.data;

    try {
      const existing = await db
        .select({ id: guilds.id })
        .from(guilds)
        .where(eq(guilds.discordGuildId, interaction.guildId))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(guilds).values({
          discordGuildId: interaction.guildId,
          waifuChannelId: channel.id,
          cycleDurationHours,
        });
      } else {
        await db
          .update(guilds)
          .set({
            waifuChannelId: channel.id,
            cycleDurationHours,
            updatedAt: new Date(),
          })
          .where(eq(guilds.id, existing[0]!.id));
      }

      await interaction.reply({
        content:
          `Setup complete.\n` +
          `Channel: <#${channel.id}>\n` +
          `Cycle: ${cycleDurationHours} hours\n` +
          `(Active waifu is unchanged. Use \`/admin reset\` to start a new cycle).`,
        flags: MessageFlags.Ephemeral,
      });

      logger.info(
        {
          guildId: interaction.guildId,
          channelId: channel.id,
          cycleDurationHours,
          userId: interaction.user.id,
        },
        "Setup applied",
      );
    } catch (err) {
      logger.error({ err, guildId: interaction.guildId }, "Setup failed");
      await interaction.reply({
        content: "Setup failed due to an internal error.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};