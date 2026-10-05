"use client";

import styles from "./push-toggle.module.css";

import { BellOff, BellRing, Loader2, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { disablePush, enablePush, pushState, type PushState } from "@/lib/push-client";
import { cn } from "@/lib/utils";

const copy: Record<PushState, { title: string; text: string }> = {
  on: { title: "Push notifications are on for this device", text: "You'll be notified about tasks, approvals and chats even when ATM is closed." },
  off: { title: "Get notified on this device", text: "Turn on push so tasks, approvals and chat messages reach you even when ATM is closed." },
  denied: {
    title: "Notifications are blocked",
    text: "Allow notifications for this site in your browser or phone settings (site settings → Notifications), then reload.",
  },
  "needs-install": {
    title: "Add ATM to your Home Screen first",
    text: "On iPhone, push only works from the installed app: tap Share → Add to Home Screen, open ATM from there, then turn notifications on.",
  },
  unsupported: {
    title: "This app can't receive push",
    text: "Install ATM from Chrome or Edge (menu → Install app) to get push. Here, notifications only appear while ATM is open.",
  },
};

/** Per-device push status with a one-tap enable / disable. */
export function PushToggle() {
  const { pushToast } = useToast();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void pushState().then(setState);
  }, []);

  async function toggle() {
    setBusy(true);
    try {
      const next = state === "on" ? await disablePush() : await enablePush();
      setState(next);
      if (next === "on") pushToast({ tone: "success", title: "Push notifications turned on" });
    } catch (error) {
      pushToast({ tone: "error", title: "Couldn't turn on push", description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  if (!state) return null;
  const canToggle = state === "on" || state === "off";
  const Icon = state === "on" ? BellRing : state === "needs-install" ? Smartphone : BellOff;

  return (
    <div className={cn(styles.root, state === "on" && styles.on)}>
      <span className={styles.icon} aria-hidden>
        <Icon />
      </span>
      <div className={styles.text}>
        <p className={styles.title}>{copy[state].title}</p>
        <p className={styles.body}>{copy[state].text}</p>
      </div>
      {canToggle ? (
        <Button type="button" size="sm" variant={state === "on" ? "outline" : "default"} onClick={() => void toggle()} disabled={busy}>
          {busy ? <Loader2 className={styles.spin} aria-hidden /> : null}
          {state === "on" ? "Turn off" : "Turn on"}
        </Button>
      ) : null}
    </div>
  );
}
