import { pgTable, text, integer, timestamp, uuid, unique, index } from "drizzle-orm/pg-core";

export const rarityEnum = ["Legendary", "Epic", "Rare", "Uncommon", "Common"] as const;
export type Rarity = (typeof rarityEnum)[number];

export const characters = pgTable(
  "characters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    anilistId: integer("anilist_id"),
    malId: integer("mal_id"),
    name: text("name").notNull(),
    nativeName: text("native_name"),
    description: text("description"),
    gender: text("gender"),
    rarity: text("rarity").$type<Rarity>().notNull(),
    popularity: integer("popularity").notNull().default(0),
    sourceUrl: text("source_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    anilistIdUnique: unique("characters_anilist_id_unique").on(table.anilistId),
    malIdUnique: unique("characters_mal_id_unique").on(table.malId),
    nameIdx: index("characters_name_idx").on(table.name),
  }),
);

export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;