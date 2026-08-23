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
  .setDescription("Configure waifu channel/cycle/alerts, or reset config")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption((opt) =>
    opt
      .setName("channel")
      .setDescription("Channel to post daily waifu embeds (omit if using reset)")
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false),
  )
  .addIntegerOption((opt) =>
    opt
      .setName("cycle_duration_hours")
      .setDescription("How long each daily waifu stays (1-168 hours)")
      .setMinValue(1)
      .setMaxValue(168)
      .setRequired(false),
  )
  .addRoleOption((opt) =>
    opt
      .setName("alerts_role")
      .setDescription("Role to ping when a new waifu appears (mentionable required).")
      .setRequired(false),
  )
  .addBooleanOption((opt) =>
    opt
      .setName("reset")
      .setDescription("Clear channel and alerts role. Cycle preserved.")
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

    const channel = interaction.options.getChannel("channel");
    const reset = interaction.options.getBoolean("reset") ?? false;
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
    const role = interaction.options.getRole("alerts_role");
    const shouldUpdateRole = role !== null;
    const newRoleId = role ? role.id : null;

    if (reset) {
      try {
        await db
          .update(guilds)
          .set({
            waifuChannelId: null,
            notificationRoleIds: [],
            updatedAt: new Date(),
          })
          .where(eq(guilds.discordGuildId, interaction.guildId));

        await interaction.reply({
          content:
            "Config cleared. Scheduler will skip this server until you run `/setup channel:#foo` again.",
          flags: MessageFlags.Ephemeral,
        });

        logger.info(
          { guildId: interaction.guildId, userId: interaction.user.id },
          "Setup reset applied",
        );
      } catch (err) {
        logger.error({ err, guildId: interaction.guildId }, "Setup reset failed");
        await interaction.reply({
          content: "Setup reset failed due to an internal error.",
          flags: MessageFlags.Ephemeral,
        });
      }
      return;
    }

    if (!channel) {
      await interaction.reply({
        content: "Provide a channel or pass `reset:true`.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (shouldUpdateRole && role && !role.mentionable) {
      await interaction.reply({
        content: `Role <@&${role.id}> is not mentionable in this server. Enable "Allow anyone to @mention this role" before adding it.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      const existing = await db
        .select({
          id: guilds.id,
          notificationRoleIds: guilds.notificationRoleIds,
        })
        .from(guilds)
        .where(eq(guilds.discordGuildId, interaction.guildId))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(guilds).values({
          discordGuildId: interaction.guildId,
          waifuChannelId: channel.id,
          cycleDurationHours,
          notificationRoleIds: newRoleId ? [newRoleId] : [],
        });
      } else {
        const updateSet: Partial<typeof guilds.$inferInsert> = {
          waifuChannelId: channel.id,
          cycleDurationHours,
          updatedAt: new Date(),
        };
        if (shouldUpdateRole) {
          updateSet.notificationRoleIds = newRoleId ? [newRoleId] : [];
        }
        await db
          .update(guilds)
          .set(updateSet)
          .where(eq(guilds.id, existing[0]!.id));
      }

      const finalRoleIds = shouldUpdateRole
        ? newRoleId
          ? [newRoleId]
          : []
        : existing[0]?.notificationRoleIds ?? [];

      const summary =
        finalRoleIds.length === 0
          ? "Cleared (no alerts role)."
          : `Alerts role: ${finalRoleIds.map((id) => `<@&${id}>`).join(" ")}`;

      await interaction.reply({
        content:
          `Setup complete.\n` +
          `Channel: <#${channel.id}>\n` +
          `Cycle: ${cycleDurationHours} hours\n` +
          `${summary}\n` +
          `(Active waifu is unchanged. Use \`/admin reset\` to start a new cycle).`,
        flags: MessageFlags.Ephemeral,
      });

      logger.info(
        {
          guildId: interaction.guildId,
          channelId: channel.id,
          cycleDurationHours,
          roleIds: finalRoleIds,
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
