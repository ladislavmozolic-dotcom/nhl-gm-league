// Web Editor — appearance templates (a named "look": colours + banner layout, no
// logo/name content). Five built-ins ship in code; users can also save their own to
// the SiteTemplate table. Applying a template just fills the branding form fields.

export type TemplateStyle = {
  accentColor: string;
  bgColor: string;
  bannerAlign: string;   // left | center | right
  bannerLayout: string;  // row | stack
  logoFirst: boolean;
  logoHeight: number;
  nameHeight: number;
};

export type Template = { key: string; name: string; desc: string; style: TemplateStyle };

const base = { bannerAlign: "center", bannerLayout: "row", logoFirst: true, logoHeight: 64, nameHeight: 64 };

export const BUILTIN_TEMPLATES: Template[] = [
  { key: "midnight-ice", name: "Midnight Ice", desc: "Dark blue + ice-blue accent (classic)", style: { accentColor: "#60a5fa", bgColor: "#0a1628", ...base } },
  { key: "steel-silver", name: "Steel Silver", desc: "Metallic black + silver accent (suits metallic logos)", style: { accentColor: "#c7ccd4", bgColor: "#0c0e13", ...base, logoHeight: 72, nameHeight: 72 } },
  { key: "blood-red", name: "Blood Red", desc: "Charcoal + red accent, name above the logo", style: { accentColor: "#ef4444", bgColor: "#140a0b", ...base, bannerLayout: "stack", logoFirst: false } },
  { key: "emerald-rink", name: "Emerald Rink", desc: "Dark green + emerald accent", style: { accentColor: "#34d399", bgColor: "#07140f", ...base, bannerAlign: "left" } },
  { key: "royal-gold", name: "Royal Gold", desc: "Midnight purple + gold accent", style: { accentColor: "#fbbf24", bgColor: "#120b1c", ...base } },
];

export function builtinByKey(key: string): Template | undefined {
  return BUILTIN_TEMPLATES.find((t) => t.key === key);
}
