"use client";

import type { FormationRole } from "@/lib/sim/formation-layout";

type SlotPlayer = { id: number; name: string; isD: boolean } | null;

/** Offensive-zone rink diagram showing where each of the GM's chosen PP/PK
 *  personnel lines up for the selected formation — role[i] is a FIXED seat
 *  tied to personnel slot i (see formation-layout.ts's header comment), so
 *  `players` must be index-aligned with `roles` (a `null` entry is an empty
 *  seat), not a compacted list of just the filled ones. Purely illustrative:
 *  it mirrors what the picker table shows, it doesn't feed the sim engine —
 *  that reads the team/unit's chosen STYLE directly, not this per-seat map.
 *  `accent` tints the pucks/ring so PP1/PP2/PK1/PK2 read apart at a glance.
 *  `goalAtTop` flips which edge is the goal line: PP is drawn attacking
 *  (goal at the top, blue line at the bottom) while PK defends its own net
 *  (goal at the bottom, blue line at the top) — see the role.y comment
 *  below for how this swaps the y-mapping. */
export default function RinkFormationMap({ roles, players, accent = "#2563eb", goalAtTop = false }: { roles: FormationRole[]; players: SlotPlayer[]; accent?: string; goalAtTop?: boolean }) {
  const assigned = roles.map((role, i) => ({ role, player: players[i] ?? null }));
  const gid = `puckGrad-${accent.replace("#", "")}`;
  const iid = `iceGrad-${accent.replace("#", "")}`;

  return (
    <div className="rounded-lg overflow-hidden border border-slate-800 bg-slate-900/40">
      <svg viewBox="0 0 100 100" className="w-full max-w-xs mx-auto block" role="img" aria-label="Formation diagram">
        <defs>
          <radialGradient id={iid} cx="50%" cy="30%" r="85%">
            <stop offset="0%" stopColor="#132038" />
            <stop offset="100%" stopColor="#080f1e" />
          </radialGradient>
          <radialGradient id={gid} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor={accent} stopOpacity="1" />
            <stop offset="100%" stopColor="#0b1424" stopOpacity="1" />
          </radialGradient>
        </defs>
        <rect x="1" y="1" width="98" height="98" rx="14" fill={`url(#${iid})`} stroke="#243347" strokeWidth="1" />
        {/* faceoff circles + dots, drawn first so pucks sit on top */}
        <circle cx="24" cy="54" r="11" fill="none" stroke="#26374f" strokeWidth="0.8" />
        <circle cx="76" cy="54" r="11" fill="none" stroke="#26374f" strokeWidth="0.8" />
        <circle cx="24" cy="54" r="1" fill="#26374f" />
        <circle cx="76" cy="54" r="1" fill="#26374f" />
        {goalAtTop ? (
          <>
            {/* goal crease */}
            <path d="M 42 8 L 42 2 L 58 2 L 58 8 Q 50 22 42 8 Z" fill="#1a2c47" stroke="#3b5578" strokeWidth="0.6" />
            {/* blue line */}
            <line x1="4" y1="92" x2="96" y2="92" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
            <line x1="4" y1="92.9" x2="96" y2="92.9" stroke="#3b82f6" strokeWidth="0.6" strokeOpacity="0.4" />
            {/* goal line */}
            <line x1="4" y1="8" x2="96" y2="8" stroke="#dc2626" strokeWidth="1" strokeOpacity="0.85" />
          </>
        ) : (
          <>
            {/* goal crease */}
            <path d="M 42 92 L 42 98 L 58 98 L 58 92 Q 50 78 42 92 Z" fill="#1a2c47" stroke="#3b5578" strokeWidth="0.6" />
            {/* blue line */}
            <line x1="4" y1="8" x2="96" y2="8" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
            <line x1="4" y1="7.1" x2="96" y2="7.1" stroke="#3b82f6" strokeWidth="0.6" strokeOpacity="0.4" />
            {/* goal line */}
            <line x1="4" y1="92" x2="96" y2="92" stroke="#dc2626" strokeWidth="1" strokeOpacity="0.85" />
          </>
        )}
        {/* role.y: 0 = goal line, 100 = blue line. PP attacks (goalAtTop),
            so the goal sits at svg y=8 and role.y maps DIRECTLY to svg y — a
            low role.y (net-front) stays near the top. PK defends its own
            net (goal at svg y=92), so role.y maps INVERTED (svgY = 100 -
            role.y) — a low role.y (net-front) lands near the bottom by the
            crease, a high role.y (point) stays up near the blue line. */}
        {assigned.map(({ role, player }) => {
          const svgY = goalAtTop ? role.y : 100 - role.y;
          return (
            <g key={role.key}>
              <text x={role.x} y={svgY - 9.5} textAnchor="middle" fontSize="3.4" fill="#7c8ba3" fontWeight="600" letterSpacing="0.2">
                {role.label.toUpperCase()}
              </text>
              {player ? (
                <>
                  <circle cx={role.x} cy={svgY + 0.6} r="6.8" fill="#000" fillOpacity="0.35" />
                  <circle cx={role.x} cy={svgY} r="6.8" fill={`url(#${gid})`} stroke={accent} strokeWidth="0.9" />
                  <circle cx={role.x} cy={svgY} r="6.8" fill="none" stroke="#fff" strokeOpacity="0.15" strokeWidth="0.5" />
                  {player.isD && <circle cx={role.x + 5.2} cy={svgY - 4.8} r="2.3" fill="#0f172a" stroke={accent} strokeWidth="0.5" />}
                  {player.isD && <text x={role.x + 5.2} y={svgY - 3.9} textAnchor="middle" fontSize="2.6" fill="#cbd5e1" fontWeight="700">D</text>}
                  <text x={role.x} y={svgY + 1.8} textAnchor="middle" fontSize="4.6" fill="#f8fafc" fontWeight="700">
                    {player.name.split(" ").slice(-1)[0].slice(0, 9)}
                  </text>
                </>
              ) : (
                <>
                  <circle cx={role.x} cy={svgY} r="6.8" fill="none" stroke="#334155" strokeWidth="0.8" strokeDasharray="1.6 1.4" />
                  <text x={role.x} y={svgY + 1.8} textAnchor="middle" fontSize="6" fill="#334155">?</text>
                </>
              )}
            </g>
          );
        })}
      </svg>
      {players.every((p) => !p) && <p className="text-xs text-slate-500 text-center py-2">Pick your personnel above to see the formation.</p>}
    </div>
  );
}
