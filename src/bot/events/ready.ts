import type { BotEvent } from "../types/discord.ts";

export const readyEvent: BotEvent<"ready"> = {
  name: "ready",
  once: true,
  execute(client) {
    console.log(JSON.stringify({
      level: 30,
      msg: "Bot ready",
      tag: client.user.tag,
      guilds: client.guilds.cache.size,
    }));
  },
};