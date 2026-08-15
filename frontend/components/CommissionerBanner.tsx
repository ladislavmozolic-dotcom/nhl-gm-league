"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markAnnouncementReadAction } from "@/app/admin/announcements/actions";

export type BannerItem = { id: number; body: string; linkUrl: string | null; linkLabel: string | null; date: string; unread: boolean };

// linkUrl is validated at post time (internal path or http(s) only) — here we just
// pick the right element: internal Link vs external anchor.
function AnnouncementLink({ url, label }: { url: string; label: string | null }) {
  const text = label || "click here";
  if (url.startsWith("/")) return <Link href={url} className="font-semibold text-blue-300 hover:text-blue-200 underline">{text}</Link>;
  return <a href={url} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-300 hover:text-blue-200 underline">{text}</a>;
}

export default function CommissionerBanner({ items, signedIn }: { items: BannerItem[]; signedIn: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (items.length === 0) return null;
  const markRead = (id: number) => start(async () => { await markAnnouncementReadAction(id); router.refresh(); });

  return (
    <div className="space-y-2 mb-5">
      {items.map((a) => (
        <div key={a.id} className={`rounded-2xl border px-4 py-3 ${a.unread ? "border-amber-500/50 bg-amber-500/10" : "border-slate-800 bg-slate-900/60"}`}>
          <div className="flex items-start gap-3">
            <span className="text-lg leading-none mt-0.5">📣</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-widest text-amber-400/90 font-semibold">Commissioner</span>
                {a.unread && signedIn && <span className="text-[10px] font-bold text-slate-950 bg-amber-400 rounded px-1.5 py-0.5">NEW</span>}
                <span className="text-[11px] text-slate-500 ml-auto">{a.date}</span>
              </div>
              <div className="text-sm text-slate-100 mt-1 whitespace-pre-wrap break-words">
                {a.body}
                {a.linkUrl && <> <AnnouncementLink url={a.linkUrl} label={a.linkLabel} /></>}
              </div>
              {signedIn && a.unread && (
                <button onClick={() => markRead(a.id)} disabled={pending} className="mt-2 text-xs text-slate-400 hover:text-slate-200 underline">
                  Mark as read
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
