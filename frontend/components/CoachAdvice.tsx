"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { applyCoachSuggestionAction } from "@/app/teams/[slug]/tactics/actions";
import type { CoachSuggestion } from "@/lib/coach-advice";

const PRE: Record<string, string> = { confident: "The coach is confident:", leaning: "The coach is leaning:", hunch: "The coach's hunch:" };

export default function CoachAdvice({ teamId, suggestions, canManage }: { teamId: number; suggestions: CoachSuggestion[]; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  if (suggestions.length === 0) {
    return (
      <Card title="Coach Advice" accent="text-sky-400">
        <p className="text-sm text-slate-400">The coach is happy with the current system — it fits the group.</p>
        <p className="mt-1 text-[11px] text-slate-600">Advice is his read of the roster, not a solver — and he can be wrong.</p>
      </Card>
    );
  }

  const apply = (s: CoachSuggestion) => start(async () => {
    setMsg(null);
    const r = await applyCoachSuggestionAction(teamId, s.dial as string, s.to);
    if (r.ok) { setMsg(`Applied: ${s.toLabel}.`); router.refresh(); }
    else setMsg(r.error ?? "Failed.");
  });

  return (
    <Card title="Coach Advice" accent="text-sky-400">
      <div className="space-y-3">
        {suggestions.map((s, i) => (
          <div key={i} className="flex items-start gap-3 flex-wrap">
            <p className="flex-1 min-w-[220px] text-sm text-slate-300">
              <span className="text-sky-300">{PRE[s.confidence]}</span> consider <b className="text-white">{s.toLabel}</b> — {s.reason}
            </p>
            {canManage && (
              <button onClick={() => apply(s)} disabled={pending}
                className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 font-semibold">
                Apply suggestion
              </button>
            )}
          </div>
        ))}
      </div>
      {msg && <p className="mt-3 text-sm text-emerald-400">{msg}</p>}
      <p className="mt-3 text-[11px] text-slate-600">Just the coach&apos;s opinion, shaped by his own experience — never a guaranteed-best answer.</p>
    </Card>
  );
}
