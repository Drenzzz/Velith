import { EmbedBuilder, Colors } from "discord.js";
import type { SpawnChoice } from "./spawn.ts";
import { formatExpiresIn } from "./expire.ts";

export interface WaifuEmbedContext {
  choice: SpawnChoice;
  expiresAt: Date;
  claimedByMention?: string;
}

function rarityEmoji(rarity: string): string {
  switch (rarity) {
    case "Legendary": return "⭐";
    case "Epic": return "💎";
    case "Rare": return "🔷";
    case "Uncommon": return "🔹";
    case "Common": return "⚪";
    default: return "•";
  }
}

export function buildActiveEmbed(ctx: WaifuEmbedContext): EmbedBuilder {
  const { choice, expiresAt } = ctx;
  const embed = new EmbedBuilder()
    .setTitle("💖 WAIFU OF THE DAY")
    .setColor(Colors.Fuchsia)
    .addFields(
      { name: "Name", value: choice.name, inline: true },
      { name: "Source", value: choice.sourceUrl ? `[AniList](${choice.sourceUrl})` : "Unknown", inline: true },
      { name: "Rarity", value: `${rarityEmoji(choice.rarity)} ${choice.rarity}`, inline: true },
      { name: "Expires in", value: formatExpiresIn(expiresAt.getTime() - Date.now()), inline: false },
    );

  if (choice.imageUrl) {
    embed.setImage(choice.imageUrl);
  } else {
    embed.setDescription("🖼️ Image unavailable");
  }

  return embed;
}

export function buildClaimedEmbed(ctx: WaifuEmbedContext): EmbedBuilder {
  const { choice, expiresAt, claimedByMention } = ctx;
  const mention = claimedByMention ? `<@${claimedByMention}>` : "Unknown";
  const nextIn = formatExpiresIn(expiresAt.getTime() - Date.now());

  const embed = new EmbedBuilder()
    .setTitle("� WAIFU CLAIMED")
    .setColor(Colors.Grey)
    .addFields(
      { name: "Name", value: choice.name, inline: true },
      { name: "Source", value: choice.sourceUrl ? `[AniList](${choice.sourceUrl})` : "Unknown", inline: true },
      { name: "Claimed by", value: mention, inline: true },
      { name: "Next waifu in", value: nextIn, inline: false },
    );

  if (choice.imageUrl) {
    embed.setImage(choice.imageUrl);
  }

  return embed;
}

if (import.meta.main) {
  const sample: SpawnChoice = {
    characterId: "00000000-0000-0000-0000-000000000000",
    name: "Makima",
    rarity: "Legendary",
    popularity: 180_000,
    imageUrl: "https://s4.anilist.co/file/anilistcdn/character/large/b1.png",
    sourceUrl: "https://anilist.co/character/1",
  };

  const expiresAt = new Date(Date.now() + 14 * 60 * 60 * 1000 + 32 * 60 * 1000);

  const active = buildActiveEmbed({ choice: sample, expiresAt });
  const claimed = buildClaimedEmbed({
    choice: sample,
    expiresAt,
    claimedByMention: "123456789",
  });

  console.log(JSON.stringify({
    active: active.toJSON(),
    claimed: claimed.toJSON(),
  }, null, 2));
}