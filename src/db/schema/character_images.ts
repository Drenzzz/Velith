import { pgTable, text, boolean, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { characters } from "./characters.ts";

export const imageSources = ["anilist", "jikan", "manual"] as const;
export type ImageSource = (typeof imageSources)[number];

export const characterImages = pgTable(
  "character_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    source: text("source").$type<ImageSource>().notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    characterIdIdx: index("character_images_character_id_idx").on(table.characterId),
  }),
);

export type CharacterImage = typeof characterImages.$inferSelect;
export type NewCharacterImage = typeof characterImages.$inferInsert;