import { Collection, type ChatInputCommandInteraction } from "discord.js";
import { waifuCommand } from "./waifu.ts";
import { setupCommand } from "./setup.ts";

export interface CommandModule {
  data: { name: string; toJSON: () => unknown };
  execute(interaction: ChatInputCommandInteraction): Promise<void> | void;
}

export const commands = new Collection<string, CommandModule>();
commands.set(waifuCommand.data.name, waifuCommand);
commands.set(setupCommand.data.name, setupCommand);

export const commandData = [waifuCommand.data.toJSON(), setupCommand.data.toJSON()];