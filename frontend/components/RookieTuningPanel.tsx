"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveLiveCalculatorConfigAction } from "@/lib/live-calculator-actions";
import { DEFAULT_ROOKIE_TUNING, type RookieTuningConfig } from "@/lib/edge-params";

const PARAM_COLS = ["CK", "FG", "DI", "SK", "ST", "EN", "DU", "PH", "FO", "PA", "SC", "DF", "PS", "EX", "LD", "OV"];

/** Admin/manager-only "Tuning" panel for the Rookie Calculator — deliberately
 *  scoped to ONLY this feature (never the shared Next Gen/Edge engine that also
 *  powers the league-wide Next Gen Parameters calculator), with the same kind of
 *  multi-section depth as the Live Calculator's own tuning modal:
 *   1. Small-sample penalty bands (GP threshold → point discount)
 *   2. Which of the 16 rating params take that discount
 *   3. The floor a penalized param can't drop below
 *   4. The debutant scanner's minimum real-GP filter
 *  Stored alongside every other Live Calculator weight
 *  (LiveCalcConfig.weightsJson.rookie), so it survives redeploys and applies
 *  everywhere the config is read: the main table, "Activate rating", and the
 *  debutant scanner. */
export default function RookieTuningPanel({ initialConfig }: { initialConfig: RookieTuningConfig }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<RookieTuningConfig>(initialConfig);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const setBand = (i: number, field: "gp" | "penalty", raw: string) => {
    const n = Number(raw);
    if (raw !== "" && !Number.isFinite(n)) return;
    setConfig((c) => ({
      ...c,
      penaltyBands: c.penaltyBands.map((b, idx) => (idx === i ? { ...b, [field]: raw === "" ? b[field] : n } : b)),
    }));
  };

  const toggleParam = (k: string) => {
    setConfig((c) => ({
      ...c,
      penaltyParams: c.penaltyParams.includes(k) ? c.penaltyParams.filter((p) => p !== k) : [...c.penaltyParams, k],
    }));
  };

  const setNum = (field: "penaltyFloor" | "minScanGp", raw: string) => {
    const n = Number(raw);
    if (raw !== "" && !Number.isFinite(n)) return;
    setConfig((c) => (raw === "" ? c : { ...c, [field]: n }));
  };

  const save = () => start(async () => {
    setMsg(null);
    try {
      const clean: RookieTuningConfig = { ...config, penaltyBands: [...config.penaltyBands].sort((a, b) => a.gp - b.gp) };
      await saveLiveCalculatorConfigAction({ weights: { rookie: clean } });
      setConfig(clean);
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
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-1">Rookie Calculator — Tuning</h3>
            <p className="text-xs text-slate-500 mb-5">
              Tieto voľby ovplyvňujú výhradne Rookie Calculator (skener + tabuľka prospektov) — nemenia Next Gen Parameters engine
              pre zvyšok ligy.
            </p>

            <section className="mb-5">
              <h4 className="text-sm font-semibold text-slate-200 mb-1">1. Malá vzorka — pásma odpočtu</h4>
              <p className="text-xs text-slate-500 mb-2">
                Čím menej reálnych zápasov (NHL + AHL spolu) hráč má, tým väčší odpočet z počítaného ratingu — nad rámec bežnej
                regresie k priemeru, ktorú engine robí sám.
              </p>
              <div className="grid grid-cols-[1fr_1fr] gap-3 text-[11px] uppercase text-slate-500 mb-1">
                <span>Pod toľko zápasov (GP)</span>
                <span>Odpočet (body)</span>
              </div>
              <div className="space-y-1.5">
                {config.penaltyBands.map((b, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr] gap-3">
                    <input type="number" min={1} value={b.gp} onChange={(e) => setBand(i, "gp", e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
                    <input type="number" min={0} max={50} value={b.penalty} onChange={(e) => setBand(i, "penalty", e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-600 mt-1">Nad najvyšší GP prah sa už žiadny odpočet neaplikuje (0).</p>
            </section>

            <section className="mb-5">
              <h4 className="text-sm font-semibold text-slate-200 mb-1">2. Ktoré parametre sa penalizujú</h4>
              <p className="text-xs text-slate-500 mb-2">Predvolene CK/SC/PA/DF — pridaj alebo odober ktorýkoľvek parameter.</p>
              <div className="flex flex-wrap gap-2">
                {PARAM_COLS.map((k) => (
                  <button key={k} type="button" onClick={() => toggleParam(k)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${
                      config.penaltyParams.includes(k)
                        ? "bg-blue-600/80 border-blue-500 text-white"
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500"
                    }`}>
                    {k}
                  </button>
                ))}
              </div>
            </section>

            <section className="mb-5">
              <h4 className="text-sm font-semibold text-slate-200 mb-1">3. Floor po penalizácii</h4>
              <p className="text-xs text-slate-500 mb-2">Penalizovaný parameter nikdy nespadne pod túto hodnotu.</p>
              <input type="number" min={1} max={99} value={config.penaltyFloor} onChange={(e) => setNum("penaltyFloor", e.target.value)}
                className="w-24 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
            </section>

            <section className="mb-2">
              <h4 className="text-sm font-semibold text-slate-200 mb-1">4. Filter skenera</h4>
              <p className="text-xs text-slate-500 mb-2">
                Minimálny počet reálnych zápasov (NHL + AHL spolu), aby sa hráč vôbec objavil (a automaticky založil) v skeneri
                chýbajúcich debutantov.
              </p>
              <input type="number" min={0} value={config.minScanGp} onChange={(e) => setNum("minScanGp", e.target.value)}
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
