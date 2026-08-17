import type { Branding } from "@/lib/site-config";

// Site footer — admin-editable text (Web Editor) + league name. Hidden if no text set
// and defaults to a simple copyright line.
export default function SiteFooter({ branding }: { branding: Branding }) {
  const year = "2026"; // static: Date.now() unavailable in this runtime for some paths
  return (
    <footer className="border-t border-slate-700/40 mt-auto">
      <div className="max-w-[1400px] mx-auto px-4 py-6 text-center text-[12px] text-slate-400">
        {branding.footerText ? (
          <p className="whitespace-pre-line">{branding.footerText}</p>
        ) : (
          <p>© {year} {branding.leagueName}. {branding.tagline}</p>
        )}
      </div>
    </footer>
  );
}
