"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { revertSigningAction } from "@/app/admin/signings/actions";
import { friendlyActionError } from "@/lib/client/action-error";

export default function RevertSigningButton({ logId, name }: { logId: number; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const handleRevert = () => {
    if (!confirm(`Revert the signing of ${name} to his previous contract?`)) return;
    setErr(null);

    start(async () => {
      try {
        // Direct API call avoids Next.js Server Action hash mismatches across redeploys
        const res = await fetch("/api/admin/signings/revert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logId }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.ok) {
            router.refresh();
            return;
          }
          setErr(data.error ?? "Failed to revert signing.");
          return;
        }

        // If the API endpoint fails (e.g. 404 or 500), fallback to Server Action
        const actionRes = await revertSigningAction(logId);
        if (actionRes.ok) {
          router.refresh();
        } else {
          setErr(actionRes.error ?? "Failed to revert signing.");
        }
      } catch (e: any) {
        setErr(friendlyActionError(e));
      }
    });
  };

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        disabled={pending}
        onClick={handleRevert}
        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold whitespace-nowrap transition-colors"
      >
        {pending ? "Reverting…" : "Revert"}
      </button>
      {err && (
        <span className="text-[11px] text-rose-400 max-w-[220px] text-right font-medium leading-tight">
          {err}
        </span>
      )}
    </span>
  );
}
