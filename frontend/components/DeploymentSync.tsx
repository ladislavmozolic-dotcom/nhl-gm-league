"use client";

import { useEffect } from "react";

/**
 * Automatically catches "Failed to find Server Action" errors which occur when
 * a client holds an outdated bundle across deployments. When detected, reloads
 * the page once so the user is seamlessly moved to the new deployment.
 */
export default function DeploymentSync() {
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      const msg = event?.reason?.message || String(event?.reason || "");
      if (/Failed to find Server Action/i.test(msg)) {
        console.warn("Deployment mismatch detected, auto-reloading page...", msg);
        // Avoid reload loops
        const lastReload = sessionStorage.getItem("last_deploy_reload");
        const now = Date.now();
        if (!lastReload || now - Number(lastReload) > 10000) {
          sessionStorage.setItem("last_deploy_reload", String(now));
          window.location.reload();
        }
      }
    };

    window.addEventListener("unhandledrejection", handleRejection);
    return () => window.removeEventListener("unhandledrejection", handleRejection);
  }, []);

  return null;
}
