import Link from "next/link";
import type { Branding } from "@/lib/site-config";

// Compact brand icons (24x24). Unknown types fall back to a globe.
const ICONS: Record<string, string> = {
  facebook: "M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z",
  instagram: "M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.3 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.1.4.3 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.3 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.1-1 .3-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.3-2.2-.4a3.9 3.9 0 0 1-1.4-.9 3.9 3.9 0 0 1-.9-1.4c-.1-.4-.3-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.3-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.1 1-.3 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 1.8c-3.1 0-3.5 0-4.7.1-1.1.1-1.7.2-2.1.4-.5.2-.9.4-1.3.8-.4.4-.6.8-.8 1.3-.2.4-.3 1-.4 2.1C2.6 8.5 2.6 8.9 2.6 12s0 3.5.1 4.7c.1 1.1.2 1.7.4 2.1.2.5.4.9.8 1.3.4.4.8.6 1.3.8.4.2 1 .3 2.1.4 1.2.1 1.6.1 4.7.1s3.5 0 4.7-.1c1.1-.1 1.7-.2 2.1-.4.5-.2.9-.4 1.3-.8.4-.4.6-.8.8-1.3.2-.4.3-1 .4-2.1.1-1.2.1-1.6.1-4.7s0-3.5-.1-4.7c-.1-1.1-.2-1.7-.4-2.1a3.5 3.5 0 0 0-.8-1.3 3.5 3.5 0 0 0-1.3-.8c-.4-.2-1-.3-2.1-.4-1.2-.1-1.6-.1-4.7-.1zm0 3.1a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8zm0 8.1a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zm6.3-8.3a1.1 1.1 0 1 1-2.3 0 1.1 1.1 0 0 1 2.3 0z",
  discord: "M20 4.5A18 18 0 0 0 15.6 3l-.3.6a13 13 0 0 1 3.9 1.9 12 12 0 0 0-10.4 0 13 13 0 0 1 3.9-1.9L12.4 3A18 18 0 0 0 8 4.5C4.8 9.3 4 14 4.4 18.6a18 18 0 0 0 5.5 2.8l.7-1.2a12 12 0 0 1-1.9-.9l.5-.4a13 13 0 0 0 11.6 0l.5.4c-.6.4-1.2.7-1.9.9l.7 1.2a18 18 0 0 0 5.5-2.8C24 13.7 22.9 9 20 4.5zM9.7 15.6c-.9 0-1.6-.8-1.6-1.9s.7-1.9 1.6-1.9 1.7.9 1.6 1.9c0 1.1-.7 1.9-1.6 1.9zm4.6 0c-.9 0-1.6-.8-1.6-1.9s.7-1.9 1.6-1.9 1.7.9 1.6 1.9c0 1.1-.7 1.9-1.6 1.9z",
  youtube: "M23 8s-.2-1.6-.9-2.3c-.9-.9-1.8-.9-2.3-1C16.9 4.5 12 4.5 12 4.5s-4.9 0-7.8.2c-.5.1-1.4.1-2.3 1C1.2 6.4 1 8 1 8s-.2 1.9-.2 3.7v1.7c0 1.8.2 3.7.2 3.7s.2 1.6.9 2.3c.9.9 2 .9 2.5 1 1.8.1 7.6.2 7.6.2s4.9 0 7.8-.2c.5-.1 1.4-.1 2.3-1 .7-.7.9-2.3.9-2.3s.2-1.9.2-3.7v-1.7C23.2 9.9 23 8 23 8zM9.8 15.3V8.9l6.3 3.2-6.3 3.2z",
  twitter: "M18.9 2h3.3l-7.2 8.2L23.5 22h-6.6l-5.2-6.8L5.8 22H2.5l7.7-8.8L1.5 2h6.8l4.7 6.2L18.9 2zm-1.2 18h1.8L7.3 3.9H5.4L17.7 20z",
  forum: "M21 6h-2v9H7v2c0 .6.4 1 1 1h10l4 4V7c0-.6-.4-1-1-1zm-4 6V3c0-.6-.4-1-1-1H3c-.6 0-1 .4-1 1v14l4-4h10c.6 0 1-.4 1-1z",
  web: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-3a15 15 0 0 0-1.3-3.4A8 8 0 0 1 18.9 8zM12 4c.8 1.2 1.5 2.5 1.9 4h-3.8c.4-1.5 1.1-2.8 1.9-4zM4.3 14a8 8 0 0 1 0-4h3.4a16 16 0 0 0 0 4H4.3zm.8 2h3a15 15 0 0 0 1.3 3.4A8 8 0 0 1 5.1 16zm3-8h-3a8 8 0 0 1 4.3-3.4A15 15 0 0 0 8.1 8zM12 20c-.8-1.2-1.5-2.5-1.9-4h3.8c-.4 1.5-1.1 2.8-1.9 4zm2.3-6H9.7a14 14 0 0 1 0-4h4.6a14 14 0 0 1 0 4zm.4 5.4A15 15 0 0 0 16 16h3a8 8 0 0 1-4.3 3.4zm1.6-5.4a16 16 0 0 0 0-4h3.4a8 8 0 0 1 0 4h-3.4z",
};

function SocialIcon({ type }: { type: string }) {
  const d = ICONS[type] ?? ICONS.web;
  return <svg viewBox="0 0 24 24" className="w-full h-full" fill="currentColor" aria-hidden><path d={d} /></svg>;
}

// Site banner. Logo + wordmark/name with admin-set sizes, alignment, layout, an
// optional fixed band height, and optional social links in the corner.
export default function SiteBanner({ branding }: { branding: Branding }) {
  const justify = branding.bannerAlign === "left" ? "justify-start" : branding.bannerAlign === "right" ? "justify-end" : "justify-center";
  const dir = branding.bannerLayout === "stack" ? "flex-col" : "flex-row";
  const fixed = branding.bannerHeight > 0;
  const social = branding.socialLinks ?? [];

  // maxHeight (not a fixed height) + width:auto lets the browser shrink BOTH
  // dimensions to fit a narrow mobile viewport without cropping — a fixed
  // height combined with the intrinsic aspect ratio ignored max-width and
  // let the wordmark run off the right edge of the screen.
  const logo = branding.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img key="logo" src={branding.logoUrl} alt="" className="w-auto max-w-full object-contain shrink-0" style={{ maxHeight: branding.logoHeight, height: "auto" }} />
  ) : null;
  const name = branding.nameImageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img key="name" src={branding.nameImageUrl} alt={branding.leagueName} className="w-auto max-w-full object-contain" style={{ maxHeight: branding.nameHeight, height: "auto" }} />
  ) : (
    <div key="name" className="text-center">
      <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight italic leading-none">{branding.leagueName}</h1>
      <p className="text-[11px] md:text-xs font-bold tracking-[0.3em] uppercase mt-1" style={{ color: branding.accentColor }}>{branding.tagline}</p>
    </div>
  );
  const parts = branding.logoFirst ? [logo, name] : [name, logo];

  return (
    <div className="bg-gradient-to-r from-[#0a1628] via-[#1e3a5f] to-[#0a1628] border-b border-slate-700/40 overflow-hidden">
      <div className={`max-w-[1400px] mx-auto px-4 relative flex items-center ${fixed ? "" : "py-4"}`} style={fixed ? { height: branding.bannerHeight } : undefined}>
        <Link href="/" className={`flex items-center gap-4 w-full ${dir} ${justify}`}>{parts}</Link>
        {social.length > 0 && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2.5">
            {social.map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" title={s.type}
                className="w-6 h-6 text-slate-300 hover:text-white transition-colors" style={{ ["--tw-text-opacity" as string]: "1" }}>
                <SocialIcon type={s.type} />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
