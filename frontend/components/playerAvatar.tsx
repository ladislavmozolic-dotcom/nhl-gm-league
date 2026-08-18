"use client";

import { useState } from "react";

export default function PlayerAvatar({
  src,
  alt,
  size = 40,
}: {
  src: string | null;
  alt: string;
  size?: number;
}) {
  const [error, setError] = useState(false);
  const initials = alt.split(" ").map((n) => n[0]).join("");

  if (!src || error) {
    return (
      <div
        className="bg-slate-700 rounded-full flex items-center justify-center text-slate-400 font-bold shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.35 }}
      >
        {initials}
      </div>
    );
  }

  // Plain <img> (not next/image): mugs are served directly by Caddy, so the Next
  // image optimizer would 404 on them and fall back to initials.
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="rounded-full object-cover shrink-0 bg-slate-800"
      onError={() => setError(true)}
    />
  );
}
