import { startBot } from "./bot/client.ts";
import { startScheduler } from "./scheduler/loop.ts";
import { logger } from "./logger/index.ts";

logger.info(
  {
    env: process.env.APP_ENV,
    logLevel: process.env.LOG_LEVEL,
  },
  "Daily Waifu Bot starting",
);

const client = await startBot();
const scheduler = startScheduler(60_000, client);

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down");
  scheduler.stop();
  client.destroy();
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down");
  scheduler.stop();
  client.destroy();
  process.exit(0);
});