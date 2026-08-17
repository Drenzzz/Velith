import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN is required"),
  DISCORD_CLIENT_ID: z.string().min(1, "DISCORD_CLIENT_ID is required"),

  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),

  ANILIST_API_URL: z.url().default("https://graphql.anilist.co"),
  JIKAN_API_URL: z.url().default("https://api.jikan.moe/v4"),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  APP_ENV: z.enum(["development", "production", "test"]).default("production"),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("[ENV] Invalid environment configuration:");
  console.error(parsed.error.format());
  process.exit(1);
}

export const env: Env = parsed.data;