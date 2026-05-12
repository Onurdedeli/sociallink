import Link from "next/link";
import { signInAction } from "./actions";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Sign in</h1>
      <form action={signInAction} className="card space-y-4">
        {sp.error && (
          <div className="badge-rose">Invalid credentials</div>
        )}
        <div>
          <label className="label">Email</label>
          <input name="email" type="email" required className="input" defaultValue="brand@demo.io" />
        </div>
        <div>
          <label className="label">Password</label>
          <input name="password" type="password" required className="input" defaultValue="demo1234" />
        </div>
        <button className="btn-primary w-full">Sign in</button>
        <p className="text-sm text-slate-600">
          New here? <Link href="/sign-up" className="underline">Create an account</Link>
        </p>
      </form>
    </div>
  );
}
