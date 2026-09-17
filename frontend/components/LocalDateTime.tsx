"use client";

import { useEffect, useState } from "react";

export default function LocalDateTime({ value, withYear = true }: { value: string | Date; withYear?: boolean }) {
  const [formatted, setFormatted] = useState<string | null>(null);

  useEffect(() => {
    const date = new Date(value);
    setFormatted(Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("sk-SK", {
      day: "numeric",
      month: "short",
      ...(withYear ? { year: "numeric" } : {}),
      hour: "2-digit",
      minute: "2-digit",
    }));
  }, [value, withYear]);

  return <span suppressHydrationWarning>{formatted ?? "—"}</span>;
}
