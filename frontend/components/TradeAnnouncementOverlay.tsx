"use client";

import { useEffect, useState } from "react";
import { recentTradeAnnouncementsAction, type TradeAnnouncement } from "@/app/trades/build/actions";

const KEY = "dismissedTradeAnnouncements";

const dismissed = (): number[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; } };
const remember = (ids: number[]) => {
  try { localStorage.setItem(KEY, JSON.stringify([...dismissed(), ...ids].slice(-100))); } catch { /* ignore */ }
};

export default function TradeAnnouncementOverlay() {
  const [items, setItems] = useState<TradeAnnouncement[] | null>(null);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const all = await recentTradeAnnouncementsAction();
        const seen = dismissed();
        const fresh = all.filter((t) => !seen.includes(t.id));
        if (alive && fresh.length) setItems(fresh);
      } catch { /* ignore */ }
    };
    check();
    const iv = setInterval(check, 20000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  if (!items || items.length === 0) return null;

  const close = () => { remember(items.map((t) => t.id)); setItems(null); };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={close}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-blue-500/40 bg-[#0a1420] p-6 shadow-2xl shadow-blue-500/10 max-h-[85vh] flex flex-col">
        <h2 className="text-lg font-black text-white mb-1 flex items-center gap-2">🔁 {items.length > 1 ? "New trades around the league" : "A new trade happened"}</h2>
        <p className="text-xs text-slate-400 mb-4">{items.length} deal{items.length > 1 ? "s" : ""} completed since your last visit.</p>
        <div className="space-y-3 overflow-y-auto mb-5 pr-1">
          {items.map((t) => (
            <div key={t.id} className="rounded-xl bg-slate-900/70 border border-slate-800 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
                {t.fromTeam?.logoUrl && <img src={t.fromTeam.logoUrl} alt="" className="w-5 h-5 object-contain" />}
                <span>{t.fromTeam?.name ?? "?"}</span>
                <span className="text-slate-600">⇄</span>
                {t.toTeam?.logoUrl && <img src={t.toTeam.logoUrl} alt="" className="w-5 h-5 object-contain" />}
                <span>{t.toTeam?.name ?? "?"}</span>
              </div>
              <p className="text-xs text-slate-400"><span className="text-slate-300">{t.fromTeam?.name ?? "?"}</span> sends: {t.fromLabels.length ? t.fromLabels.join(", ") : "nothing"}</p>
              <p className="text-xs text-slate-400"><span className="text-slate-300">{t.toTeam?.name ?? "?"}</span> sends: {t.toLabels.length ? t.toLabels.join(", ") : "nothing"}</p>
            </div>
          ))}
        </div>
        <button onClick={close} className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold">Got it</button>
      </div>
    </div>
  );
}
