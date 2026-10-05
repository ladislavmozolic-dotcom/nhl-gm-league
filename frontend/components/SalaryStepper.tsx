"use client";

// Salary input ($M) with − / + buttons stepping $50K — same look as the term stepper.
// Plain text field with a decimal keypad (not type="number"): number inputs on phones
// wipe or reject half-typed values ("17," in a comma-decimal locale), which threw GMs
// out of the field after one digit. Accepts "17.9", "17,9" or a full dollar figure.
const STEP = 0.05;
const MIN = 0.775;
const DEFAULT_MAX = 25;

/** Millions from what the GM typed — "17.9", "17,9", "$17.9M" or a whole
 * dollar figure ("17 900 000"). NaN if unreadable. */
export function salaryMillions(raw: string): number {
  const compact = raw.trim().replace(/[$€Mm\s'_\u00a0]/g, "");
  // A single comma with no dot is a Slovak decimal separator. Commas in any
  // other form are thousands separators, so a pasted "$1,250,000" also works.
  const normalized = compact.includes(".") || (compact.match(/,/g)?.length ?? 0) > 1
    ? compact.replace(/,/g, "")
    : compact.replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return NaN;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return NaN;
  return n >= 1_000 ? n / 1_000_000 : n;
}

/** Whole dollars from what the GM typed, or NaN. */
export const salaryDollars = (raw: string): number => Math.round(salaryMillions(raw) * 1e6);

export function formatSalaryMillions(m: number): string {
  if (!Number.isFinite(m)) return "";
  const dollars = Math.round(m * 1e6);
  const roundedM = dollars / 1e6;
  return dollars % 10_000 !== 0 ? roundedM.toFixed(3) : roundedM.toFixed(2);
}

export function formatSalaryDisplay(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const d = Math.round(n);
  const m = d / 1e6;
  return `$${d % 10_000 !== 0 ? m.toFixed(3) : m.toFixed(2)}M`;
}

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
    onChange(formatSalaryMillions(next));
  };
  const btn = "w-9 h-9 shrink-0 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-lg leading-none";
  return (
    <div className="flex items-center gap-1">
      <button type="button" aria-label="−$50K" onClick={() => bump(-1)} className={btn}>−</button>
      <input
        type="text" inputMode="decimal" autoComplete="off" placeholder="e.g. 17.9M or 17 900 000" value={value}
        aria-label="Salary per year in millions or dollars"
        title="Type a salary directly: 17.9, 17,9, $17.9M or 17 900 000"
        // Keep every keystroke. The former character gate made normal editing
        // and pasting feel broken whenever a GM used a currency sign, spaces or
        // a thousands separator. Validation remains at submit time.
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); e.currentTarget.focus(); }}
        onFocus={(e) => e.stopPropagation()}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => { const m = salaryMillions(value); if (Number.isFinite(m) && value.trim() !== "") onChange(formatSalaryMillions(m)); }}
        className="min-h-10 min-w-0 flex-1 px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-base sm:text-sm tabular-nums text-center outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20" />
      <button type="button" aria-label="+$50K" onClick={() => bump(1)} className={btn}>+</button>
    </div>
  );
}
