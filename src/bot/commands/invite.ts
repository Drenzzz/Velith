import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionsBitField,
  SlashCommandBuilder,
} from "discord.js";
import { env } from "../../config/env.ts";

const invitePermissions = new PermissionsBitField([
  PermissionsBitField.Flags.ViewChannel,
  PermissionsBitField.Flags.SendMessages,
  PermissionsBitField.Flags.EmbedLinks,
  PermissionsBitField.Flags.ReadMessageHistory,
]);

const inviteUrl = new URL("https://discord.com/oauth2/authorize");
inviteUrl.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
inviteUrl.searchParams.set("scope", "bot applications.commands");
inviteUrl.searchParams.set("permissions", invitePermissions.bitfield.toString());

export const inviteCommand = {
  data: new SlashCommandBuilder()
    .setName("invite")
    .setDescription("Generate a link to add Velith to another server."),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.reply({
      content: `Add Velith to another server: ${inviteUrl.toString()}`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
