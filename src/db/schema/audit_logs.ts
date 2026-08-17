import { pgTable, text, timestamp, uuid, jsonb, index } from "drizzle-orm/pg-core";
import { guilds } from "./guilds.ts";

export const auditActions = ["claim", "reroll", "spawn", "reset", "setup"] as const;
export type AuditAction = (typeof auditActions)[number];

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    guildId: uuid("guild_id").references(() => guilds.id, { onDelete: "set null" }),
    userId: text("user_id"),
    action: text("action").$type<AuditAction>().notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    guildIdIdx: index("audit_logs_guild_id_idx").on(table.guildId),
    actionIdx: index("audit_logs_action_idx").on(table.action),
    createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
  }),
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;