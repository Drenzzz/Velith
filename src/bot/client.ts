import { Client, GatewayIntentBits } from "discord.js";
import { env } from "../config/env.ts";
import { logger } from "../logger/index.ts";
import { readyEvent } from "./events/ready.ts";
import { errorEvent } from "./events/error.ts";
import { interactionRouter } from "./interactions/index.ts";
import type { BotEvent } from "./types/discord.ts";

export const events: BotEvent[] = [
  readyEvent,
  errorEvent,
  interactionRouter,
];

export function createClient(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
    ],
  });

  for (const event of events) {
    if (event.once) {
      client.once(event.name, (...args: unknown[]) => event.execute(...args));
    } else {
      client.on(event.name, (...args: unknown[]) => event.execute(...args));
    }
  }

  return client;
}

export async function startBot(): Promise<Client> {
  const client = createClient();
  try {
    await client.login(env.DISCORD_TOKEN);
  } catch (err) {
    logger.fatal({ err }, "Bot login failed");
    process.exit(1);
  }
  return client;
}