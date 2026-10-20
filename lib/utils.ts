export function formatCurrency(value: number, currency = "INR") {
  const formatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });

  return formatter.format(value);
}

export function safeNumber(value: number | string | null | undefined): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function toRelativeDate(date: Date | string | null | undefined) {
  if (!date) return "No date";
  const current = new Date(date);
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(current);
}
