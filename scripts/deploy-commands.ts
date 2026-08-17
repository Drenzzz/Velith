import { REST, Routes } from "discord.js";
import { env } from "../src/config/env.ts";
import { commandData } from "../src/bot/commands/index.ts";
import { logger } from "../src/logger/index.ts";

async function main(): Promise<void> {
  const commandScope = process.env.COMMAND_SCOPE ?? "guild";
  const guildId = process.env.TEST_GUILD_ID;

  if (commandScope !== "guild" && commandScope !== "global") {
    logger.fatal({ commandScope }, "Invalid COMMAND_SCOPE; use guild or global");
    process.exit(1);
  }

  if (commandScope === "guild" && !guildId) {
    logger.fatal("TEST_GUILD_ID env not set");
    process.exit(1);
  }

  const rest = new REST({ version: "10" }).setToken(env.DISCORD_TOKEN);
  const route =
    commandScope === "global"
      ? Routes.applicationCommands(env.DISCORD_CLIENT_ID)
      : Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, guildId!);

  try {
    logger.info(
      {
        scope: commandScope,
        ...(commandScope === "guild" ? { guildId } : {}),
        commandCount: commandData.length,
      },
      `Deploying ${commandScope}-scoped slash commands`,
    );
    const result = (await rest.put(
      route,
      { body: commandData },
    )) as Array<{ id: string; name: string }>;

    logger.info({ deployed: result.length, names: result.map((c) => c.name) }, "Commands deployed");
  } catch (err) {
    logger.fatal({ err }, "Deploy failed");
    process.exit(1);
  }
}

await main();
