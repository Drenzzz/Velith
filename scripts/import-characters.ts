import { fetchCharacters, type NormalizedCharacter } from "../src/importer/anilist.ts";
import { upsertCharacter } from "../src/importer/service.ts";
import { closeDb } from "../src/db/client.ts";
import { db } from "../src/db/client.ts";
import { blacklists } from "../src/db/schema/index.ts";
import { isContentClean, isBlacklisted, isFemale, type BlacklistEntry } from "../src/character/filter.ts";
import { logger } from "../src/logger/index.ts";

const PER_PAGE = 100;
const DEFAULT_PAGES = 1;

async function loadBlacklists(): Promise<BlacklistEntry[]> {
  const rows = await db
    .select({
      anilistId: blacklists.anilistId,
      malId: blacklists.malId,
      namePattern: blacklists.namePattern,
    })
    .from(blacklists);
  return rows.map((r) => ({
    anilistId: r.anilistId,
    malId: r.malId,
    namePattern: r.namePattern,
  }));
}

function reportStage(
  page: number,
  total: number,
  kept: number,
  filtered: number,
  blacklisted: number,
  skippedGender: number,
): void {
  logger.info({ page, total, kept, filtered, blacklisted, skippedGender }, "Import page processed");
}

async function runImport(totalPages: number): Promise<void> {
  const blacklist = await loadBlacklists();
  let totalImported = 0;
  let totalSkippedFilter = 0;
  let totalSkippedBlacklist = 0;
  let totalSkippedGender = 0;

  for (let page = 1; page <= totalPages; page++) {
    let chars: NormalizedCharacter[] = [];
    try {
      chars = await fetchCharacters(page, PER_PAGE);
    } catch (err) {
      logger.error({ err, page }, "Fetch failed, aborting import");
      break;
    }

    let kept = 0;
    let filtered = 0;
    let blacklisted = 0;
    let skippedGender = 0;

    for (const char of chars) {
      if (!isFemale(char)) {
        skippedGender++;
        continue;
      }
      if (!isContentClean(char)) {
        filtered++;
        continue;
      }
      if (isBlacklisted(char, blacklist)) {
        blacklisted++;
        continue;
      }
      try {
        await upsertCharacter(char);
        kept++;
      } catch (err) {
        logger.warn({ err, anilistId: char.anilistId }, "Upsert failed for character");
      }
    }

    totalImported += kept;
    totalSkippedFilter += filtered;
    totalSkippedBlacklist += blacklisted;
    totalSkippedGender += skippedGender;
    reportStage(page, chars.length, kept, filtered, blacklisted, skippedGender);
  }

  logger.info(
    {
      totalImported,
      totalSkippedFilter,
      totalSkippedBlacklist,
      totalSkippedGender,
      pages: totalPages,
    },
    "Import complete",
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const pagesArg = args.find((a) => a.startsWith("--pages="));
  const totalPages = pagesArg ? parseInt(pagesArg.split("=")[1] ?? "", 10) : DEFAULT_PAGES;

  if (!Number.isFinite(totalPages) || totalPages < 1) {
    logger.error({ pagesArg }, "Invalid --pages; must be a positive integer");
    process.exit(1);
  }

  try {
    await runImport(totalPages);
  } catch (err) {
    logger.fatal({ err }, "Import aborted");
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}

await main();