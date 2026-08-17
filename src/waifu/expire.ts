export function formatExpiresIn(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "Expired";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

if (import.meta.main) {
  const cases: Array<[number, string]> = [
    [45 * 60_000, "45m"],
    [14 * 60 * 60_000 + 32 * 60_000, "14h 32m"],
    [0, "Expired"],
    [-1000, "Expired"],
    [168 * 60 * 60_000, "7d 0h 0m"],
    [Number.NaN, "Expired"],
  ];
  for (const [ms, expected] of cases) {
    const result = formatExpiresIn(ms);
    console.log(JSON.stringify({ ms, expected, result, ok: result === expected }));
  }
}