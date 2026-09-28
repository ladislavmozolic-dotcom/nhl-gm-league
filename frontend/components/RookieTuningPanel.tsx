"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveLiveCalculatorConfigAction } from "@/lib/live-calculator-actions";
import { DEFAULT_ROOKIE_PENALTY_BANDS, type RookiePenaltyBand } from "@/lib/edge-params";

/** Admin/manager-only "Tuning" button + modal for the Rookie Calculator's small-
 *  sample humility bands (rookieSamplePenalty). Stored alongside every other Live
 *  Calculator weight (LiveCalcConfig.weightsJson.rookie), so it survives redeploys
 *  and applies everywhere the penalty is used: the preview-free main table, the
 *  "Activate rating" write, and any future rookie promotion path. */
export default function RookieTuningPanel({ initialBands }: { initialBands: RookiePenaltyBand[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [bands, setBands] = useState<RookiePenaltyBand[]>(initialBands.length ? initialBands : DEFAULT_ROOKIE_PENALTY_BANDS);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const setBand = (i: number, field: "gp" | "penalty", raw: string) => {
    const n = Number(raw);
    if (raw !== "" && !Number.isFinite(n)) return;
    setBands((prev) => prev.map((b, idx) => (idx === i ? { ...b, [field]: raw === "" ? b[field] : n } : b)));
  };

  const save = () => start(async () => {
    setMsg(null);
    try {
      const sorted = [...bands].sort((a, b) => a.gp - b.gp);
      await saveLiveCalculatorConfigAction({ weights: { rookie: { penaltyBands: sorted } } });
      setBands(sorted);
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
            <p className="text-xs text-slate-500 mb-4">
              Dodatočný odpočet za malú vzorku zápasov na CK/SC/PA/DF (nad rámec bežnej regresie k priemeru) — čím menej reálnych zápasov
              (NHL + AHL spolu) hráč má, tým väčší odpočet z počítaného ratingu.
            </p>
            <div className="space-y-2 mb-3">
              <div className="grid grid-cols-[1fr_1fr] gap-3 text-[11px] uppercase text-slate-500">
                <span>Pod toľko zápasov (GP)</span>
                <span>Odpočet (body)</span>
              </div>
              {bands.map((b, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr] gap-3">
                  <input type="number" min={1} value={b.gp} onChange={(e) => setBand(i, "gp", e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
                  <input type="number" min={0} max={50} value={b.penalty} onChange={(e) => setBand(i, "penalty", e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mb-4">Nad najvyšší GP prah sa už žiadny odpočet neaplikuje (0).</p>
            <div className="flex items-center justify-between">
              <button onClick={() => setBands(DEFAULT_ROOKIE_PENALTY_BANDS)} className="text-xs text-slate-500 hover:text-slate-300 underline">
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
