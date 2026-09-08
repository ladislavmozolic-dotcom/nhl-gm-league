import type { MetadataRoute } from "next";
import { loadBranding } from "@/lib/site-config";

// Lets iOS/Android "Add to Home Screen" launch the site full-screen, with its
// own name/icon/theme color, instead of as a bookmarked Safari tab. Reads
// branding live (not hardcoded) so a league rename in Admin → Web Editor
// doesn't need a redeploy to show up here — but the icon files under
// /public/icons are static, generated once from the branding logo at the time
// this was built (regenerate them if the logo changes materially).
export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const b = await loadBranding();
  return {
    name: `${b.leagueName} — ${b.tagline}`,
    short_name: b.leagueName,
    description: b.tagline,
    start_url: "/",
    display: "standalone",
    background_color: b.bgColor,
    theme_color: b.bgColor,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
