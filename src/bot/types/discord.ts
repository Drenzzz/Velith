import { Events, InteractionType } from "discord.js";

export { Events, InteractionType };

export interface BotEvent<K extends keyof DiscordEventMap | string = string> {
  name: K;
  once?: boolean;
  execute(...args: any[]): void | Promise<void>;
}

interface DiscordEventMap {
  ready: [client: import("discord.js").Client<true>];
  error: [error: Error];
  interactionCreate: [interaction: import("discord.js").Interaction];
}