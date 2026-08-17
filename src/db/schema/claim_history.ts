import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { guilds } from "./guilds.ts";
import { characters } from "./characters.ts";
import { dailyWaifus } from "./daily_waifus.ts";

export const claimHistory = pgTable("claim_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  guildId: uuid("guild_id")
    .notNull()
    .references(() => guilds.id, { onDelete: "cascade" }),
  dailyWaifuId: uuid("daily_waifu_id")
    .notNull()
    .references(() => dailyWaifus.id, { onDelete: "cascade" }),
  characterId: uuid("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ClaimHistoryRow = typeof claimHistory.$inferSelect;
export type NewClaimHistoryRow = typeof claimHistory.$inferInsert;