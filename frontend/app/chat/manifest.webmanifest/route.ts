import { loadBranding } from "@/lib/site-config";

export const dynamic = "force-dynamic";

// Separate installable app: "<League> Chat", opens straight into /chat, full screen.
export async function GET() {
  const b = await loadBranding();
  const manifest = {
    name: `${b.leagueName} Chat`, short_name: "UNHL Chat", description: `${b.leagueName} GM chat`,
    id: "/chat", start_url: "/chat", scope: "/chat", display: "standalone", orientation: "portrait-primary",
    background_color: b.bgColor, theme_color: b.bgColor,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifest), { headers: { "Content-Type": "application/manifest+json" } });
}
