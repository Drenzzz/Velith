import { startBot } from "./bot/client.ts";
import { startScheduler, type SchedulerHandle } from "./scheduler/loop.ts";
import { logger } from "./logger/index.ts";
import { closeDb } from "./db/client.ts";

logger.info(
  {
    env: process.env.APP_ENV,
    logLevel: process.env.LOG_LEVEL,
  },
  "Daily Waifu Bot starting",
);

const client = await startBot();
const scheduler: SchedulerHandle = startScheduler(60_000, client);

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutdown initiated");

  try {
    scheduler.stop();
    logger.info("Scheduler stopped");
  } catch (err) {
    logger.error({ err }, "Error stopping scheduler");
  }

  try {
    client.destroy();
    logger.info("Discord client disconnected");
  } catch (err) {
    logger.error({ err }, "Error destroying Discord client");
  }

  try {
    await closeDb();
    logger.info("Database pool closed");
  } catch (err) {
    logger.error({ err }, "Error closing database pool");
  }

  logger.info("Shutdown complete");
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});