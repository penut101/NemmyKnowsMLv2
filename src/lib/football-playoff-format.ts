export function playoffPercent(value: number): string {
  return value < 0.001
    ? "<0.1%"
    : value > 0.999
      ? ">99.9%"
      : `${(value * 100).toFixed(1)}%`;
}
export function playoffDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  });
}
