import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { BotEvent } from "../types/discord.ts";

export const waifuCommand = {
  data: new SlashCommandBuilder()
    .setName("waifu")
    .setDescription("Tampilkan Waifu of the Day yang sedang aktif."),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.reply({
      content: "Waifu of the Day belum tersedia — M3 akan mengimplementasikan ini.",
      ephemeral: true,
    });
  },
};

export type CommandModule = typeof waifuCommand;

export const waifuEvent: BotEvent<"interactionCreate"> = {
  name: "interactionCreate",
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "waifu") return;
    await waifuCommand.execute(interaction);
  },
};