// A Server Action's ID is baked into the client bundle at build time. If the admin
// keeps a tab open across a redeploy (this app pushes updates fairly often — see
// DEPLOY.md), the next click sends an ID the new server build doesn't recognize:
// Next.js throws "Failed to find Server Action ... this request might be from an
// older or newer deployment." With no handling, that just looks like the button did
// nothing — confusing on a page like Season Control where every action matters.
export function friendlyActionError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/Failed to find Server Action/i.test(msg)) {
    return "⚠ This page is out of date (a new version was deployed) — refresh the page and try again.";
  }
  return `⚠ ${msg}`;
}
