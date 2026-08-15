"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { postAnnouncementAction, setAnnouncementActiveAction, deleteAnnouncementAction } from "@/app/admin/announcements/actions";

export type AdminAnnouncement = { id: number; body: string; linkUrl: string | null; linkLabel: string | null; active: boolean; date: string; reads: number };

export default function AnnouncementManager({ items }: { items: AdminAnnouncement[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const post = () => start(async () => {
    setErr(null);
    const r = await postAnnouncementAction({ body, linkUrl: linkUrl || undefined, linkLabel: linkLabel || undefined });
    if (!r.ok) { setErr(r.error ?? "Failed."); return; }
    setBody(""); setLinkUrl(""); setLinkLabel("");
    router.refresh();
  });
  const toggle = (id: number, active: boolean) => start(async () => { await setAnnouncementActiveAction(id, active); router.refresh(); });
  const remove = (id: number) => start(async () => { await deleteAnnouncementAction(id); router.refresh(); });

  return (
    <div className="space-y-6">
      {/* composer */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="text-sm font-semibold text-slate-100">New commissioner announcement</div>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="e.g. 2027 Draft Lottery will start on 14.6.2027 at 20:00."
          className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none resize-y" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-slate-500">Link (optional) — internal path like <code className="text-slate-400">/draft/lottery</code> or a full URL</label>
            <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="/draft/lottery"
              className="mt-1 w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Link text (optional) — defaults to “click here”</label>
            <input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="click here"
              className="mt-1 w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none" />
          </div>
        </div>
        {err && <div className="text-sm text-rose-400">{err}</div>}
        <button onClick={post} disabled={pending || !body.trim()}
          className="rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold px-5 py-2 text-sm">
          {pending ? "Posting…" : "Post to the league"}
        </button>
        <div className="text-xs text-slate-500">Every GM gets it in their inbox and it appears on the home page.</div>
      </div>

      {/* list */}
      <div className="space-y-2">
        <div className="text-sm font-semibold text-slate-300">Posted announcements</div>
        {items.length === 0 && <div className="text-sm text-slate-500">None yet.</div>}
        {items.map((a) => (
          <div key={a.id} className={`rounded-xl border px-4 py-3 ${a.active ? "border-amber-500/30 bg-amber-500/5" : "border-slate-800 bg-slate-900/40 opacity-70"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-slate-100 whitespace-pre-wrap break-words">{a.body}</div>
                {a.linkUrl && <div className="text-xs text-blue-400 mt-1">→ {a.linkLabel || "click here"} <span className="text-slate-600">({a.linkUrl})</span></div>}
                <div className="text-[11px] text-slate-500 mt-1">{a.date} · read by {a.reads} GM{a.reads === 1 ? "" : "s"} · {a.active ? "active" : "retired"}</div>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <button onClick={() => toggle(a.id, !a.active)} disabled={pending} className="text-xs text-slate-300 hover:text-white underline">{a.active ? "Retire" : "Reactivate"}</button>
                <button onClick={() => remove(a.id)} disabled={pending} className="text-xs text-rose-400/80 hover:text-rose-300 underline">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
