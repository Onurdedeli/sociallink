import Link from "next/link";
import { signUpAction } from "./actions";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const role = sp.role === "influencer" ? "influencer" : "brand";

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Create account</h1>
      <form action={signUpAction} className="card space-y-4">
        {sp.error && (
          <div className="badge-rose">{decodeURIComponent(sp.error)}</div>
        )}
        <div>
          <label className="label">I am a</label>
          <select name="role" defaultValue={role} className="select">
            <option value="brand">Brand</option>
            <option value="influencer">Creator / Influencer</option>
          </select>
        </div>
        <div>
          <label className="label">Name</label>
          <input name="name" required className="input" />
        </div>
        <div>
          <label className="label">Email</label>
          <input name="email" type="email" required className="input" />
        </div>
        <div>
          <label className="label">Password</label>
          <input name="password" type="password" required minLength={8} className="input" />
        </div>
        <details className="rounded-lg ring-1 ring-slate-200 p-3 bg-slate-50">
          <summary className="text-sm font-medium cursor-pointer">Brand fields (optional)</summary>
          <div className="mt-3 space-y-3">
            <div>
              <label className="label">Company name</label>
              <input name="companyName" className="input" />
            </div>
            <div>
              <label className="label">Website</label>
              <input name="website" placeholder="https://" className="input" />
            </div>
          </div>
        </details>
        <button className="btn-primary w-full">Create account</button>
        <p className="text-sm text-slate-600">
          Have an account? <Link href="/sign-in" className="underline">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
