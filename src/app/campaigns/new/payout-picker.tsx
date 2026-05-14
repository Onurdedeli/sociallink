"use client";

import { useState } from "react";
import { PAYOUT_MODELS, PAYOUT_MODEL_LABEL, type PayoutModel } from "@/db/schema";

const HELP: Record<PayoutModel, string> = {
  cpc: "You pay the creator a flat amount for every click on their tracking link. Best for awareness campaigns.",
  cpm: "You pay per 1,000 clicks. Useful when you care about reach more than individual clicks.",
  cpa_fixed: "You pay a flat amount for every confirmed sale. Predictable cost per order.",
  cpa_percent: "You pay a percentage of every sale's value. Aligned with revenue — works best with high AOV.",
};

export function PayoutPicker({ defaultModel = "cpa_percent" }: { defaultModel?: PayoutModel }) {
  const [model, setModel] = useState<PayoutModel>(defaultModel);

  return (
    <>
      <div>
        <label className="label">How do you want to pay?</label>
        <div className="grid sm:grid-cols-2 gap-2">
          {PAYOUT_MODELS.map((m) => (
            <label
              key={m}
              className={`flex items-start gap-2 rounded-lg ring-1 p-3 cursor-pointer transition ${
                model === m
                  ? "ring-brand-600 bg-brand-50"
                  : "ring-slate-200 hover:bg-slate-50"
              }`}
            >
              <input
                type="radio"
                name="payoutModel"
                value={m}
                checked={model === m}
                onChange={() => setModel(m)}
                className="mt-1"
              />
              <span>
                <span className="block font-medium text-sm">{PAYOUT_MODEL_LABEL[m]}</span>
                <span className="block text-xs text-slate-500 mt-0.5">{HELP[m]}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {model === "cpc" && (
        <div>
          <label className="label">Pay per click (cents)</label>
          <input name="cpcCents" type="number" min={1} required defaultValue={10} className="input" />
          <p className="mt-1 text-xs text-slate-500">e.g. 10 = $0.10 per click</p>
        </div>
      )}

      {model === "cpm" && (
        <div>
          <label className="label">Pay per 1,000 clicks (cents)</label>
          <input name="cpmCents" type="number" min={1} required defaultValue={500} className="input" />
          <p className="mt-1 text-xs text-slate-500">e.g. 500 = $5.00 per 1k clicks</p>
        </div>
      )}

      {model === "cpa_fixed" && (
        <div>
          <label className="label">Pay per sale (cents)</label>
          <input name="cpaCents" type="number" min={1} required defaultValue={500} className="input" />
          <p className="mt-1 text-xs text-slate-500">e.g. 500 = $5.00 flat per confirmed order</p>
        </div>
      )}

      {model === "cpa_percent" && (
        <div>
          <label className="label">Commission (basis points)</label>
          <input name="commissionBps" type="number" min={1} max={10000} required defaultValue={1500} className="input" />
          <p className="mt-1 text-xs text-slate-500">1500 = 15% of each sale</p>
        </div>
      )}
    </>
  );
}
