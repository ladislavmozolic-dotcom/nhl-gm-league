"use client";

import { useState, useTransition } from "react";
import { resolveCondition } from "@/app/admin/conditions/actions";

export default function ConditionActions({ id, status }: { id: number; status: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const run = (s: "FULFILLED" | "EXPIRED" | "PENDING") => start(async () => {
    setErr(null);
    try { await resolveCondition(id, s); } catch (e) { setErr((e as Error).message); }
  });
  return (
    <div className="flex items-center gap-2 justify-end flex-wrap">
      {status !== "FULFILLED" && (
        <button onClick={() => run("FULFILLED")} disabled={pending}
          className="px-3 py-1 rounded bg-green-600 hover:bg-green-500 text-white text-xs font-semibold disabled:opacity-40">Mark fulfilled</button>
      )}
      {status === "PENDING" && (
        <button onClick={() => run("EXPIRED")} disabled={pending}
          className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold disabled:opacity-40">Expire</button>
      )}
      {status !== "PENDING" && (
        <button onClick={() => run("PENDING")} disabled={pending}
          className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold disabled:opacity-40">Reopen</button>
      )}
      {err && <span className="text-red-400 text-xs">{err}</span>}
    </div>
  );
}
