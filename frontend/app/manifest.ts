import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { loadBranding } from "@/lib/site-config";
import { chatManifest } from "@/lib/im/manifest";

// Lets iOS/Android "Add to Home Screen" launch the site full-screen, with its
// own name/icon/theme color, instead of as a bookmarked Safari tab. Reads
// branding live (not hardcoded) so a league rename in Admin → Web Editor
// doesn't need a redeploy to show up here — but the icon files under
// /public/icons are static, generated once from the branding logo at the time
// this was built (regenerate them if the logo changes materially).
export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const b = await loadBranding();
  // chat.<domain> is the separate installable chat app — its pages must carry the CHAT manifest in the HTML itself
  // (iPhone reads it at "Add to Home Screen"; a script-swapped manifest gave the wrong name).
  if (((await headers()).get("host") ?? "").startsWith("chat.")) return chatManifest(b);
  return {
    name: `${b.leagueName} — ${b.tagline}`,
    short_name: b.leagueName,
    description: b.tagline,
    id: "/",
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
