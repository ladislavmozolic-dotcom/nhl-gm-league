"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markForumSeen } from "@/app/forum/actions";

export default function MarkAllReadButton() {
  const [pending, start] = useTransition();
  const router = useRouter();

  const handleClick = () => {
    start(async () => {
      await markForumSeen();
      router.refresh();
    });
  };

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      title="Označiť všetky diskusie a príspevky za prečítané"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-all shadow-sm cursor-pointer disabled:opacity-50"
    >
      <span>✓</span>
      <span>{pending ? "Označujem…" : "Označiť všetko ako prečítané"}</span>
    </button>
  );
}
