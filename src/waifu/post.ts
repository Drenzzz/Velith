import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  AllowedMentionsTypes,
  type APIAllowedMentions,
  type Client,
  type SendableChannels,
} from "discord.js";
import type { SpawnChoice } from "./spawn.ts";
import { buildActiveEmbed } from "./embed.ts";

const CLAIM_BUTTON_ID = "waifu:claim";

export interface PostResult {
  messageId: string;
  channelId: string;
}

export interface PostWaifuOptions {
  notificationRoleIds?: string[];
}

function sanitizeRoleIds(ids: readonly string[] | undefined): string[] {
  if (!ids) return [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id || id === "@everyone") continue;
    seen.add(id);
  }
  return Array.from(seen);
}

function buildSendExtras(roleIds: string[]): {
  flags?: number;
  allowedMentions?: APIAllowedMentions;
} {
  if (roleIds.length === 0) {
    return { flags: MessageFlags.SuppressNotifications };
  }
  return {
    allowedMentions: {
      parse: [AllowedMentionsTypes.Role],
      roles: roleIds,
    },
  };
}

export async function postWaifuEmbed(
  client: Client,
  channelId: string,
  choice: SpawnChoice,
  expiresAt: Date,
  options: PostWaifuOptions = {},
): Promise<PostResult | null> {
  let resolvedChannel;
  try {
    resolvedChannel = await client.channels.fetch(channelId);
  } catch (err) {
    console.log(JSON.stringify({
      level: 30,
      msg: "Channel fetch failed (likely deleted)",
      channelId,
      err: { message: (err as Error).message },
    }));
    return null;
  }

  if (!resolvedChannel) {
    console.log(JSON.stringify({ level: 30, msg: "Channel not found", channelId }));
    return null;
  }

  if (!("send" in resolvedChannel)) {
    console.log(JSON.stringify({ level: 30, msg: "Channel cannot send messages", channelId }));
    return null;
  }

  const sendable = resolvedChannel as SendableChannels;
  const roleIds = sanitizeRoleIds(options.notificationRoleIds);
  const embed = buildActiveEmbed({
    choice,
    expiresAt,
    pingRoles: roleIds,
  });
  const button = new ButtonBuilder()
    .setCustomId(CLAIM_BUTTON_ID)
    .setLabel("� CLAIM")
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);
  const sendExtras = buildSendExtras(roleIds);

  try {
    const message = await sendable.send({
      embeds: [embed],
      components: [row],
      ...sendExtras,
    });
    return { messageId: message.id, channelId };
  } catch (err) {
    console.log(JSON.stringify({
      level: 30,
      msg: "Embed post failed",
      channelId,
      err: { message: (err as Error).message },
    }));
    return null;
  }
}
