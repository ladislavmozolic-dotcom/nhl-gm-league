// UNHL's own badges for the special games (original artwork — not the NHL's
// trademarked event logos): Heritage Classic, Winter Classic, Stadium Series and
// the Global Series (with the host country's colours). Pure SVG, server-safe.
// Gradient ids are derived from the props, so two identical badges on one page
// share identical <defs> harmlessly.

type Kind = "HERITAGE" | "WINTER" | "STADIUM" | "GLOBAL";

const COUNTRY: Record<string, { code: string; bands: string[]; cross?: boolean }> = {
  helsinki: { code: "FIN", bands: ["#ffffff", "#003580"], cross: true },
  düsseldorf: { code: "GER", bands: ["#000000", "#dd0000", "#ffce00"] },
  dusseldorf: { code: "GER", bands: ["#000000", "#dd0000", "#ffce00"] },
  stockholm: { code: "SWE", bands: ["#006aa7", "#fecc00"], cross: true },
  prague: { code: "CZE", bands: ["#ffffff", "#d7141a", "#11457e"] },
  praha: { code: "CZE", bands: ["#ffffff", "#d7141a", "#11457e"] },
};

export function countryOf(venue: string | null | undefined) {
  const v = (venue ?? "").toLowerCase();
  return Object.entries(COUNTRY).find(([city]) => v.includes(city))?.[1] ?? null;
}

const yearOf = (title: string | null | undefined, fallback?: number) => Number((title ?? "").match(/20\d\d/)?.[0]) || fallback || null;

function Arc({ id, r, text, size = 9, color, bottom = false, spacing = 1.2 }: { id: string; r: number; text: string; size?: number; color: string; bottom?: boolean; spacing?: number }) {
  // top arc runs left→right over the top; bottom arc runs left→right under the bottom
  const d = bottom ? `M ${50 - r} 50 A ${r} ${r} 0 0 0 ${50 + r} 50` : `M ${50 - r} 50 A ${r} ${r} 0 0 1 ${50 + r} 50`;
  return (
    <>
      <path id={id} d={d} fill="none" />
      <text fontSize={size} fontWeight={900} fill={color} letterSpacing={spacing} fontFamily="ui-sans-serif, system-ui, sans-serif" dominantBaseline={bottom ? "hanging" : "auto"}>
        <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">{text}</textPath>
      </text>
    </>
  );
}

const MAPLE = "M50 22 l3.2 7.6 5.6-3.2-1.6 10.4 6.8-6.4 1.6 4.4 7.2-1.2-2.8 7.6 3.6 1.6-10.8 8.4 1.6 4.4-10.4-1.6 0.4 10.8h-4.8l0.4-10.8-10.4 1.6 1.6-4.4-10.8-8.4 3.6-1.6-2.8-7.6 7.2 1.2 1.6-4.4 6.8 6.4-1.6-10.4 5.6 3.2z";

function Heritage({ uid, year }: { uid: string; year: number | null }) {
  return (
    <>
      <defs>
        <radialGradient id={`${uid}-bg`} cx="50%" cy="40%" r="65%"><stop offset="0" stopColor="#f6ead2" /><stop offset="1" stopColor="#d9c29a" /></radialGradient>
        <linearGradient id={`${uid}-leaf`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d52b1e" /><stop offset="1" stopColor="#8f1a12" /></linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="#6b3f1f" />
      <circle cx="50" cy="50" r="44.5" fill="none" stroke="#e8d3a8" strokeWidth="1" />
      <circle cx="50" cy="50" r="31" fill={`url(#${uid}-bg)`} stroke="#6b3f1f" strokeWidth="1.5" />
      {/* wood grain */}
      {[38, 44, 50, 56, 62].map((y) => <path key={y} d={`M22 ${y} q14 -3 28 0 t28 0`} stroke="#b89868" strokeWidth="0.6" fill="none" opacity="0.55" clipPath={`url(#${uid}-clip)`} />)}
      <clipPath id={`${uid}-clip`}><circle cx="50" cy="50" r="30" /></clipPath>
      <path d={MAPLE} transform="translate(50 50) scale(0.62) translate(-50 -47)" fill={`url(#${uid}-leaf)`} />
      <Arc id={`${uid}-t`} r={37.5} text="HERITAGE" color="#f6ead2" size={10} />
      <Arc id={`${uid}-b`} r={37.5} text={`CLASSIC${year ? ` · ${year}` : ""}`} color="#f6ead2" size={8.5} bottom />
    </>
  );
}

function Winter({ uid, year }: { uid: string; year: number | null }) {
  const arm = (a: number) => (
    <g key={a} transform={`rotate(${a} 50 50)`}>
      <line x1="50" y1="50" x2="50" y2="27" />
      <polyline points="44.5,33 50,37.5 55.5,33" fill="none" />
      <polyline points="46,28.5 50,31.5 54,28.5" fill="none" />
    </g>
  );
  return (
    <>
      <defs>
        <radialGradient id={`${uid}-bg`} cx="50%" cy="35%" r="70%"><stop offset="0" stopColor="#dff3ff" /><stop offset="1" stopColor="#8cc8ea" /></radialGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="#0b2a52" />
      <circle cx="50" cy="50" r="44.5" fill="none" stroke="#c7e7fb" strokeWidth="1" strokeDasharray="2 2.2" />
      <circle cx="50" cy="50" r="31" fill={`url(#${uid}-bg)`} stroke="#0b2a52" strokeWidth="1.5" />
      <g stroke="#0b2a52" strokeWidth="2.6" strokeLinecap="round">{[0, 60, 120, 180, 240, 300].map(arm)}</g>
      <circle cx="50" cy="50" r="3.2" fill="#0b2a52" />
      <Arc id={`${uid}-t`} r={37.5} text="WINTER" color="#e6f5ff" size={10.5} spacing={2} />
      <Arc id={`${uid}-b`} r={37.5} text={`CLASSIC${year ? ` · ${year}` : ""}`} color="#e6f5ff" size={8.5} bottom />
    </>
  );
}

function Stadium({ uid, year }: { uid: string; year: number | null }) {
  const shield = "M50 3 L90 15 V48 C90 72 72 88 50 97 C28 88 10 72 10 48 V15 Z";
  return (
    <>
      <defs>
        <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e5e7eb" /><stop offset="0.5" stopColor="#9ca3af" /><stop offset="1" stopColor="#f3f4f6" /></linearGradient>
        <linearGradient id={`${uid}-night`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0f172a" /><stop offset="1" stopColor="#1e3a8a" /></linearGradient>
      </defs>
      <path d={shield} fill={`url(#${uid}-steel)`} />
      <path d={shield} transform="translate(50 50) scale(0.88) translate(-50 -50)" fill={`url(#${uid}-night)`} />
      {/* floodlights */}
      {[28, 72].map((x) => (
        <g key={x}>
          <line x1={x} y1="32" x2={x} y2="48" stroke="#cbd5e1" strokeWidth="1.6" />
          <rect x={x - 5} y="26.5" width="10" height="5.5" rx="1" fill="#fde68a" />
          <path d={`M${x - 5} 32 L${x - 12} 54 L${x + 12} 54 L${x + 5} 32Z`} fill="#fde68a" opacity="0.12" />
        </g>
      ))}
      {/* stadium bowl */}
      <path d="M20 54 Q50 36 80 54 L80 60 Q50 46 20 60Z" fill="#e5e7eb" />
      <path d="M22 60 Q50 49 78 60 L76 64 Q50 55 24 64Z" fill="#94a3b8" />
      <ellipse cx="50" cy="64.5" rx="16" ry="3.6" fill="#e0f2fe" />
      <text x="50" y="21" textAnchor="middle" fontSize="8.5" fontWeight={900} fill="#e5e7eb" letterSpacing="1.6" fontFamily="ui-sans-serif, system-ui, sans-serif">STADIUM</text>
      <text x="50" y="78" textAnchor="middle" fontSize="9" fontWeight={900} fill="#e5e7eb" letterSpacing="1.6" fontFamily="ui-sans-serif, system-ui, sans-serif">SERIES</text>
      {year && <text x="50" y="87" textAnchor="middle" fontSize="6" fontWeight={800} fill="#fde68a" letterSpacing="1" fontFamily="ui-sans-serif, system-ui, sans-serif">{year}</text>}
    </>
  );
}

function Global({ uid, venue }: { uid: string; venue: string | null | undefined }) {
  const c = countryOf(venue);
  return (
    <>
      <defs>
        <radialGradient id={`${uid}-globe`} cx="40%" cy="35%" r="70%"><stop offset="0" stopColor="#5eead4" /><stop offset="1" stopColor="#0f766e" /></radialGradient>
        <clipPath id={`${uid}-g`}><circle cx="50" cy="47" r="21" /></clipPath>
      </defs>
      <circle cx="50" cy="50" r="48" fill="#062f2c" />
      <circle cx="50" cy="50" r="44.5" fill="none" stroke="#5eead4" strokeWidth="0.8" opacity="0.6" />
      <circle cx="50" cy="47" r="21" fill={`url(#${uid}-globe)`} />
      <g clipPath={`url(#${uid}-g)`} stroke="#ccfbf1" strokeWidth="0.9" fill="none" opacity="0.8">
        <ellipse cx="50" cy="47" rx="8.5" ry="21" /><ellipse cx="50" cy="47" rx="16" ry="21" /><line x1="50" y1="26" x2="50" y2="68" />
        <line x1="29" y1="47" x2="71" y2="47" /><path d="M31 38 Q50 42 69 38" /><path d="M31 56 Q50 52 69 56" />
      </g>
      {/* puck orbit */}
      <ellipse cx="50" cy="47" rx="29" ry="8" fill="none" stroke="#fbbf24" strokeWidth="1.6" transform="rotate(-18 50 47)" />
      <ellipse cx="76" cy="38.5" rx="3.6" ry="1.8" fill="#111827" stroke="#fbbf24" strokeWidth="0.8" transform="rotate(-18 76 38.5)" />
      {/* host-country ribbon */}
      <g>
        <rect x="18" y="70" width="64" height="14" rx="2" fill="#0b1220" stroke="#5eead4" strokeWidth="0.6" />
        {c ? (c.cross ? (
          <g><rect x="21" y="72.5" width="15" height="9" fill={c.bands[0]} /><rect x="25" y="72.5" width="2.6" height="9" fill={c.bands[1]} /><rect x="21" y="75.7" width="15" height="2.6" fill={c.bands[1]} /></g>
        ) : (
          <g>{c.bands.map((b, i) => <rect key={i} x="21" y={72.5 + (9 / c.bands.length) * i} width="15" height={9 / c.bands.length + 0.05} fill={b} />)}</g>
        )) : null}
        <text x={c ? 59 : 50} y="80.2" textAnchor="middle" fontSize="7" fontWeight={900} fill="#ccfbf1" letterSpacing="1" fontFamily="ui-sans-serif, system-ui, sans-serif">{c ? c.code : "WORLD"}</text>
      </g>
      <Arc id={`${uid}-t`} r={38.5} text="GLOBAL SERIES" color="#ccfbf1" size={8.5} spacing={1.2} />
    </>
  );
}

export default function EventBadge({ kind, title, venue, size = 28, className = "" }: { kind: string | null | undefined; title?: string | null; venue?: string | null; size?: number; className?: string }) {
  if (!kind) return null;
  const k = kind as Kind;
  const year = yearOf(title);
  const uid = `eb-${k}-${year ?? "x"}-${countryOf(venue)?.code ?? "w"}`;
  const label = title ?? k;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={label} className={`inline-block shrink-0 ${className}`}>
      <title>{`${label}${venue ? ` — ${venue}` : ""}`}</title>
      {k === "HERITAGE" ? <Heritage uid={uid} year={year} /> : k === "WINTER" ? <Winter uid={uid} year={year} /> : k === "STADIUM" ? <Stadium uid={uid} year={year} /> : <Global uid={uid} venue={venue} />}
    </svg>
  );
}
