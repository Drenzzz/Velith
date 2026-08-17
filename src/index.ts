import { startBot } from "./bot/client.ts";
import { logger } from "./logger/index.ts";

logger.info(
  {
    env: process.env.APP_ENV,
    logLevel: process.env.LOG_LEVEL,
  },
  "Daily Waifu Bot starting",
);

await startBot();