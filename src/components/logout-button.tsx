"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      className="btn-ghost"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          router.push("/");
          router.refresh();
        })
      }
    >
      {pending ? "…" : "Sign out"}
    </button>
  );
}
