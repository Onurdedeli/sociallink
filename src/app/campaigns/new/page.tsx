import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createCampaignAction } from "./actions";
import { PayoutPicker } from "./payout-picker";

export default async function NewCampaignPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "brand") redirect("/dashboard");

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Create campaign</h1>
      <form action={createCampaignAction} className="card space-y-5">
        <div>
          <label className="label">Title</label>
          <input name="title" required className="input" placeholder="Spring sale 2026" />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea name="description" className="input min-h-[100px]" placeholder="Brief, talking points, do/don't..." />
        </div>
        <div>
          <label className="label">Landing / target URL</label>
          <input name="targetUrl" required type="url" className="input" placeholder="https://your-shop.com/spring-sale" />
          <p className="mt-1 text-xs text-slate-500">
            We append <code>?sl=&lt;code&gt;</code> to identify clicks for conversion attribution.
          </p>
        </div>

        <PayoutPicker />

        <div>
          <label className="label">Budget cap (cents, optional)</label>
          <input name="budgetCents" type="number" min={0} defaultValue={0} className="input" />
          <p className="mt-1 text-xs text-slate-500">0 = no cap.</p>
        </div>
        <button className="btn-primary w-full">Create campaign</button>
      </form>
    </div>
  );
}
