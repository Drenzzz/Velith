import type { Guild } from "discord.js";

export async function resolveDisplayNames(
  guild: Guild,
  userIds: readonly string[],
): Promise<Map<string, string>> {
  const entries = await Promise.all(
    userIds.map(async (userId) => {
      const cachedMember = guild.members.cache.get(userId);
      if (cachedMember) return [userId, cachedMember.displayName] as const;

      try {
        const member = await guild.members.fetch(userId);
        return [userId, member.displayName] as const;
      } catch {
        try {
          const user = await guild.client.users.fetch(userId);
          return [userId, user.globalName ?? user.username] as const;
        } catch {
          return [userId, "Unknown user"] as const;
        }
      }
    }),
  );

  return new Map(entries);
}
