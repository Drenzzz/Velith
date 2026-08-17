import { REST, Routes } from "discord.js";
import { env } from "../src/config/env.ts";
import { commandData } from "../src/bot/commands/index.ts";
import { logger } from "../src/logger/index.ts";

async function main(): Promise<void> {
  const guildId = process.env.TEST_GUILD_ID;
  if (!guildId) {
    logger.fatal("TEST_GUILD_ID env not set");
    process.exit(1);
  }

  const rest = new REST({ version: "10" }).setToken(env.DISCORD_TOKEN);

  try {
    logger.info(
      { guildId, commandCount: commandData.length },
      "Deploying guild-scoped slash commands",
    );
    const result = (await rest.put(
      Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, guildId),
      { body: commandData },
    )) as Array<{ id: string; name: string }>;

    logger.info({ deployed: result.length, names: result.map((c) => c.name) }, "Commands deployed");
  } catch (err) {
    logger.fatal({ err }, "Deploy failed");
    process.exit(1);
  }
}

await main();