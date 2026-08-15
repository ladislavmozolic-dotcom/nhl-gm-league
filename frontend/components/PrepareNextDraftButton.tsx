"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { prepareNextDraftAction } from "@/app/admin/season/actions";

export default function PrepareNextDraftButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = () => start(async () => {
    setMsg(null);
    const r = await prepareNextDraftAction();
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
    setMsg({ ok: true, text: r.imported > 0 ? `Imported the ${r.year} draft class (${r.imported} prospects).` : `The ${r.year} class isn't published by NHL Central Scouting yet — try again later.` });
    router.refresh();
  });

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button onClick={run} disabled={pending}
        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 font-semibold text-sm whitespace-nowrap">
        {pending ? "Importing…" : "Import upcoming class"}
      </button>
      {msg && <div className={`text-xs text-right max-w-xs ${msg.ok ? "text-emerald-400" : "text-amber-400"}`}>{msg.text}</div>}
    </div>
  );
}
