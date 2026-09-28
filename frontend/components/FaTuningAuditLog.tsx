"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui";
import { recentFaAuditAction, type AuditRow } from "@/app/admin/fa-tuning/actions";

export default function FaTuningAuditLog({ initial }: { initial: AuditRow[] }) {
  const [rows, setRows] = useState(initial);
  const [pending, start] = useTransition();

  const refresh = () => start(async () => setRows(await recentFaAuditAction()));

  return (
    <Card
      title="Recent Changes"
      accent="text-slate-300"
      right={<button onClick={refresh} disabled={pending} className="text-xs text-slate-400 hover:text-blue-400">{pending ? "…" : "refresh"}</button>}
    >
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No tuning changes logged yet.</p>
      ) : (
        <div className="divide-y divide-slate-800/50">
          {rows.map((r) => (
            <div key={r.id} className="py-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-slate-200">{r.summary}</span>
                <span className="text-xs text-slate-500 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</span>
              </div>
              <div className="text-xs text-slate-500">by {r.byName}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
