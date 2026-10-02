"use client";

import styles from "./emoji-picker.module.css";

import { Smile } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const categories: Array<{ id: string; label: string; icon: string; emojis: string }> = [
  { id: "smileys", label: "Smileys", icon: "😀", emojis: "😀 😃 😄 😁 😆 😅 🤣 😂 🙂 😉 😊 😇 🥰 😍 🤩 😘 😋 😛 😜 🤪 🤗 🤭 🤫 🤔 🤐 😐 😑 😶 😏 😒 🙄 😬 😌 😔 😪 😴 😷 🤒 🥵 🥶 😵 🤯 🥳 😎 🤓 😕 😟 🙁 😮 😲 😳 🥺 😢 😭 😱 😤 😡 🤬 😈 💀 🤡 👻 🙈 🙉 🙊" },
  { id: "gestures", label: "Gestures", icon: "👍", emojis: "👍 👎 👌 🤌 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 👋 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💪 🫡 🫶 🤷 🤦 🙋 🙆 🙅 💁" },
  { id: "hearts", label: "Hearts & symbols", icon: "❤️", emojis: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 ❣️ 💕 💯 ✅ ☑️ ❌ ⚠️ ❗ ❓ 💡 🔥 ⭐ 🌟 ✨ ⚡ 💥 🎯 🚀 🏆 🥇 🎖️" },
  { id: "work", label: "Work", icon: "💼", emojis: "💼 📁 📂 📄 📝 📌 📎 🖊️ ✏️ 📊 📈 📉 📅 🗓️ ⏰ ⏳ 💻 🖥️ 📱 ☎️ 📧 📣 🔔 🔍 🔗 🧠 🛠️ ⚙️ 💰 🧾" },
  { id: "food", label: "Food & drink", icon: "☕", emojis: "☕ 🍵 🧋 🥤 🍕 🍔 🍟 🌭 🍜 🍝 🍛 🍣 🍱 🥗 🍰 🎂 🍩 🍪 🍫 🍎 🍌 🍉 🍇 🍓" },
  { id: "celebrate", label: "Celebrate & nature", icon: "🎉", emojis: "🎉 🎊 🎁 🎈 🥂 🍾 🎶 🎵 📸 🌈 ☀️ 🌙 ⛅ 🌧️ 🌸 🌻 🌱 🍀 🌍 ✈️ 🏖️ 🕌 🤲 🌴" },
];

const RECENT_KEY = "atm:chat:recent-emoji";
const MAX_RECENT = 16;

function readRecent(): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecent(list: string[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // Private mode or blocked storage: recents just won't persist.
  }
}

/** Smile button + emoji panel. Calls `onPick` with the emoji; remembers recent picks in this browser. */
export function EmojiPicker({ onPick, className }: { onPick: (emoji: string) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("smileys");
  const [recent, setRecent] = useState<string[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    if (!open) setRecent(readRecent());
    setOpen((current) => !current);
  }

  function pick(emoji: string) {
    onPick(emoji);
    const next = [emoji, ...recent.filter((item) => item !== emoji)].slice(0, MAX_RECENT);
    setRecent(next);
    saveRecent(next);
  }

  const active = categories.find((category) => category.id === tab) ?? categories[0];

  return (
    <div ref={rootRef} className={cn(styles.root, className)}>
      <button type="button" className={cn(styles.trigger, open && styles.triggerOpen)} onClick={toggle} aria-label="Insert emoji" aria-expanded={open}>
        <Smile aria-hidden />
      </button>
      {open ? (
        <div className={styles.panel} role="dialog" aria-label="Emoji">
          {recent.length ? (
            <>
              <p className={styles.section}>Recent</p>
              <div className={styles.grid}>
                {recent.map((emoji) => (
                  <button key={`r-${emoji}`} type="button" className={styles.emoji} onClick={() => pick(emoji)}>
                    {emoji}
                  </button>
                ))}
              </div>
            </>
          ) : null}
          <p className={styles.section}>{active.label}</p>
          <div className={cn(styles.grid, styles.scroll)}>
            {active.emojis.split(" ").map((emoji, index) => (
              <button key={`${active.id}-${index}`} type="button" className={styles.emoji} onClick={() => pick(emoji)}>
                {emoji}
              </button>
            ))}
          </div>
          <div className={styles.tabs} role="tablist">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                role="tab"
                aria-selected={category.id === tab}
                aria-label={category.label}
                title={category.label}
                className={cn(styles.tab, category.id === tab && styles.tabActive)}
                onClick={() => setTab(category.id)}
              >
                {category.icon}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
