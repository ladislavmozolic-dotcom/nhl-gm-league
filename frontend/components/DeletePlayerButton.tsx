"use client";

import { useTransition } from "react";
import { deletePlayer } from "@/app/admin/contracts/actions";

/** Irreversible — asks twice (native confirm, then re-type the name) before calling
 *  the server action directly (not a form submit, so the JS confirm gate can't be
 *  bypassed by pressing Enter in a field). */
export default function DeletePlayerButton({ slug, name }: { slug: string; name: string }) {
  const [pending, start] = useTransition();
  const onClick = () => {
    if (!confirm(`Permanently delete ${name}? This removes him from the database entirely — his game history, contract and stats are gone. This cannot be undone.`)) return;
    const typed = prompt(`Type the player's name to confirm: ${name}`);
    if (typed !== name) { if (typed !== null) alert("Name didn't match — nothing deleted."); return; }
    start(async () => { await deletePlayer(slug); });
  };
  return (
    <button type="button" onClick={onClick} disabled={pending}
      className="text-xs px-3 py-1.5 rounded-lg bg-red-950/70 hover:bg-red-900 text-red-300 font-medium disabled:opacity-50">
      {pending ? "Deleting…" : "🗑 Delete Player"}
    </button>
  );
}
