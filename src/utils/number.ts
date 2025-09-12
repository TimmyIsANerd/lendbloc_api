export function roundTo8(n: number): number {
  if (!isFinite(n)) return 0;
  return Math.round(n * 1e8) / 1e8;
}
