import { Collection } from "discord.js";
import { waifuCommand, type CommandModule } from "./waifu.ts";
import { setupCommand } from "./setup.ts";

export const commands = new Collection<string, CommandModule>();
commands.set(waifuCommand.data.name, waifuCommand as unknown as CommandModule);
commands.set(setupCommand.data.name, setupCommand as unknown as CommandModule);

export const commandData = [waifuCommand.data.toJSON(), setupCommand.data.toJSON()];