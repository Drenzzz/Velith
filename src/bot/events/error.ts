import type { BotEvent } from "../types/discord.ts";

export const errorEvent: BotEvent<"error"> = {
  name: "error",
  execute(err: Error) {
    console.log(JSON.stringify({
      level: 50,
      msg: "Discord client error",
      err: { message: err.message, name: err.name },
    }));
  },
};