import { InteractionType, type BotEvent } from "../types/discord.ts";

const CLAIM_BUTTON_ID = "waifu:claim";

export async function handleButton(interaction: import("discord.js").ButtonInteraction): Promise<void> {
  if (interaction.customId !== CLAIM_BUTTON_ID) {
    await interaction.reply({ content: "Tombol tidak dikenal.", ephemeral: true });
    return;
  }
  await interaction.reply({
    content: "Tombol claim belum diimplementasikan — lihat M4.",
    ephemeral: true,
  });
}

export const interactionRouter: BotEvent<"interactionCreate"> = {
  name: "interactionCreate",
  async execute(interaction) {
    if (interaction.type === InteractionType.MessageComponent && interaction.isButton()) {
      await handleButton(interaction);
      return;
    }

    if (interaction.type === InteractionType.ApplicationCommand && interaction.isChatInputCommand()) {
      const { commands } = await import("../commands/index.ts");
      const cmd = commands.get(interaction.commandName);
      if (!cmd) {
        await interaction.reply({ content: "Command tidak ditemukan.", ephemeral: true });
        return;
      }
      await cmd.execute(interaction);
      return;
    }
  },
};