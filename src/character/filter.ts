const FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /\bnsfw\b/i,
  /\bhentai\b/i,
  /\bsex(?:ual|y)?\b/i,
  /\berotic\b/i,
  /\bexplicit\b/i,
  /\bporn(?:ographic)?\b/i,
  /\bnude\b/i,
  /\bnaked\b/i,
];

export interface ContentInput {
  name: string;
  nativeName?: string | null;
  description?: string | null;
}

export function isContentClean(input: ContentInput): boolean {
  const haystack = `${input.name} ${input.nativeName ?? ""} ${input.description ?? ""}`;
  return !FORBIDDEN_PATTERNS.some((re) => re.test(haystack));
}

export interface BlacklistEntry {
  anilistId?: number | null;
  malId?: number | null;
  namePattern?: string | null;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isBlacklisted(
  char: { anilistId?: number | null; malId?: number | null; name: string },
  entries: readonly BlacklistEntry[],
): boolean {
  for (const entry of entries) {
    if (entry.anilistId != null && char.anilistId === entry.anilistId) return true;
    if (entry.malId != null && char.malId === entry.malId) return true;
    if (entry.namePattern && normalize(char.name) === normalize(entry.namePattern)) return true;
  }
  return false;
}

export function isFemale(input: { gender?: string | null }): boolean {
  return typeof input.gender === "string" && input.gender.toLowerCase() === "female";
}

if (import.meta.main) {
  const clean: ContentInput = { name: "Makima", description: "Public Safety Devil Hunter." };
  const nsfw: ContentInput = { name: "Test", description: "NSFW content here" };
  const explicit: ContentInput = { name: "Foo", description: "erotic scenes" };
  console.log(JSON.stringify({
    cleanResult: isContentClean(clean),
    nsfwResult: isContentClean(nsfw),
    explicitResult: isContentClean(explicit),
  }));

  const blacklists: BlacklistEntry[] = [
    { namePattern: "Test Char" },
    { anilistId: 12345 },
  ];
  console.log(JSON.stringify({
    byName: isBlacklisted({ name: "test char", anilistId: 1, malId: 1 }, blacklists),
    byAnilist: isBlacklisted({ name: "Other", anilistId: 12345, malId: 1 }, blacklists),
    noMatch: isBlacklisted({ name: "Safe", anilistId: 1, malId: 1 }, blacklists),
  }));

  console.log(JSON.stringify({
    femaleCapital: isFemale({ gender: "Female" }),
    femaleLower: isFemale({ gender: "female" }),
    femaleUpper: isFemale({ gender: "FEMALE" }),
    male: isFemale({ gender: "Male" }),
    nullGender: isFemale({ gender: null }),
    undefinedGender: isFemale({}),
    nonBinary: isFemale({ gender: "Non-binary" }),
    empty: isFemale({ gender: "" }),
  }));
}