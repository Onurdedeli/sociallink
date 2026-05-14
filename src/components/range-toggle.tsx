import Link from "next/link";

export type RangeDays = 7 | 30;
export const RANGE_OPTIONS: { label: string; days: RangeDays; key: "7d" | "30d" }[] = [
  { label: "7d", days: 7, key: "7d" },
  { label: "30d", days: 30, key: "30d" },
];

/** Parse a range query value to a positive number of days. Defaults to 30. */
export function parseRange(value: string | undefined): RangeDays {
  return value === "7d" ? 7 : 30;
}

export function RangeToggle({
  active,
  basePath,
  preserve = {},
}: {
  active: RangeDays;
  basePath: string;
  preserve?: Record<string, string | undefined>;
}) {
  return (
    <div className="inline-flex items-center gap-1 text-xs">
      {RANGE_OPTIONS.map((opt) => {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(preserve)) {
          if (v) params.set(k, v);
        }
        if (opt.days !== 30) params.set("range", opt.key);
        else params.delete("range");
        const qs = params.toString();
        const href = qs ? `${basePath}?${qs}` : basePath;
        const cls =
          active === opt.days
            ? "px-2 py-1 rounded-md font-medium bg-brand-600 text-white"
            : "px-2 py-1 rounded-md text-slate-600 hover:bg-slate-100";
        return (
          <Link key={opt.key} href={href} className={cls}>
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}
