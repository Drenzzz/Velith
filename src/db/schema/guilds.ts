import { pgTable, text, integer, timestamp, uuid, unique } from "drizzle-orm/pg-core";

export const guilds = pgTable(
  "guilds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    discordGuildId: text("discord_guild_id").notNull(),
    waifuChannelId: text("waifu_channel_id"),
    activeMessageId: text("active_message_id"),
    cycleDurationHours: integer("cycle_duration_hours").notNull().default(24),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    discordGuildIdUnique: unique("guilds_discord_guild_id_unique").on(table.discordGuildId),
  }),
);

export type Guild = typeof guilds.$inferSelect;
export type NewGuild = typeof guilds.$inferInsert;