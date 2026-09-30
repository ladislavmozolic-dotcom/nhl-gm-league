"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetResignAction } from "@/app/admin/agent/actions";
import { friendlyActionError } from "@/lib/client/action-error";

export default function ResetResignButton({
  playerId,
  name,
  label = "Reset",
}: {
  playerId: number;
  name: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const handleReset = () => {
    if (!confirm(`Vymazať rozpracované vyjednávanie / ponuku pre hráča ${name}?`)) return;
    setErr(null);
    start(async () => {
      try {
        const r = await resetResignAction(playerId, true);
        if (!r.ok) {
          setErr(r.error ?? "Failed");
        } else {
          router.refresh();
        }
      } catch (e) {
        const msg = friendlyActionError(e);
        if (/out of date/i.test(msg)) {
          window.location.reload();
        } else {
          setErr(msg);
        }
      }
    });
  };

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <button
        disabled={pending}
        onClick={handleReset}
        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold whitespace-nowrap shadow-sm transition"
      >
        {pending ? "Mažem…" : label}
      </button>
      {err && <span className="text-[10px] text-rose-400 font-medium">{err}</span>}
    </span>
  );
}
