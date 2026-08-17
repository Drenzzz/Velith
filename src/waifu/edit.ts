import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Message,
} from "discord.js";
import type { SpawnChoice } from "./spawn.ts";
import { buildClaimedEmbed } from "./embed.ts";

export async function editMessageToClaimed(
  message: Message,
  choice: SpawnChoice,
  expiresAt: Date,
  winnerId: string,
): Promise<void> {
  const disabledButton = new ButtonBuilder()
    .setCustomId("waifu:claim")
    .setLabel("💖 CLAIMED")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(disabledButton);
  const embed = buildClaimedEmbed({
    choice,
    expiresAt,
    claimedByMention: winnerId,
  });

  await message.edit({
    embeds: [embed],
    components: [row],
  });
}