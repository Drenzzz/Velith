import {
  InteractionType,
  MessageFlags,
  type ButtonInteraction,
} from "discord.js";
import { and, eq } from "drizzle-orm";
import type { BotEvent } from "../types/discord.ts";
import { db } from "../../db/client.ts";
import {
  guilds as guildsTable,
  dailyWaifus,
  characters,
  characterImages,
} from "../../db/schema/index.ts";
import { attemptClaim } from "../../claim/service.ts";
import { editMessageToClaimed } from "../../waifu/edit.ts";
import { logger } from "../../logger/index.ts";

const CLAIM_BUTTON_ID = "waifu:claim";

interface ActiveWaifuWithDetails {
  dailyWaifuId: string;
  characterId: string;
  expiresAt: Date;
  name: string;
  rarity: string;
  popularity: number;
  sourceUrl: string | null;
  imageUrl: string | null;
}

async function loadActiveWaifuForGuild(
  discordGuildId: string,
): Promise<ActiveWaifuWithDetails | null> {
  const guildRows = await db
    .select({ id: guildsTable.id })
    .from(guildsTable)
    .where(eq(guildsTable.discordGuildId, discordGuildId))
    .limit(1);
  const internalGuildId = guildRows[0]?.id;
  if (!internalGuildId) return null;

  const waifuRows = await db
    .select({
      dailyWaifuId: dailyWaifus.id,
      characterId: dailyWaifus.characterId,
      expiresAt: dailyWaifus.expiresAt,
      name: characters.name,
      rarity: characters.rarity,
      popularity: characters.popularity,
      sourceUrl: characters.sourceUrl,
    })
    .from(dailyWaifus)
    .innerJoin(characters, eq(dailyWaifus.characterId, characters.id))
    .where(
      and(
        eq(dailyWaifus.guildId, internalGuildId),
        eq(dailyWaifus.status, "ACTIVE"),
      ),
    )
    .limit(1);

  const waifu = waifuRows[0];
  if (!waifu) return null;

  const imageRows = await db
    .select({ url: characterImages.url })
    .from(characterImages)
    .where(eq(characterImages.characterId, waifu.characterId))
    .limit(1);

  return {
    dailyWaifuId: waifu.dailyWaifuId,
    characterId: waifu.characterId,
    expiresAt: waifu.expiresAt,
    name: waifu.name,
    rarity: waifu.rarity,
    popularity: waifu.popularity,
    sourceUrl: waifu.sourceUrl,
    imageUrl: imageRows[0]?.url ?? null,
  };
}

export async function handleClaimButton(interaction: ButtonInteraction): Promise<void> {
  if (interaction.customId !== CLAIM_BUTTON_ID) {
    await interaction.reply({
      content: "Tombol tidak dikenal.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!interaction.guildId) {
    await interaction.reply({
      content: "Hanya bisa dipakai di server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const active = await loadActiveWaifuForGuild(interaction.guildId);
  if (!active) {
    await interaction.reply({
      content: "Waifu aktif tidak ditemukan atau sudah berakhir.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const result = await attemptClaim(active.dailyWaifuId, interaction.user.id);

  if (!result) {
    await interaction.reply({
      content: "Karakter sudah diklaim orang lain lebih dulu. Coba lagi besok!",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    await editMessageToClaimed(
      interaction.message,
      {
        characterId: active.characterId,
        name: active.name,
        rarity: active.rarity,
        popularity: active.popularity,
        imageUrl: active.imageUrl,
        sourceUrl: active.sourceUrl,
      },
      active.expiresAt,
      interaction.user.id,
    );
  } catch (err) {
    logger.warn(
      { err, messageId: interaction.message.id, dailyWaifuId: result.dailyWaifuId },
      "Embed edit failed (claim still valid)",
    );
  }

  const collectNote = result.collectedToCollection
    ? "Karakter ditambahkan ke koleksimu."
    : "Kamu sudah punya karakter ini — klaim tetap dicatat tapi koleksimu tidak bertambah.";

  await interaction.reply({
    content: `<@${interaction.user.id}> memenangkan **${active.name}**! ${collectNote}`,
    flags: MessageFlags.Ephemeral,
  });
}

export const interactionRouter: BotEvent<"interactionCreate"> = {
  name: "interactionCreate",
  async execute(interaction) {
    if (interaction.type === InteractionType.MessageComponent && interaction.isButton()) {
      await handleClaimButton(interaction);
      return;
    }

    if (interaction.type === InteractionType.ApplicationCommand && interaction.isChatInputCommand()) {
      const { commands } = await import("../commands/index.ts");
      const cmd = commands.get(interaction.commandName);
      if (!cmd) {
        await interaction.reply({
          content: "Command tidak ditemukan.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await cmd.execute(interaction);
      return;
    }
  },
};