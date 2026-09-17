"use client";

import { useState } from "react";
import { saveCapProjection, resetCapProjection } from "./actions";
import { money } from "@/lib/finance";

// Real NHL data + estimates pre-filled as reference
const NHL_REFERENCE: Record<number, { upper: number; lower: number; note: string }> = {
  2026: { upper: 104_000_000, lower: 76_900_000, note: "Confirmed by NHL/NHLPA" },
  2027: { upper: 113_500_000, lower: 83_900_000, note: "Confirmed by NHL/NHLPA" },
  2028: { upper: 123_000_000, lower: 91_000_000, note: "Estimated" },
  2029: { upper: 132_500_000, lower: 98_000_000, note: "Estimated" },
  2030: { upper: 142_000_000, lower: 105_000_000, note: "Estimated" },
};

type Row = { year: number; upperLimit: number; lowerLimit: number; note: string | null };

export function CapProjectionEditor({ rows, currentUpper, currentLower }: { rows: Row[]; currentUpper: number; currentLower: number }) {
  const years = [2026, 2027, 2028, 2029, 2030];

  return (
    <div className="space-y-3">
      {years.map((year) => {
        const saved = rows.find((r) => r.year === year);
        const ref = NHL_REFERENCE[year];
        return (
          <SeasonRow
            key={year}
            year={year}
            saved={saved ?? null}
            ref_={ref}
            currentUpper={currentUpper}
            currentLower={currentLower}
          />
        );
      })}
    </div>
  );
}

function SeasonRow({
  year,
  saved,
  ref_,
  currentUpper,
  currentLower,
}: {
  year: number;
  saved: Row | null;
  ref_: { upper: number; lower: number; note: string };
  currentUpper: number;
  currentLower: number;
}) {
  const defaultUpper = saved?.upperLimit ?? currentUpper;
  const defaultLower = saved?.lowerLimit ?? currentLower;
  const defaultNote = saved?.note ?? "";

  const [upper, setUpper] = useState(String(defaultUpper));
  const [lower, setLower] = useState(String(defaultLower));
  const [note, setNote] = useState(defaultNote);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "reset">("idle");

  const seasonLabel = `${year}-${String((year + 1) % 100).padStart(2, "0")}`;
  const isCustom = saved !== null;
  const upperNum = parseInt(upper.replace(/\D/g, ""), 10) || 0;
  const lowerNum = parseInt(lower.replace(/\D/g, ""), 10) || 0;

  async function handleSave() {
    setSaving(true);
    await saveCapProjection(year, upperNum, lowerNum, note);
    setSaving(false);
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 2000);
  }

  async function handleReset() {
    setSaving(true);
    await resetCapProjection(year);
    setUpper(String(currentUpper));
    setLower(String(currentLower));
    setNote("");
    setSaving(false);
    setStatus("reset");
    setTimeout(() => setStatus("idle"), 2000);
  }

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${isCustom ? "border-blue-700/50 bg-blue-950/10" : "border-slate-800 bg-slate-900/40"}`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <span className="font-bold text-slate-200">{seasonLabel}</span>
          {isCustom ? (
            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-blue-600/30 border border-blue-600/50 text-blue-300 font-semibold">CUSTOM</span>
          ) : (
            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 border border-slate-700 text-slate-400">FALLBACK (current settings)</span>
          )}
        </div>
        <div className="text-xs text-slate-500 text-right">
          🏒 NHL real: <span className="text-slate-300">{money(ref_.upper)}</span> / <span className="text-slate-400">{money(ref_.lower)}</span>
          <span className="ml-1 text-slate-600">({ref_.note})</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Upper Limit (cap ceiling)</label>
          <input
            type="text"
            value={upper}
            onChange={(e) => setUpper(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm tabular-nums text-slate-100 focus:border-blue-500 focus:outline-none"
            placeholder="e.g. 88000000"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Lower Limit (cap floor)</label>
          <input
            type="text"
            value={lower}
            onChange={(e) => setLower(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm tabular-nums text-slate-100 focus:border-blue-500 focus:outline-none"
            placeholder="e.g. 63000000"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
            placeholder="e.g. Confirmed, or Estimated"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {isCustom && (
          <button
            onClick={handleReset}
            disabled={saving}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold border border-slate-700 text-slate-400 hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            Reset to fallback
          </button>
        )}
        {status === "saved" && <span className="text-xs text-emerald-400">✓ Saved</span>}
        {status === "reset" && <span className="text-xs text-slate-400">↩ Reset to fallback</span>}

        {/* Preview */}
        {upperNum > 0 && lowerNum > 0 && (
          <span className="text-xs text-slate-500 ml-auto">
            Preview: <span className="text-slate-300">{money(upperNum)}</span> / <span className="text-slate-400">{money(lowerNum)}</span>
          </span>
        )}
      </div>
    </div>
  );
}
