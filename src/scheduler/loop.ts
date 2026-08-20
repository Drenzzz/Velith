import type { Client } from "discord.js";
import { logger } from "../logger/index.ts";
import { tickOnceAll } from "./tick.ts";

const DEFAULT_INTERVAL_MS = 5 * 60_000;

export interface SchedulerHandle {
  stop(): void;
}

export function startScheduler(
  intervalMs = DEFAULT_INTERVAL_MS,
  client: Client | null = null,
): SchedulerHandle {
  logger.info({ intervalMs, hasClient: client !== null }, "Scheduler started");

  let running = false;

  const runTick = async (): Promise<void> => {
    if (running) {
      logger.warn("Previous tick still running, skipping this interval");
      return;
    }
    running = true;
    try {
      await tickOnceAll(client);
    } catch (err) {
      logger.error({ err }, "Tick failed");
    } finally {
      running = false;
    }
  };

  void runTick();

  const handle = setInterval(() => {
    void runTick();
  }, intervalMs);

  return {
    stop(): void {
      clearInterval(handle);
      logger.info("Scheduler stopped");
    },
  };
}

if (import.meta.main) {
  const handle = startScheduler(5_000);
  setTimeout(() => handle.stop(), 25_000);
}