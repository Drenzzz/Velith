import { pgTable, text, integer, timestamp, uuid, index } from "drizzle-orm/pg-core";

export const blacklists = pgTable(
  "blacklists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    anilistId: integer("anilist_id"),
    malId: integer("mal_id"),
    namePattern: text("name_pattern").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    namePatternIdx: index("blacklists_name_pattern_idx").on(table.namePattern),
    anilistIdIdx: index("blacklists_anilist_id_idx").on(table.anilistId),
    malIdIdx: index("blacklists_mal_id_idx").on(table.malId),
  }),
);

export type Blacklist = typeof blacklists.$inferSelect;
export type NewBlacklist = typeof blacklists.$inferInsert;