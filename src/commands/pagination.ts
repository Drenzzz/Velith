import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";

export const PAGE_SIZE = 10;

export interface PaginationOptions {
  title: string;
  rows: ReadonlyArray<{ label: string; value: string; inline?: boolean }>;
  page: number;
  scope: string;
  authorId: string;
  totalRows: number;
  description?: string;
  color?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function totalPages(totalRows: number): number {
  if (totalRows <= 0) return 1;
  return Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
}

export function pageSlice<T>(rows: ReadonlyArray<T>, page: number): T[] {
  const total = totalPages(rows.length);
  const safe = clamp(page, 1, total);
  const start = (safe - 1) * PAGE_SIZE;
  return rows.slice(start, start + PAGE_SIZE);
}

export function buildPaginatedEmbed(opts: PaginationOptions): EmbedBuilder {
  const total = totalPages(opts.totalRows);
  const safePage = clamp(opts.page, 1, total);
  const embed = new EmbedBuilder()
    .setTitle(opts.title)
    .setColor(opts.color ?? 0x9b59b6)
    .setDescription(opts.description ?? null)
    .setFooter({ text: `Page ${safePage} / ${total} • ${opts.totalRows} total` });

  if (opts.rows.length === 0) {
    embed.addFields({ name: "(empty)", value: "No entries", inline: false });
  } else {
    for (const row of opts.rows) {
      embed.addFields({ name: row.label, value: row.value, inline: row.inline ?? false });
    }
  }

  return embed;
}

export function buildPaginationRow(
  scope: string,
  authorId: string,
  page: number,
  totalRows: number,
): ActionRowBuilder<ButtonBuilder> {
  const total = totalPages(totalRows);
  const safePage = clamp(page, 1, total);

  const prevId = `${scope}:prev:${authorId}:${safePage}`;
  const nextId = `${scope}:next:${authorId}:${safePage}`;
  const customId = `${scope}:page:${authorId}:${safePage}`;

  const prev = new ButtonBuilder()
    .setCustomId(prevId)
    .setLabel("Prev")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(safePage <= 1);

  const next = new ButtonBuilder()
    .setCustomId(nextId)
    .setLabel("Next")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(safePage >= total);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(prev, next);
}

if (import.meta.main) {
  const sampleRows = Array.from({ length: 25 }, (_, i) => ({
    label: `Item ${i + 1}`,
    value: `Description for item ${i + 1}`,
    inline: false,
  }));

  const embed = buildPaginatedEmbed({
    title: "Sample List",
    rows: pageSlice(sampleRows, 2),
    page: 2,
    scope: "test",
    authorId: "user-1",
    totalRows: sampleRows.length,
  });

  const row = buildPaginationRow("test", "user-1", 2, sampleRows.length);

  console.log(JSON.stringify({
    embed: embed.toJSON(),
    row: row.toJSON(),
  }, null, 2));
}