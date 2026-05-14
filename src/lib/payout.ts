import type { PayoutModel } from "@/db/schema";

export type CampaignPayout = {
  payoutModel: PayoutModel;
  cpcCents: number;
  cpmCents: number;
  cpaCents: number;
  commissionBps: number;
};

/** Human-friendly summary of how this campaign pays out, e.g. "$0.25 / click". */
export function describePayout(c: CampaignPayout): string {
  switch (c.payoutModel) {
    case "cpc":
      return `${money(c.cpcCents)} / click`;
    case "cpm":
      return `${money(c.cpmCents)} / 1k impressions`;
    case "cpa_fixed":
      return `${money(c.cpaCents)} / sale`;
    case "cpa_percent":
      return `${(c.commissionBps / 100).toFixed(2)}% commission`;
  }
}

/** The dollar amount the brand owes (and the creator earns) per single
 * conversion event with the given sale amount. Returns 0 for click-based
 * models — those earnings are computed from clicks, not conversions. */
export function commissionForConversion(
  c: CampaignPayout,
  saleCents: number
): number {
  switch (c.payoutModel) {
    case "cpa_percent":
      return Math.floor((saleCents * c.commissionBps) / 10000);
    case "cpa_fixed":
      return c.cpaCents;
    case "cpc":
    case "cpm":
      return 0;
  }
}

/** Total earnings across the campaign given click + conversion counts and the
 * sum of stored commission_cents (used for CPA models). */
export function totalEarningsCents(
  c: CampaignPayout,
  clicks: number,
  storedCommissionCents: number
): number {
  switch (c.payoutModel) {
    case "cpc":
      return clicks * c.cpcCents;
    case "cpm":
      return Math.floor((clicks * c.cpmCents) / 1000);
    case "cpa_fixed":
    case "cpa_percent":
      return storedCommissionCents;
  }
}

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format((cents || 0) / 100);
}
