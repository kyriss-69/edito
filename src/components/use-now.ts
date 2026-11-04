"use client";

import { useEffect, useState } from "react";

/** Heure courante, rafraîchie régulièrement (pour les « en retard », « dans 24 h »…). */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
