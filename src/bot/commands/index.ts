import { Collection } from "discord.js";
import { waifuCommand, type CommandModule } from "./waifu.ts";

export const commands = new Collection<string, CommandModule>();
commands.set(waifuCommand.data.name, waifuCommand);

export const commandData = [waifuCommand.data.toJSON()];