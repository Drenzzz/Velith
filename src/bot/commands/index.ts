import { Collection, type ChatInputCommandInteraction } from "discord.js";
import { waifuCommand } from "./waifu.ts";
import { setupCommand } from "./setup.ts";
import { haremCommand } from "./harem.ts";
import { profileCommand } from "./profile.ts";
import { leaderboardCommand } from "./leaderboard.ts";
import { historyCommand } from "./history.ts";
import { adminRerollCommand } from "./admin.ts";
import { inviteCommand } from "./invite.ts";

export interface CommandModule {
  data: { name: string; toJSON: () => unknown };
  execute(interaction: ChatInputCommandInteraction): Promise<void> | void;
}

export const commands = new Collection<string, CommandModule>();
commands.set(waifuCommand.data.name, waifuCommand);
commands.set(setupCommand.data.name, setupCommand);
commands.set(haremCommand.data.name, haremCommand);
commands.set(profileCommand.data.name, profileCommand);
commands.set(leaderboardCommand.data.name, leaderboardCommand);
commands.set(historyCommand.data.name, historyCommand);
commands.set(adminRerollCommand.data.name, adminRerollCommand);
commands.set(inviteCommand.data.name, inviteCommand);

export const commandData = [
  waifuCommand.data.toJSON(),
  setupCommand.data.toJSON(),
  haremCommand.data.toJSON(),
  profileCommand.data.toJSON(),
  leaderboardCommand.data.toJSON(),
  historyCommand.data.toJSON(),
  adminRerollCommand.data.toJSON(),
  inviteCommand.data.toJSON(),
];
