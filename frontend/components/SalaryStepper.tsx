"use client";

// Salary input ($M) with − / + buttons stepping $50K — same look as the term stepper.
// Plain text field with a decimal keypad (not type="number"): number inputs on phones
// wipe or reject half-typed values ("17," in a comma-decimal locale), which threw GMs
// out of the field after one digit. Accepts "17.9", "17,9" or a full dollar figure.
const STEP = 0.05;
const MIN = 0.775;
const DEFAULT_MAX = 25;

/** Millions from what the GM typed — "17.9", "17,9" or a whole dollar figure ("17900000"). NaN if unreadable. */
export function salaryMillions(raw: string): number {
  const n = parseFloat(raw.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n)) return NaN;
  return n >= 1_000 ? n / 1_000_000 : n;
}

/** Whole dollars from what the GM typed, or NaN. */
export const salaryDollars = (raw: string): number => Math.round(salaryMillions(raw) * 1e6);

export default function SalaryStepper({ value, onChange, max = DEFAULT_MAX }: { value: string; onChange: (v: string) => void; max?: number }) {
  const bump = (dir: 1 | -1) => {
    const cur = salaryMillions(value);
    let next: number;
    if (!Number.isFinite(cur)) next = MIN;
    else {
      // off the $50K grid (e.g. the 0.775 minimum) → snap to the next grid line that way
      const snapped = (dir === 1 ? Math.floor(cur / STEP + 1e-9) : Math.ceil(cur / STEP - 1e-9)) * STEP;
      next = snapped + dir * STEP;
    }
    next = Math.max(MIN, Math.min(max, next));
    onChange(Math.abs(next - MIN) < 1e-9 ? MIN.toFixed(3) : next.toFixed(2));
  };
  const btn = "w-9 h-9 shrink-0 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-lg leading-none";
  return (
    <div className="flex items-center gap-1">
      <button type="button" aria-label="−$50K" onClick={() => bump(-1)} className={btn}>−</button>
      <input
        type="text" inputMode="decimal" autoComplete="off" placeholder="e.g. 17.9 or 17900000" value={value}
        onChange={(e) => { const v = e.target.value.replace(",", "."); if (/^\d*\.?\d*$/.test(v)) onChange(v); }}
        onBlur={() => { const m = salaryMillions(value); if (Number.isFinite(m) && value !== "") onChange(m.toFixed(m === MIN ? 3 : 2)); }}
        className="w-full min-w-0 px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-base sm:text-sm tabular-nums text-center" />
      <button type="button" aria-label="+$50K" onClick={() => bump(1)} className={btn}>+</button>
    </div>
  );
}
