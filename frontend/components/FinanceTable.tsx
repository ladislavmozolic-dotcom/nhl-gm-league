"use client";

import { useState } from "react";
import Link from "next/link";
import { money } from "@/lib/finance";

export type FinanceRow = {
  id: number; name: string; slug: string; logoUrl: string | null;
  popularity: number; actualIncome: number; projectedIncome: number;
  actualExpenses: number; projectedExpenses: number; projectedResult: number;
  bankAccount: number; projectedBankAccount: number;
};

type Col = { key: keyof FinanceRow; label: string; money?: boolean };
const COLS: Col[] = [
  { key: "popularity", label: "Popularity" },
  { key: "actualIncome", label: "Actual Income", money: true },
  { key: "projectedIncome", label: "Projected Income", money: true },
  { key: "actualExpenses", label: "Actual Expenses", money: true },
  { key: "projectedExpenses", label: "Projected Expenses", money: true },
  { key: "projectedResult", label: "Projected Result", money: true },
  { key: "bankAccount", label: "Bank Account", money: true },
  { key: "projectedBankAccount", label: "Projected Bank", money: true },
];

export default function FinanceTable({ rows }: { rows: FinanceRow[] }) {
  const [sort, setSort] = useState<{ key: keyof FinanceRow; dir: 1 | -1 }>({ key: "bankAccount", dir: -1 });

  const sorted = [...rows].sort((a, b) => {
    const av = a[sort.key], bv = b[sort.key];
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * sort.dir;
    return String(av).localeCompare(String(bv)) * sort.dir;
  });
  const click = (key: keyof FinanceRow) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: -1 }));
  const arrow = (key: keyof FinanceRow) => (sort.key === key ? (sort.dir === -1 ? " ▾" : " ▴") : "");

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-x-auto">
      <table className="w-full text-sm min-w-[900px]">
        <thead>
          <tr className="text-xs text-slate-500 border-b border-slate-800 bg-slate-800/40">
            <th onClick={() => click("name")} className="text-left px-4 py-2.5 cursor-pointer hover:text-slate-200 select-none">Team{arrow("name")}</th>
            {COLS.map((c) => (
              <th key={c.key} onClick={() => click(c.key)}
                className="text-right px-3 py-2.5 cursor-pointer hover:text-slate-200 select-none whitespace-nowrap">{c.label}{arrow(c.key)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => (
            <tr key={t.id} className="border-b border-slate-800/60 hover:bg-slate-800/30">
              <td className="px-4 py-2.5">
                <Link href={`/finance/${t.slug}`} className="flex items-center gap-2 hover:text-blue-400">
                  {t.logoUrl && <img src={t.logoUrl} alt="" className="w-6 h-6 object-contain" />}
                  <span className="font-medium">{t.name}</span>
                </Link>
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{t.popularity}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{money(t.actualIncome)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">{money(t.projectedIncome)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{money(t.actualExpenses)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">{money(t.projectedExpenses)}</td>
              <td className={`px-3 py-2.5 text-right tabular-nums ${t.projectedResult < 0 ? "text-red-400" : "text-green-400"}`}>{money(t.projectedResult)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-amber-300">{money(t.bankAccount)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">{money(t.projectedBankAccount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
