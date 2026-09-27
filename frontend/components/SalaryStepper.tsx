"use client";

// Salary input ($M) with − / + buttons stepping $50K — same look as the term stepper.
const STEP = 0.05;
const MIN = 0.775;
const MAX = 16;

export default function SalaryStepper({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const bump = (dir: 1 | -1) => {
    const cur = parseFloat(value);
    let next: number;
    if (!Number.isFinite(cur)) next = MIN;
    else {
      // off the $50K grid (e.g. the 0.775 minimum) → snap to the next grid line that way
      const snapped = (dir === 1 ? Math.floor(cur / STEP + 1e-9) : Math.ceil(cur / STEP - 1e-9)) * STEP;
      next = snapped + dir * STEP;
    }
    next = Math.max(MIN, Math.min(MAX, next));
    onChange(Math.abs(next - MIN) < 1e-9 ? MIN.toFixed(3) : next.toFixed(2));
  };
  const btn = "w-9 h-9 shrink-0 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-lg leading-none";
  return (
    <div className="flex items-center gap-1">
      <button type="button" aria-label="−$50K" onClick={() => bump(-1)} className={btn}>−</button>
      <input type="number" step="0.05" min={MIN} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm tabular-nums text-center" />
      <button type="button" aria-label="+$50K" onClick={() => bump(1)} className={btn}>+</button>
    </div>
  );
}
