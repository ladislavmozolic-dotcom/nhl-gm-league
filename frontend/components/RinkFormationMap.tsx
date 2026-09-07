"use client";

import { assignRoles, type FormationRole, type RoleAttrs } from "@/lib/sim/formation-layout";

type SlotPlayer = { id: number; name: string; sc: number; pa: number; st: number };

/** Offensive-zone rink diagram showing where each of the GM's chosen PP/PK
 *  personnel would line up for the selected formation — the role each player
 *  gets is picked by best attribute fit (see formation-layout.ts), the same
 *  idea the sim engine itself uses to shape a PP formation's shot mix. Purely
 *  illustrative: it mirrors what the engine tends to do, it doesn't feed it. */
export default function RinkFormationMap({ roles, players }: { roles: FormationRole[]; players: SlotPlayer[] }) {
  const assigned = assignRoles<SlotPlayer & RoleAttrs>(roles, players as (SlotPlayer & RoleAttrs)[]);

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-3">
      <svg viewBox="0 0 100 100" className="w-full max-w-xs mx-auto block" role="img" aria-label="Formation diagram">
        <rect x="1" y="1" width="98" height="98" rx="14" fill="#0b1424" stroke="#334155" strokeWidth="1" />
        {/* blue line */}
        <line x1="4" y1="92" x2="96" y2="92" stroke="#3b82f6" strokeWidth="1.5" />
        {/* goal line + crease */}
        <line x1="4" y1="8" x2="96" y2="8" stroke="#64748b" strokeWidth="1" />
        <path d="M 42 8 Q 50 22 58 8" fill="none" stroke="#64748b" strokeWidth="1" />
        {/* faceoff circles */}
        <circle cx="24" cy="46" r="11" fill="none" stroke="#334155" strokeWidth="0.8" />
        <circle cx="76" cy="46" r="11" fill="none" stroke="#334155" strokeWidth="0.8" />
        {/* role.y: 0 = goal line, 100 = blue line — the goal sits at the TOP of
            this drawing (svg y=8), so role.y maps to svg y DIRECTLY (no
            inversion): a low role.y (net-front) stays near the top, a high
            role.y (point) lands near the blue line at the bottom. */}
        {assigned.map(({ role, player }) => (
          <g key={role.key}>
            <circle cx={role.x} cy={role.y} r="6.5" fill={player ? "#1d4ed8" : "#1e293b"} stroke="#93c5fd" strokeWidth="0.6" />
            <text x={role.x} y={role.y + 1.8} textAnchor="middle" fontSize="5" fill="#e2e8f0" fontWeight="700">
              {player ? player.name.split(" ").slice(-1)[0].slice(0, 8) : "—"}
            </text>
            <text x={role.x} y={role.y - 9} textAnchor="middle" fontSize="3.6" fill="#94a3b8">{role.label}</text>
          </g>
        ))}
      </svg>
      {players.length === 0 && <p className="text-xs text-slate-500 text-center mt-1">Pick your 5 personnel above to see the formation.</p>}
    </div>
  );
}
