"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveLiveCalculatorConfigAction } from "@/lib/live-calculator-actions";
import { DEFAULT_ROOKIE_TUNING, type RookieTuningConfig } from "@/lib/edge-params";

/** Admin/manager-only "Tuning" panel for the Rookie Calculator. Deliberately
 *  minimal: rating computation itself (PA/SC/DF/CK/... and the small-sample
 *  "V10 Protection Rules" that dampen a tiny-sample debutant) runs entirely
 *  through the shared "Live Calculator — Nastavenia & Tuning" engine
 *  (lib/live-calculator-engine.ts) — the SAME engine and weights the rest of the
 *  league uses, tuned in exactly one place (that other modal, opened from the
 *  main /tools/player-calculator page). This panel only controls the one thing
 *  that's genuinely specific to the Rookie Calculator: which debutants the
 *  scanner even bothers surfacing/auto-creating. */
export default function RookieTuningPanel({ initialConfig }: { initialConfig: RookieTuningConfig }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<RookieTuningConfig>(initialConfig);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const setMinScanGp = (raw: string) => {
    const n = Number(raw);
    if (raw === "" || !Number.isFinite(n)) return;
    setConfig({ minScanGp: n });
  };

  const save = () => start(async () => {
    setMsg(null);
    try {
      await saveLiveCalculatorConfigAction({ weights: { rookie: config } });
      setMsg("Uložené ✓");
      router.refresh();
    } catch (e: any) {
      setMsg(e?.message ?? "Zlyhalo.");
    }
  });

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white whitespace-nowrap">
        ⚙️ Tuning
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-1">Rookie Calculator — Tuning</h3>
            <p className="text-xs text-slate-500 mb-5">
              Samotný rating (PA/SC/DF/CK/... aj ochrana pri malej vzorke zápasov) sa počíta rovnakým enginom ako zvyšok ligy —
              cez <b>Live Calculator — Nastavenia &amp; Tuning</b> na hlavnej stránke Live Calculatora. Táto voľba tu je jediná vec,
              čo je špecifická len pre Rookie Calculator.
            </p>

            <section className="mb-2">
              <h4 className="text-sm font-semibold text-slate-200 mb-1">Filter skenera</h4>
              <p className="text-xs text-slate-500 mb-2">
                Minimálny počet reálnych zápasov (NHL + AHL spolu), aby sa hráč vôbec objavil (a automaticky založil) v skeneri
                chýbajúcich debutantov.
              </p>
              <input type="number" min={0} value={config.minScanGp} onChange={(e) => setMinScanGp(e.target.value)}
                className="w-24 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
            </section>

            <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-800">
              <button onClick={() => setConfig(DEFAULT_ROOKIE_TUNING)} className="text-xs text-slate-500 hover:text-slate-300 underline">
                Obnoviť predvolené
              </button>
              <div className="flex items-center gap-2">
                {msg && <span className="text-xs text-slate-400">{msg}</span>}
                <button onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-lg text-sm bg-slate-800 text-slate-300 hover:bg-slate-700">Zavrieť</button>
                <button onClick={save} disabled={pending}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50">
                  {pending ? "Ukladám…" : "Uložiť"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
