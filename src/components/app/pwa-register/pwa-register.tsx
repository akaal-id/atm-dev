"use client";

import { useEffect, useState } from "react";

export function PwaRegister() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker
      .register("/sw.js")
      .then(() => setReady(true))
      .catch(() => setReady(false));
  }, []);

  if (!ready) return null;

  return <span className="sr-only">ATM offline support ready</span>;
}
