import { pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { guilds } from "./guilds.ts";
import { characters } from "./characters.ts";

export const dailyWaifuStatuses = ["ACTIVE", "CLAIMED", "EXPIRED"] as const;
export type DailyWaifuStatus = (typeof dailyWaifuStatuses)[number];

export const dailyWaifus = pgTable(
  "daily_waifus",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    guildId: uuid("guild_id")
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    spawnedAt: timestamp("spawned_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    claimedBy: text("claimed_by"),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    status: text("status").$type<DailyWaifuStatus>().notNull().default("ACTIVE"),
  },
  (table) => ({
    guildIdIdx: index("daily_waifus_guild_id_idx").on(table.guildId),
    expiresAtIdx: index("daily_waifus_expires_at_idx").on(table.expiresAt),
    statusIdx: index("daily_waifus_status_idx").on(table.status),
    guildStatusIdx: index("daily_waifus_guild_status_idx").on(table.guildId, table.status),
  }),
);

export type DailyWaifu = typeof dailyWaifus.$inferSelect;
export type NewDailyWaifu = typeof dailyWaifus.$inferInsert;