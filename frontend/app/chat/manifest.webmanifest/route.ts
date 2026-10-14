import { loadBranding } from "@/lib/site-config";
import { chatManifest } from "@/lib/im/manifest";

export const dynamic = "force-dynamic";

export async function GET() {
  return new Response(JSON.stringify(chatManifest(await loadBranding())), { headers: { "Content-Type": "application/manifest+json" } });
}
