// Web Editor — site-wide theme. The app uses hardcoded Tailwind colour classes
// everywhere; instead of refactoring hundreds of files, we remap the handful of most
// common surface/border/text/radius utilities onto CSS variables via one injected
// <style> block. Defaults equal the current palette, so nothing changes until edited.

export type Theme = {
  surfaceColor: string;
  surface2Color: string;
  borderColor: string;
  text2Color: string;
  text3Color: string;
  radiusPx: number;
  fontKey: string;
  accentColor: string;
  bgColor: string;
};

export const THEME_DEFAULTS: Theme = {
  surfaceColor: "#0f172a",
  surface2Color: "#1e293b",
  borderColor: "#1e293b",
  text2Color: "#94a3b8",
  text3Color: "#64748b",
  radiusPx: 12,
  fontKey: "inter",
  accentColor: "#60a5fa",
  bgColor: "#0a1628",
};

export const FONTS: { key: string; name: string; stack: string }[] = [
  { key: "inter", name: "Inter (predvolené)", stack: "" }, // "" = keep the next/font Inter
  { key: "system", name: "Systémové", stack: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  { key: "rounded", name: "Zaoblené", stack: "'Trebuchet MS', 'Segoe UI', Verdana, sans-serif" },
  { key: "condensed", name: "Úzke", stack: "'Arial Narrow', 'Roboto Condensed', 'Segoe UI', sans-serif" },
  { key: "serif", name: "Serif", stack: "Georgia, 'Times New Roman', serif" },
  { key: "mono", name: "Monospace", stack: "'Courier New', ui-monospace, monospace" },
];

export function fontStack(key: string): string {
  return FONTS.find((f) => f.key === key)?.stack ?? "";
}

// opacity variants observed in the codebase, mapped with color-mix so the "glassy" look survives
const OPACITIES = [70, 60, 50, 40, 30];
// NOTE: every var() carries a FALLBACK colour. Without it, if `--surface` ever fails to
// resolve (a stale cached stylesheet, a forced-colours/contrast mode, a dark-mode browser
// extension), `background-color:var(--surface)` collapses to `transparent` — and because
// the rule is !important it beats Tailwind's own opaque default, so panels (e.g. the nav
// dropdowns) go see-through and the page shows through them. The fallback keeps them solid.
function surfaceRules(cls: string, varName: string, fb: string): string {
  let css = `.${cls}{background-color:var(${varName},${fb})!important}`;
  for (const o of OPACITIES) css += `.${cls}\\/${o}{background-color:color-mix(in srgb,var(${varName},${fb}) ${o}%,transparent)!important}`;
  return css;
}
function borderRules(cls: string, varName: string, fb: string): string {
  let css = `.${cls}{border-color:var(${varName},${fb})!important}`;
  for (const o of OPACITIES) css += `.${cls}\\/${o}{border-color:color-mix(in srgb,var(${varName},${fb}) ${o}%,transparent)!important}`;
  return css;
}

/** The global <style> body that themes the whole app from the tokens. */
export function themeCss(t: Theme): string {
  const font = fontStack(t.fontKey);
  return [
    `:root{--surface:${t.surfaceColor};--surface-2:${t.surface2Color};--border:${t.borderColor};--text-2:${t.text2Color};--text-3:${t.text3Color};--radius:${t.radiusPx}px;--accent:${t.accentColor}}`,
    font ? `body{font-family:${font}!important}` : "",
    // surfaces
    surfaceRules("bg-slate-900", "--surface", t.surfaceColor),
    surfaceRules("bg-slate-800", "--surface-2", t.surface2Color),
    // borders
    borderRules("border-slate-800", "--border", t.borderColor),
    borderRules("border-slate-700", "--border", t.borderColor),
    // text
    `.text-slate-400{color:var(--text-2,${t.text2Color})!important}`,
    `.text-slate-500{color:var(--text-3,${t.text3Color})!important}`,
    // radius
    `.rounded-lg{border-radius:var(--radius)!important}.rounded-xl{border-radius:var(--radius)!important}.rounded-2xl{border-radius:calc(var(--radius) + 4px)!important}`,
  ].join("");
}
