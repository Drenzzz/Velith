import { InteractionType, type BotEvent } from "../types/discord.ts";

export const interactionCreateEvent: BotEvent<"interactionCreate"> = {
  name: "interactionCreate",
  execute(interaction) {
    if (interaction.type === InteractionType.MessageComponent && interaction.isButton()) {
      console.log(JSON.stringify({
        level: 30,
        msg: "Button interaction received",
        id: interaction.customId,
        user: interaction.user.id,
      }));
      return;
    }

    if (interaction.type === InteractionType.ApplicationCommand) {
      const name = "commandName" in interaction ? interaction.commandName : "unknown";
      console.log(JSON.stringify({
        level: 30,
        msg: "Slash command received",
        name,
        user: interaction.user.id,
      }));
      return;
    }

    console.log(JSON.stringify({
      level: 20,
      msg: "Unhandled interaction type",
      type: interaction.type,
    }));
  },
};