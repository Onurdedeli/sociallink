export const fmtMoney = (cents: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    (cents || 0) / 100
  );

export const fmtNum = (n: number) =>
  new Intl.NumberFormat("en-US").format(n || 0);

export const fmtPct = (bps: number) => `${(bps / 100).toFixed(2)}%`;

export const fmtDate = (d: Date | number | null | undefined) => {
  if (!d) return "—";
  const dt = typeof d === "number" ? new Date(d * 1000) : d;
  return dt.toLocaleString();
};
