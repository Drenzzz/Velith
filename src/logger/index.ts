import pino from "pino";
import { env } from "../config/env.ts";

const isDev = env.APP_ENV === "development";

export const logger = pino({
  level: env.LOG_LEVEL,
  ...(isDev
    ? {
        transport: {
          target: "pino/file",
          options: { destination: 1 },
        },
      }
    : {}),
  base: {
    app: "daily-waifu-bot",
    env: env.APP_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function child(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}

if (import.meta.main) {
  logger.fatal({ test: 1 }, "fatal level sample");
  logger.error({ test: 2 }, "error level sample");
  logger.warn({ test: 3 }, "warn level sample");
  logger.info({ test: 4 }, "info level sample");
  logger.debug({ test: 5 }, "debug level sample");
  logger.trace({ test: 6 }, "trace level sample");
  logger.info("Sample structured event");
  child({ component: "demo" }).info("Sample child logger event");
}