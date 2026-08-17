import { pgTable, text, timestamp, uuid, unique } from "drizzle-orm/pg-core";
import { guilds } from "./guilds.ts";
import { characters } from "./characters.ts";
import { dailyWaifus } from "./daily_waifus.ts";

export const collections = pgTable(
  "collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    guildId: uuid("guild_id")
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull().defaultNow(),
    dailyWaifuId: uuid("daily_waifu_id")
      .notNull()
      .references(() => dailyWaifus.id, { onDelete: "cascade" }),
  },
  (table) => ({
    uniqOwnership: unique("collections_uniq_ownership").on(
      table.guildId,
      table.userId,
      table.characterId,
    ),
  }),
);

export type Collection = typeof collections.$inferSelect;
export type NewCollection = typeof collections.$inferInsert;