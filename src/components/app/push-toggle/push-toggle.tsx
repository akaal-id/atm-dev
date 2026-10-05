"use client";

import styles from "./push-toggle.module.css";

import { BellOff, BellRing, Check, Copy, Loader2, MonitorSmartphone, Send, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { disablePush, enablePush, type PushEnv, pushEnv, pushState, type PushState, sendTestPush } from "@/lib/push-client";
import { cn } from "@/lib/utils";

const APP_URL = "https://team.akaal.id";
const DISMISS_KEY = "atm:push-prompt-dismissed-at";
const DISMISS_DAYS = 7;

const browserName: Record<PushEnv["browser"], string> = { chrome: "Chrome", edge: "Edge", firefox: "Firefox", safari: "Safari", samsung: "Samsung Internet", other: "your browser" };

/** How to un-block notifications for team.akaal.id on this exact browser/OS. */
function unblockSteps(env: PushEnv): string[] {
  if (env.os === "ios") return ["Open iPhone Settings → Notifications → ATM.", "Turn on Allow Notifications, then reopen ATM."];
  if (env.os === "android") return [`${browserName[env.browser]} → ⋮ → Settings → Site settings → Notifications.`, "Find team.akaal.id → Allow, then reload ATM."];
  if (env.browser === "safari")
    return env.standalone
      ? ["System Settings → Notifications → ATM → Allow notifications.", "Reopen ATM from the Dock."]
      : ["Safari → Settings → Websites → Notifications.", "Set team.akaal.id to Allow, then reload."];
  if (env.browser === "firefox") return ["Click the 🔒 icon left of the address.", "Remove the Blocked notification permission, then reload."];
  return [`Click the 🔒 / tune icon left of the address in ${browserName[env.browser]}.`, "Site settings → Notifications → Allow, then reload ATM."];
}

/** Checks for when the test notification doesn't show: the OS is usually the one blocking it. */
function osChecks(env: PushEnv): string[] {
  const app = env.browser === "safari" && env.standalone ? "ATM" : env.browser === "safari" ? "Safari" : browserName[env.browser] === "Chrome" ? "Google Chrome" : browserName[env.browser];
  if (env.os === "macos")
    return [`System Settings → Notifications → ${app} → Allow notifications (style: Banners or Alerts).`, "Turn off Focus / Do Not Disturb (Control Centre)."];
  if (env.os === "windows")
    return [
      `Settings → System → Notifications → ${app} → On.`,
      "Turn off Do not disturb.",
      env.browser === "chrome" || env.browser === "edge" ? `${app} → Settings → System → "Continue running background apps" → On.` : "",
    ].filter(Boolean);
  if (env.os === "android") return [`Phone Settings → Apps → ${browserName[env.browser]} (or ATM) → Notifications → On.`, "Turn off Do not disturb."];
  if (env.os === "ios") return ["Settings → Notifications → ATM → Allow Notifications.", "Turn off Focus."];
  return ["Check your system notification settings and Do Not Disturb."];
}

/** When will alerts arrive with ATM closed on this setup? Shown once push is on. */
function backgroundNote(env: PushEnv) {
  if (env.os === "macos" && env.browser !== "safari")
    return `Alerts arrive while ${browserName[env.browser]} is running — closing its windows is fine, but don't quit it (⌘Q). For alerts with the browser fully closed, open ATM in Safari → File → Add to Dock and turn notifications on there.`;
  if (env.os === "windows") return `Alerts arrive while ${browserName[env.browser]} runs in the background, even with every window closed.`;
  if (env.mobile) return "Alerts arrive even when ATM is closed.";
  return "Alerts arrive even when ATM is closed.";
}

function readDismissed() {
  try {
    const at = Number(window.localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(at) && Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

function saveDismissed() {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // Storage blocked: the banner just comes back next visit.
  }
}

/**
 * Push notifications for *this device*, with device-specific guidance.
 * - `banner` (dashboard): hidden when push already works or the user dismissed it (7 days).
 * - `card` (Notifications page): always shown, including on/off and a test.
 */
export function PushToggle({ mode = "card" }: { mode?: "card" | "banner" }) {
  const [state, setState] = useState<PushState | null>(null);
  const [env, setEnv] = useState<PushEnv | null>(null);
  const [busy, setBusy] = useState<"" | "toggle" | "test">("");
  const [error, setError] = useState("");
  const [testSent, setTestSent] = useState(false);
  const [justEnabled, setJustEnabled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Browser-only facts (permission, subscription, user agent) are read after mount.
    void pushState().then((next) => {
      setEnv(pushEnv());
      if (mode === "banner" && readDismissed()) setHidden(true);
      setState(next);
    });
  }, [mode]);

  if (!state || !env || hidden) return null;
  // The dashboard banner only appears when something needs doing (or right after turning push on).
  if (mode === "banner" && state === "on" && !justEnabled) return null;

  async function turnOn() {
    setBusy("toggle");
    setError("");
    try {
      const next = await enablePush();
      setState(next);
      if (next === "on") setJustEnabled(true);
    } catch (enableError) {
      setError(enableError instanceof Error ? enableError.message : "Couldn't turn on notifications.");
    } finally {
      setBusy("");
    }
  }

  async function turnOff() {
    setBusy("toggle");
    setError("");
    setState(await disablePush().catch(() => state));
    setJustEnabled(false);
    setBusy("");
  }

  async function test() {
    setBusy("test");
    setError("");
    setTestSent(false);
    try {
      await sendTestPush();
      setTestSent(true);
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "Couldn't send a test notification.");
    } finally {
      setBusy("");
    }
  }

  function dismiss() {
    saveDismissed();
    setHidden(true);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(APP_URL).catch(() => null);
    setCopied(true);
  }

  // ---- Content per situation ------------------------------------------------------------
  let icon = <BellOff aria-hidden />;
  let title = "";
  let text = "";
  let steps: string[] = [];
  let tone = styles.info;

  if (env.desktopApp) {
    icon = <MonitorSmartphone aria-hidden />;
    title = "This desktop app can't get notifications when it's closed";
    text = "The ATM desktop app only shows alerts while it's open. For alerts anytime, use ATM from the browser:";
    steps =
      env.os === "macos"
        ? ["Open team.akaal.id in Safari.", "File → Add to Dock, then open ATM from the Dock.", "Notifications → Turn on. Alerts then arrive even with ATM and Safari closed."]
        : ["Open team.akaal.id in Chrome or Edge.", "Click Install (address bar) to add ATM as an app.", "Notifications → Turn on, and keep the browser's background apps setting on."];
  } else if (state === "needs-install") {
    icon = <Smartphone aria-hidden />;
    title = "Add ATM to your Home Screen to get notifications";
    text = "On iPhone and iPad, notifications only work from the installed app:";
    steps = ["Tap Share (□↑) in Safari → Add to Home Screen.", "Open ATM from the new icon on your Home Screen.", "Come back here and tap Turn on."];
  } else if (state === "unsupported") {
    title = `${browserName[env.browser]} can't receive ATM notifications`;
    text = env.os === "macos" ? "Use Safari (File → Add to Dock) or Chrome, then turn notifications on." : "Open ATM in Chrome or Edge, install it, then turn notifications on.";
  } else if (state === "denied") {
    tone = styles.warn;
    title = "Notifications are blocked on this device";
    text = "Allow them for team.akaal.id, then reload ATM:";
    steps = unblockSteps(env);
  } else if (state === "off") {
    title = env.mobile ? "Get notified on this phone" : "Get notified on this computer";
    text = "Turn on notifications so tasks, approvals, and chat messages reach you even when ATM is closed.";
  } else {
    icon = <BellRing aria-hidden />;
    tone = styles.on;
    title = justEnabled ? "Notifications are on for this device 🎉" : "Notifications are on for this device";
    text = backgroundNote(env);
  }

  return (
    <section className={cn(styles.root, tone)} aria-live="polite">
      <span className={styles.icon}>{icon}</span>
      <div className={styles.body}>
        <p className={styles.title}>{title}</p>
        {text ? <p className={styles.text}>{text}</p> : null}
        {steps.length ? (
          <ol className={styles.steps}>
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        ) : null}

        {state === "on" ? (
          <div className={styles.testRow}>
            <Button type="button" size="sm" variant="outline" onClick={() => void test()} disabled={busy !== ""}>
              {busy === "test" ? <Loader2 className={styles.spin} aria-hidden /> : <Send className={styles.btnIcon} aria-hidden />}
              Send test notification
            </Button>
            {testSent ? <span className={styles.sentNote}>Sent — it should pop up in a few seconds.</span> : null}
          </div>
        ) : null}
        {state === "on" && testSent ? (
          <details className={styles.help}>
            <summary>Didn&apos;t see it?</summary>
            <ol className={styles.steps}>
              {osChecks(env).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </details>
        ) : null}
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <div className={styles.actions}>
        {env.desktopApp ? (
          <Button type="button" size="sm" variant="outline" onClick={() => void copyLink()}>
            {copied ? <Check className={styles.btnIcon} aria-hidden /> : <Copy className={styles.btnIcon} aria-hidden />}
            {copied ? "Copied" : "Copy link"}
          </Button>
        ) : state === "off" ? (
          <Button type="button" size="sm" onClick={() => void turnOn()} disabled={busy !== ""}>
            {busy === "toggle" ? <Loader2 className={styles.spin} aria-hidden /> : <BellRing className={styles.btnIcon} aria-hidden />}
            Turn on
          </Button>
        ) : state === "on" && mode === "card" ? (
          <Button type="button" size="sm" variant="outline" onClick={() => void turnOff()} disabled={busy !== ""}>
            {busy === "toggle" ? <Loader2 className={styles.spin} aria-hidden /> : null}
            Turn off
          </Button>
        ) : null}
        {mode === "banner" ? (
          <Button type="button" size="sm" variant="ghost" onClick={state === "on" ? () => setHidden(true) : dismiss} aria-label={state === "on" ? "Close" : "Not now"}>
            {state === "on" ? <X className={styles.btnIcon} aria-hidden /> : "Not now"}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
