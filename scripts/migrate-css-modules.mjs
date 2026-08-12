/**
 * Folderize a .tsx component and convert Tailwind utility className strings
 * into a co-located plain CSS module (no @apply).
 *
 * Usage:
 *   node scripts/migrate-css-modules.mjs <path-to.tsx> [<path-to.tsx> ...]
 */
import fs from "node:fs";
import path from "node:path";

const SPACING = {
  0: "0",
  px: "1px",
  0.5: "0.125rem",
  1: "0.25rem",
  1.5: "0.375rem",
  2: "0.5rem",
  2.5: "0.625rem",
  3: "0.75rem",
  3.5: "0.875rem",
  4: "1rem",
  5: "1.25rem",
  6: "1.5rem",
  7: "1.75rem",
  8: "2rem",
  9: "2.25rem",
  10: "2.5rem",
  11: "2.75rem",
  12: "3rem",
  14: "3.5rem",
  16: "4rem",
  20: "5rem",
  24: "6rem",
  28: "7rem",
  32: "8rem",
  36: "9rem",
  40: "10rem",
  44: "11rem",
  48: "12rem",
  52: "13rem",
  56: "14rem",
  60: "15rem",
  64: "16rem",
  72: "18rem",
  80: "20rem",
  96: "24rem",
};

const COLORS = {
  background: "var(--background)",
  foreground: "var(--foreground)",
  card: "var(--card)",
  "card-foreground": "var(--card-foreground)",
  popover: "var(--popover)",
  "popover-foreground": "var(--popover-foreground)",
  primary: "var(--primary)",
  "primary-foreground": "var(--primary-foreground)",
  "primary-subtle": "var(--primary-subtle)",
  secondary: "var(--secondary)",
  "secondary-foreground": "var(--secondary-foreground)",
  muted: "var(--muted)",
  "muted-foreground": "var(--muted-foreground)",
  accent: "var(--accent)",
  "accent-foreground": "var(--accent-foreground)",
  destructive: "var(--destructive)",
  border: "var(--border)",
  input: "var(--input)",
  ring: "var(--ring)",
  white: "#ffffff",
  black: "#000000",
  transparent: "transparent",
  current: "currentColor",
  "red-600": "#dc2626",
  "red-700": "#b91c1c",
  "emerald-600": "#059669",
  "emerald-700": "#047857",
  "amber-50": "#fffbeb",
  "amber-100": "#fef3c7",
  "amber-200": "#fde68a",
  "amber-800": "#92400e",
};

const BREAKPOINTS = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
};

function space(n) {
  if (SPACING[n] !== undefined) return SPACING[n];
  if (/^\d+(\.\d+)?$/.test(n)) return `${Number(n) * 0.25}rem`;
  return null;
}

function color(token) {
  if (!token) return null;
  if (COLORS[token]) return COLORS[token];
  // opacity modifiers: primary/50, muted/50
  const m = token.match(/^(.+)\/(\d+)$/);
  if (m) {
    const base = COLORS[m[1]] || (m[1].startsWith("[") ? null : null);
    if (base && base.startsWith("var(")) {
      return `color-mix(in srgb, ${base} ${m[2]}%, transparent)`;
    }
    if (COLORS[m[1]]) {
      return `color-mix(in srgb, ${COLORS[m[1]]} ${m[2]}%, transparent)`;
    }
  }
  // arbitrary: [color-mix(...)] or [#fff]
  if (token.startsWith("[") && token.endsWith("]")) {
    return token.slice(1, -1).replaceAll("_", " ");
  }
  return null;
}

function sizeToken(token) {
  if (token === "full") return "100%";
  if (token === "screen") return "100vh";
  if (token === "min") return "min-content";
  if (token === "max") return "max-content";
  if (token === "fit") return "fit-content";
  if (token === "auto") return "auto";
  if (token === "px") return "1px";
  if (token.startsWith("[") && token.endsWith("]")) {
    return token.slice(1, -1).replaceAll("_", " ");
  }
  return space(token);
}

/** Convert a single utility (no variant prefix) to CSS decls */
function utilToDecls(util) {
  const decls = [];

  // display / flex / grid
  if (util === "flex") decls.push(["display", "flex"]);
  else if (util === "inline-flex") decls.push(["display", "inline-flex"]);
  else if (util === "grid") decls.push(["display", "grid"]);
  else if (util === "hidden") decls.push(["display", "none"]);
  else if (util === "block") decls.push(["display", "block"]);
  else if (util === "inline-block") decls.push(["display", "inline-block"]);
  else if (util === "contents") decls.push(["display", "contents"]);
  else if (util === "flex-col") decls.push(["flex-direction", "column"]);
  else if (util === "flex-row") decls.push(["flex-direction", "row"]);
  else if (util === "flex-wrap") decls.push(["flex-wrap", "wrap"]);
  else if (util === "flex-nowrap") decls.push(["flex-wrap", "nowrap"]);
  else if (util === "flex-1") decls.push(["flex", "1 1 0%"]);
  else if (util === "flex-none") decls.push(["flex", "none"]);
  else if (util === "shrink-0") decls.push(["flex-shrink", "0"]);
  else if (util === "grow") decls.push(["flex-grow", "1"]);
  else if (util === "grow-0") decls.push(["flex-grow", "0"]);
  else if (util === "items-center") decls.push(["align-items", "center"]);
  else if (util === "items-start") decls.push(["align-items", "flex-start"]);
  else if (util === "items-end") decls.push(["align-items", "flex-end"]);
  else if (util === "items-stretch") decls.push(["align-items", "stretch"]);
  else if (util === "items-baseline") decls.push(["align-items", "baseline"]);
  else if (util === "justify-center") decls.push(["justify-content", "center"]);
  else if (util === "justify-between") decls.push(["justify-content", "space-between"]);
  else if (util === "justify-start") decls.push(["justify-content", "flex-start"]);
  else if (util === "justify-end") decls.push(["justify-content", "flex-end"]);
  else if (util === "self-start") decls.push(["align-self", "flex-start"]);
  else if (util === "self-center") decls.push(["align-self", "center"]);
  else if (util === "self-end") decls.push(["align-self", "flex-end"]);
  else if (util === "self-stretch") decls.push(["align-self", "stretch"]);
  else if (util.startsWith("gap-")) {
    const v = sizeToken(util.slice(4));
    if (v) decls.push(["gap", v]);
  } else if (util.startsWith("gap-x-")) {
    const v = sizeToken(util.slice(6));
    if (v) decls.push(["column-gap", v]);
  } else if (util.startsWith("gap-y-")) {
    const v = sizeToken(util.slice(6));
    if (v) decls.push(["row-gap", v]);
  } else if (util.startsWith("space-y-")) {
    // handled specially as sibling rule — mark with custom
    const v = sizeToken(util.slice("space-y-".length));
    if (v) decls.push(["--space-y", v]);
  } else if (util.startsWith("grid-cols-")) {
    const n = util.slice(10);
    if (/^\d+$/.test(n)) decls.push(["grid-template-columns", `repeat(${n}, minmax(0, 1fr))`]);
  } else if (util.startsWith("col-span-")) {
    const n = util.slice(9);
    if (/^\d+$/.test(n)) decls.push(["grid-column", `span ${n} / span ${n}`]);
  } else if (util === "truncate") {
    decls.push(["overflow", "hidden"], ["text-overflow", "ellipsis"], ["white-space", "nowrap"]);
  } else if (util === "whitespace-nowrap" || util === "text-nowrap") {
    decls.push(["white-space", "nowrap"]);
  } else if (util === "whitespace-pre-wrap") {
    decls.push(["white-space", "pre-wrap"]);
  } else if (util === "break-words") {
    decls.push(["overflow-wrap", "break-word"]);
  } else if (util === "text-left") decls.push(["text-align", "left"]);
  else if (util === "text-center") decls.push(["text-align", "center"]);
  else if (util === "text-right") decls.push(["text-align", "right"]);
  else if (util === "underline") decls.push(["text-decoration-line", "underline"]);
  else if (util === "line-through") decls.push(["text-decoration-line", "line-through"]);
  else if (util === "no-underline") decls.push(["text-decoration-line", "none"]);
  else if (util === "uppercase") decls.push(["text-transform", "uppercase"]);
  else if (util === "lowercase") decls.push(["text-transform", "lowercase"]);
  else if (util === "capitalize") decls.push(["text-transform", "capitalize"]);
  else if (util === "italic") decls.push(["font-style", "italic"]);
  else if (util === "font-normal") decls.push(["font-weight", "400"]);
  else if (util === "font-medium") decls.push(["font-weight", "500"]);
  else if (util === "font-semibold") decls.push(["font-weight", "600"]);
  else if (util === "font-bold") decls.push(["font-weight", "700"]);
  else if (util === "text-xs") decls.push(["font-size", "0.75rem"], ["line-height", "1rem"]);
  else if (util === "text-sm") decls.push(["font-size", "0.875rem"], ["line-height", "1.25rem"]);
  else if (util === "text-base") decls.push(["font-size", "1rem"], ["line-height", "1.5rem"]);
  else if (util === "text-lg") decls.push(["font-size", "1.125rem"], ["line-height", "1.75rem"]);
  else if (util === "text-xl") decls.push(["font-size", "1.25rem"], ["line-height", "1.75rem"]);
  else if (util === "text-2xl") decls.push(["font-size", "1.5rem"], ["line-height", "2rem"]);
  else if (util === "leading-none") decls.push(["line-height", "1"]);
  else if (util === "leading-tight") decls.push(["line-height", "1.25"]);
  else if (util === "leading-snug") decls.push(["line-height", "1.375"]);
  else if (util === "tracking-wide") decls.push(["letter-spacing", "0.025em"]);
  else if (util === "tracking-wider") decls.push(["letter-spacing", "0.05em"]);
  else if (util.startsWith("underline-offset-")) {
    const v = sizeToken(util.slice(16));
    if (v) decls.push(["text-underline-offset", v]);
  }   else if (util.startsWith("text-[") && util.endsWith("]")) {
    decls.push(["font-size", util.slice(6, -1).replaceAll("_", " ")]);
  } else if (util.startsWith("leading-[") && util.endsWith("]")) {
    decls.push(["line-height", util.slice(9, -1).replaceAll("_", " ")]);
  } else if (util === "font-mono") {
    decls.push(["font-family", "var(--font-geist-mono), ui-monospace, monospace"]);
  } else if (util === "tabular-nums") {
    decls.push(["font-variant-numeric", "tabular-nums"]);
  } else if (util === "line-clamp-1") {
    decls.push(
      ["overflow", "hidden"],
      ["display", "-webkit-box"],
      ["-webkit-box-orient", "vertical"],
      ["-webkit-line-clamp", "1"],
    );
  } else if (util === "leading-normal") {
    decls.push(["line-height", "1.5"]);
  } else if (util.startsWith("text-") && !util.includes("/") && !util.startsWith("text-[")) {
    const c = color(util.slice(5));
    if (c) decls.push(["color", c]);
  } else if (util.startsWith("text-") && util.includes("/")) {
    const c = color(util.slice(5));
    if (c) decls.push(["color", c]);
  } else if (util.startsWith("bg-")) {
    const c = color(util.slice(3));
    if (c) decls.push(["background-color", c]);
  } else if (util.startsWith("border-") && !["border-t", "border-b", "border-l", "border-r", "border-x", "border-y"].some((p) => util === p || util.startsWith(p + "-") || util.startsWith(p + "["))) {
    // border color or width
    const rest = util.slice(7);
    if (rest === "2" || rest === "4" || rest === "8" || rest === "0") {
      decls.push(["border-width", rest === "0" ? "0" : `${rest}px`]);
      if (rest !== "0") decls.push(["border-style", "solid"]);
    } else if (rest === "dashed") decls.push(["border-style", "dashed"]);
    else if (rest === "solid") decls.push(["border-style", "solid"]);
    else if (rest === "transparent") decls.push(["border-color", "transparent"]);
    else {
      const c = color(rest);
      if (c) decls.push(["border-color", c]);
    }
  } else if (util === "border") {
    decls.push(["border-width", "1px"], ["border-style", "solid"]);
  }   else if (util === "border-t") decls.push(["border-top-width", "1px"], ["border-top-style", "solid"]);
  else if (util === "border-b") decls.push(["border-bottom-width", "1px"], ["border-bottom-style", "solid"]);
  else if (util === "border-l") decls.push(["border-left-width", "1px"], ["border-left-style", "solid"]);
  else if (util === "border-r") decls.push(["border-right-width", "1px"], ["border-right-style", "solid"]);
  else if (util === "border-0") decls.push(["border-width", "0"]);
  else if (util === "border-t-0") decls.push(["border-top-width", "0"]);
  else if (util === "border-b-0") decls.push(["border-bottom-width", "0"]);
  else if (util === "border-2") {
    decls.push(["border-width", "2px"], ["border-style", "solid"]);
  } else if (util.startsWith("-space-x-")) {
    const v = sizeToken(util.slice("-space-x-".length));
    if (v) {
      decls.push(["--space-x", `calc(${v} * -1)`]);
      decls.push(["display", "flex"]);
    }
  } else if (util.startsWith("space-x-")) {
    const v = sizeToken(util.slice("space-x-".length));
    if (v) decls.push(["--space-x", v], ["display", "flex"]);
  } else if (util === "place-items-center") {
    decls.push(["place-items", "center"]);
  } else if (util === "leading-relaxed") {
    decls.push(["line-height", "1.625"]);
  } else if (util.startsWith("stroke-[") && util.endsWith("]")) {
    decls.push(["stroke-width", util.slice(8, -1)]);
  } else if (util.startsWith("rounded")) {
    const rest = util === "rounded" ? "DEFAULT" : util.slice(8); // after rounded-
    const map = {
      DEFAULT: "0.25rem",
      none: "0",
      sm: "0.125rem",
      md: "0.375rem",
      lg: "0.5rem",
      xl: "0.75rem",
      "2xl": "1rem",
      "3xl": "1.5rem",
      full: "9999px",
    };
    if (rest.startsWith("[") && rest.endsWith("]")) {
      decls.push(["border-radius", rest.slice(1, -1)]);
    } else if (map[rest] !== undefined) {
      decls.push(["border-radius", map[rest]]);
    }
  } else if (util.startsWith("p-")) {
    const v = sizeToken(util.slice(2));
    if (v) decls.push(["padding", v]);
  } else if (util.startsWith("px-")) {
    const v = sizeToken(util.slice(3));
    if (v) decls.push(["padding-inline", v]);
  } else if (util.startsWith("py-")) {
    const v = sizeToken(util.slice(3));
    if (v) decls.push(["padding-block", v]);
  } else if (util.startsWith("pt-")) {
    const v = sizeToken(util.slice(3));
    if (v) decls.push(["padding-top", v]);
  } else if (util.startsWith("pb-")) {
    const v = sizeToken(util.slice(3));
    if (v) decls.push(["padding-bottom", v]);
  } else if (util.startsWith("pl-")) {
    const v = sizeToken(util.slice(3));
    if (v) decls.push(["padding-left", v]);
  } else if (util.startsWith("pr-")) {
    const v = sizeToken(util.slice(3));
    if (v) decls.push(["padding-right", v]);
  } else if (util.startsWith("m-")) {
    const v = sizeToken(util.slice(2));
    if (v) decls.push(["margin", v]);
  } else if (util.startsWith("mx-")) {
    const v = sizeToken(util.slice(3));
    if (v) decls.push(["margin-inline", v]);
  } else if (util.startsWith("my-")) {
    const v = sizeToken(util.slice(3));
    if (v) decls.push(["margin-block", v]);
  } else if (util.startsWith("mt-")) {
    const v = sizeToken(util.slice(3));
    if (v) decls.push(["margin-top", v]);
  } else if (util.startsWith("mb-")) {
    const v = sizeToken(util.slice(3));
    if (v) decls.push(["margin-bottom", v]);
  } else if (util.startsWith("ml-")) {
    const v = sizeToken(util.slice(3));
    if (v) decls.push(["margin-left", v]);
  } else if (util.startsWith("mr-")) {
    const v = sizeToken(util.slice(3));
    if (v) decls.push(["margin-right", v]);
  } else if (util.startsWith("-mx-")) {
    const v = sizeToken(util.slice(4));
    if (v) decls.push(["margin-inline", `calc(${v} * -1)`]);
  } else if (util.startsWith("-my-")) {
    const v = sizeToken(util.slice(4));
    if (v) decls.push(["margin-block", `calc(${v} * -1)`]);
  } else if (util.startsWith("w-")) {
    const v = sizeToken(util.slice(2));
    if (v) decls.push(["width", v]);
  } else if (util.startsWith("h-")) {
    const v = sizeToken(util.slice(2));
    if (v) decls.push(["height", v]);
  } else if (util.startsWith("min-w-")) {
    const v = sizeToken(util.slice(6));
    if (v) decls.push(["min-width", v]);
  } else if (util.startsWith("max-w-")) {
    const rest = util.slice(6);
    const named = { full: "100%", prose: "65ch", none: "none", fit: "fit-content" };
    if (named[rest]) decls.push(["max-width", named[rest]]);
    else {
      const v = sizeToken(rest);
      if (v) decls.push(["max-width", v]);
    }
  } else if (util.startsWith("min-h-")) {
    const v = sizeToken(util.slice(6));
    if (v) decls.push(["min-height", v]);
  } else if (util.startsWith("max-h-")) {
    const v = sizeToken(util.slice(6));
    if (v) decls.push(["max-height", v]);
  } else if (util.startsWith("size-")) {
    const v = sizeToken(util.slice(5));
    if (v) decls.push(["width", v], ["height", v]);
  } else if (util === "overflow-hidden") decls.push(["overflow", "hidden"]);
  else if (util === "overflow-auto") decls.push(["overflow", "auto"]);
  else if (util === "overflow-x-auto") decls.push(["overflow-x", "auto"]);
  else if (util === "overflow-y-auto") decls.push(["overflow-y", "auto"]);
  else if (util === "overflow-x-clip") decls.push(["overflow-x", "clip"]);
  else if (util === "overscroll-x-contain") decls.push(["overscroll-behavior-x", "contain"]);
  else if (util === "relative") decls.push(["position", "relative"]);
  else if (util === "absolute") decls.push(["position", "absolute"]);
  else if (util === "fixed") decls.push(["position", "fixed"]);
  else if (util === "sticky") decls.push(["position", "sticky"]);
  else if (util === "inset-0") decls.push(["inset", "0"]);
  else if (util.startsWith("top-")) {
    const v = sizeToken(util.slice(4));
    if (v) decls.push(["top", v]);
  } else if (util.startsWith("right-")) {
    const v = sizeToken(util.slice(6));
    if (v) decls.push(["right", v]);
  } else if (util.startsWith("bottom-")) {
    const v = sizeToken(util.slice(7));
    if (v) decls.push(["bottom", v]);
  } else if (util.startsWith("left-")) {
    const v = sizeToken(util.slice(5));
    if (v) decls.push(["left", v]);
  } else if (util.startsWith("z-")) {
    const n = util.slice(2);
    if (/^\d+$/.test(n)) decls.push(["z-index", n]);
  } else if (util === "pointer-events-none") decls.push(["pointer-events", "none"]);
  else if (util === "pointer-events-auto") decls.push(["pointer-events", "auto"]);
  else if (util === "select-none") decls.push(["user-select", "none"]);
  else if (util === "cursor-pointer") decls.push(["cursor", "pointer"]);
  else if (util === "cursor-default") decls.push(["cursor", "default"]);
  else if (util === "cursor-not-allowed") decls.push(["cursor", "not-allowed"]);
  else if (util === "opacity-0") decls.push(["opacity", "0"]);
  else if (util === "opacity-50") decls.push(["opacity", "0.5"]);
  else if (util === "opacity-60") decls.push(["opacity", "0.6"]);
  else if (util === "opacity-70") decls.push(["opacity", "0.7"]);
  else if (util === "opacity-80") decls.push(["opacity", "0.8"]);
  else if (util === "opacity-100") decls.push(["opacity", "1"]);
  else if (util === "shadow-sm") decls.push(["box-shadow", "0 1px 2px 0 rgb(0 0 0 / 0.05)"]);
  else if (util === "shadow") decls.push(["box-shadow", "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)"]);
  else if (util === "shadow-md")
    decls.push(["box-shadow", "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)"]);
  else if (util === "shadow-lg")
    decls.push(["box-shadow", "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)"]);
  else if (util === "shadow-none") decls.push(["box-shadow", "none"]);
  else if (util === "outline-none") decls.push(["outline", "none"]);
  else if (util === "ring-0") decls.push(["--tw-ring-shadow", "0 0 #0000"], ["box-shadow", "var(--tw-ring-shadow)"]);
  else if (util === "transition")
    decls.push(["transition-property", "color, background-color, border-color, opacity, box-shadow, transform"], [
      "transition-duration",
      "150ms",
    ]);
  else if (util === "transition-all") decls.push(["transition-property", "all"], ["transition-duration", "150ms"]);
  else if (util === "transition-colors")
    decls.push(["transition-property", "color, background-color, border-color"], ["transition-duration", "150ms"]);
  else if (util === "animate-spin")
    decls.push(["animation", "spin 1s linear infinite"]);
  else if (util === "animate-pulse")
    decls.push(["animation", "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"]);
  else if (util === "sr-only") {
    decls.push(
      ["position", "absolute"],
      ["width", "1px"],
      ["height", "1px"],
      ["padding", "0"],
      ["margin", "-1px"],
      ["overflow", "hidden"],
      ["clip", "rect(0, 0, 0, 0)"],
      ["white-space", "nowrap"],
      ["border-width", "0"],
    );
  } else if (util === "snap-x") decls.push(["scroll-snap-type", "x mandatory"]);
  else if (util === "snap-mandatory") {
    /* covered by snap-x */
  } else if (util === "object-cover") decls.push(["object-fit", "cover"]);
  else if (util === "object-contain") decls.push(["object-fit", "contain"]);
  else if (util === "aspect-square") decls.push(["aspect-ratio", "1 / 1"]);
  else if (util === "aspect-video") decls.push(["aspect-ratio", "16 / 9"]);
  else if (util === "table") decls.push(["display", "table"]);
  else if (util === "table-fixed") decls.push(["table-layout", "fixed"]);
  else if (util === "border-collapse") decls.push(["border-collapse", "collapse"]);
  else if (util === "w-full") decls.push(["width", "100%"]);
  else if (util === "h-full") decls.push(["height", "100%"]);
  else if (util === "min-w-0") decls.push(["min-width", "0"]);
  else if (util === "max-w-full") decls.push(["max-width", "100%"]);
  else if (util === "disabled:pointer-events-none") {
    /* variant handled elsewhere */
  }

  return decls;
}

function parseClassString(classStr) {
  // Split on spaces but keep arbitrary values [...]
  const tokens = [];
  let cur = "";
  let bracket = 0;
  for (const ch of classStr.trim()) {
    if (ch === "[") bracket++;
    if (ch === "]") bracket = Math.max(0, bracket - 1);
    if (/\s/.test(ch) && bracket === 0) {
      if (cur) tokens.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur) tokens.push(cur);
  return tokens;
}

function classStringToRule(classStr, className) {
  const tokens = parseClassString(classStr);
  const base = [];
  const media = new Map(); // bp -> decls
  const pseudo = new Map(); // hover|focus|... -> decls
  let spaceY = null;
  const unhandled = [];

  for (const token of tokens) {
    // skip group/peer markers and data attrs that are complex
    if (token.startsWith("group") || token.startsWith("peer") || token.startsWith("data-") || token.startsWith("aria-") || token.startsWith("has-") || token.startsWith("dark:") || token.startsWith("motion-") || token.includes("[")) {
      // try still for simple arbitrary values without pseudo
      if (token.includes(":") && !token.startsWith("[")) {
        // fall through to variant parsing
      } else if (token.startsWith("[") || token.includes("[")) {
        // try as single util with arbitrary
        const decls = utilToDecls(token);
        if (decls.length) {
          base.push(...decls);
          continue;
        }
        unhandled.push(token);
        continue;
      }
    }

    const parts = [];
    let rest = token;
    // split variants carefully
    while (rest.includes(":")) {
      const idx = rest.indexOf(":");
      const maybe = rest.slice(0, idx);
      // if maybe looks like a breakpoint or pseudo
      if (BREAKPOINTS[maybe] || ["hover", "focus", "focus-visible", "active", "disabled", "visited", "first", "last"].includes(maybe)) {
        parts.push(maybe);
        rest = rest.slice(idx + 1);
      } else break;
    }

    const util = rest;
    if (util.startsWith("space-y-")) {
      spaceY = sizeToken(util.slice("space-y-".length));
      if (!spaceY) unhandled.push(token);
      continue;
    }
    if (util.startsWith("space-x-") || util.startsWith("-space-x-")) {
      const neg = util.startsWith("-");
      const raw = neg ? util.slice("-space-x-".length) : util.slice("space-x-".length);
      const v = sizeToken(raw);
      if (v) {
        base.push(["display", "flex"]);
        // approximate space-x via margin on children using a custom prop
        spaceY = null;
        base.push(["column-gap", neg ? `calc(${v} * -1)` : v]);
      } else unhandled.push(token);
      continue;
    }

    const decls = utilToDecls(util);
    if (!decls.length) {
      unhandled.push(token);
      continue;
    }

    const bps = parts.filter((p) => BREAKPOINTS[p]);
    const pseudos = parts.filter((p) => !BREAKPOINTS[p]);

    if (bps.length === 0 && pseudos.length === 0) {
      base.push(...decls);
    } else if (bps.length && !pseudos.length) {
      const bp = bps[bps.length - 1];
      if (!media.has(bp)) media.set(bp, []);
      media.get(bp).push(...decls);
    } else if (!bps.length && pseudos.length) {
      const key = pseudos.join(":");
      if (!pseudo.has(key)) pseudo.set(key, []);
      pseudo.get(key).push(...decls);
    } else {
      // combine: put under media with pseudo suffix key
      const bp = bps[bps.length - 1];
      const key = `${bp}::${pseudos.join(":")}`;
      if (!media.has(key)) media.set(key, []);
      media.get(key).push(...decls);
    }
  }

  const lines = [];
  const declLines = (arr) => {
    // dedupe by property keeping last
    const map = new Map(arr);
    return [...map.entries()].map(([k, v]) => `  ${k}: ${v};`).join("\n");
  };

  lines.push(`.${className} {`);
  if (base.length) lines.push(declLines(base));
  lines.push(`}`);

  if (spaceY) {
    lines.push(`.${className} > * + * {`);
    lines.push(`  margin-block-start: ${spaceY};`);
    lines.push(`}`);
  }

  for (const [key, decls] of pseudo) {
    const sel = key
      .split(":")
      .map((p) => {
        if (p === "hover") return ":hover";
        if (p === "focus") return ":focus";
        if (p === "focus-visible") return ":focus-visible";
        if (p === "active") return ":active";
        if (p === "disabled") return ":disabled";
        return `:${p}`;
      })
      .join("");
    lines.push(`.${className}${sel} {`);
    lines.push(declLines(decls));
    lines.push(`}`);
  }

  for (const [key, decls] of media) {
    if (key.includes("::")) {
      const [bp, pseudoKey] = key.split("::");
      const sel = pseudoKey
        .split(":")
        .map((p) => {
          if (p === "hover") return ":hover";
          if (p === "focus") return ":focus";
          if (p === "focus-visible") return ":focus-visible";
          if (p === "active") return ":active";
          if (p === "disabled") return ":disabled";
          return `:${p}`;
        })
        .join("");
      lines.push(`@media (min-width: ${BREAKPOINTS[bp]}) {`);
      lines.push(`  .${className}${sel} {`);
      lines.push(
        [...new Map(decls).entries()]
          .map(([k, v]) => `    ${k}: ${v};`)
          .join("\n"),
      );
      lines.push(`  }`);
      lines.push(`}`);
    } else {
      lines.push(`@media (min-width: ${BREAKPOINTS[key]}) {`);
      lines.push(`  .${className} {`);
      lines.push(
        [...new Map(decls).entries()]
          .map(([k, v]) => `    ${k}: ${v};`)
          .join("\n"),
      );
      lines.push(`  }`);
      lines.push(`}`);
    }
  }

  return { css: lines.join("\n"), unhandled };
}

function toCamel(str) {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "")
    .replace(/^(.)/, (c) => c.toLowerCase());
}

function extractExports(src) {
  const values = new Set();
  const types = new Set();
  for (const m of src.matchAll(/export (?:async )?function (\w+)/g)) values.add(m[1]);
  for (const m of src.matchAll(/export const (\w+)/g)) values.add(m[1]);
  for (const m of src.matchAll(/export type (\w+)/g)) types.add(m[1]);
  for (const m of src.matchAll(/export interface (\w+)/g)) types.add(m[1]);
  return { values: [...values], types: [...types] };
}

function migrateFile(tsxPath) {
  const abs = path.resolve(tsxPath);
  if (!fs.existsSync(abs)) {
    console.error("missing", abs);
    return;
  }
  const base = path.basename(abs, ".tsx");
  const parent = path.dirname(abs);
  const targetDir = path.join(parent, base);

  if (fs.existsSync(targetDir) && fs.statSync(targetDir).isDirectory()) {
    // already folderized — migrate in place if tsx is inside
    console.log("already folder:", base);
  }

  let src = fs.readFileSync(abs, "utf8");
  const seen = new Map(); // literal -> className
  let i = 0;

  // Collect all double/single-quoted strings that look like Tailwind class lists
  const re = /(["'])([^"'\\\n]*)\1/g;
  let m;
  const candidates = [];
  const utilRe =
    /(^|\s)(!?-?(?:flex|grid|block|inline-flex|inline-block|inline|hidden|contents|items-|justify-|self-|gap-|p-|px-|py-|pt-|pb-|pl-|pr-|m-|mx-|my-|mt-|mb-|ml-|mr-|text-|bg-|border|rounded|w-|h-|min-|max-|overflow|relative|absolute|fixed|sticky|shadow|truncate|space-|col-|size-|font-|leading-|tracking-|opacity-|cursor-|pointer|transition|animate-|sr-only|table|underline|line-through|whitespace-|break-|snap-|object-|aspect-|z-|top-|left-|right-|bottom-|inset-|shrink-|grow|select-|outline-|ring-|tabular|line-clamp))/;
  while ((m = re.exec(src))) {
    const lit = m[2];
    if (!lit || !lit.trim()) continue;
    if (lit.includes("styles.") || lit.includes("/") && lit.includes(".") && !utilRe.test(lit)) continue;
    // skip import paths / urls / non-class strings
    if (lit.startsWith("@/") || lit.startsWith("./") || lit.startsWith("../") || lit.startsWith("http")) continue;
    if (lit.includes("${")) continue;
    if (!utilRe.test(lit)) continue;
    // skip single-token values that are common HTML attribute values / non-class strings
    const trimmed = lit.trim();
    if (!trimmed.includes(" ") && !trimmed.includes("-") && !trimmed.includes("[")) {
      continue; // require compound utilities (gap-2, flex-col, etc.) or multi-class strings
    }
    candidates.push(lit);
  }

  // Also catch template-ish cn("a", "b") multiple strings — already covered by re

  for (const lit of candidates) {
    if (seen.has(lit)) continue;
    i += 1;
    let name = `c${i}`;
    // try to invent better name from first few tokens
    const first = parseClassString(lit)[0]?.replace(/[^a-zA-Z0-9]/g, "") || name;
    name = toCamel(first) || name;
    if ([...seen.values()].includes(name)) name = `${name}${i}`;
    seen.set(lit, name);
  }

  if (seen.size === 0 && !src.includes("className=")) {
    // still folderize
  }

  const cssParts = [];
  cssParts.push("/* Migrated from Tailwind utilities: plain CSS only, no @apply */");
  const allUnhandled = [];
  for (const [lit, name] of seen) {
    const { css, unhandled } = classStringToRule(lit, name);
    cssParts.push(css);
    if (unhandled.length) allUnhandled.push({ name, unhandled });
  }

  // Ensure folder
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir);

  const destTsx = path.join(targetDir, `${base}.tsx`);
  const destCss = path.join(targetDir, `${base}.module.css`);
  const destIndex = path.join(targetDir, "index.ts");

  // Rewrite source
  let out = src;
  // ensure styles import
  if (!out.includes(`${base}.module.css`)) {
    // add after last import
    const importBlock = out.match(/^(?:import[\s\S]*?;\r?\n)+/);
    const inject = `import styles from "./${base}.module.css";\n`;
    if (importBlock) {
      out = out.slice(0, importBlock[0].length) + inject + out.slice(importBlock[0].length);
    } else {
      out = inject + out;
    }
  }

  // Replace quoted utility literals with styles.xxx (literals are unique long class strings)
  for (const [lit, name] of seen) {
    out = out.split(`className="${lit}"`).join(`className={styles.${name}}`);
    out = out.split(`className='${lit}'`).join(`className={styles.${name}}`);
    out = out.split(`"${lit}"`).join(`styles.${name}`);
    out = out.split(`'${lit}'`).join(`styles.${name}`);
    out = out.split(`\`${lit}\``).join(`styles.${name}`);
  }

  // Move dashboard.module.css special case handled outside

  fs.writeFileSync(destCss, cssParts.join("\n\n") + "\n", "utf8");
  fs.writeFileSync(destTsx, out, "utf8");

  const { values, types } = extractExports(out);
  let index = "";
  if (values.length) index += `export { ${values.join(", ")} } from "./${base}";\n`;
  if (types.length) index += `export type { ${types.join(", ")} } from "./${base}";\n`;
  if (!index) index = `export * from "./${base}";\n`;
  fs.writeFileSync(destIndex, index, "utf8");

  // remove original if different path
  if (path.resolve(abs) !== path.resolve(destTsx)) {
    fs.unlinkSync(abs);
  }

  console.log(`OK ${base} classes=${seen.size} unhandled=${allUnhandled.reduce((n, u) => n + u.unhandled.length, 0)}`);
  if (allUnhandled.length) {
    for (const u of allUnhandled.slice(0, 5)) {
      console.log(`  ~${u.name}: ${u.unhandled.slice(0, 8).join(", ")}`);
    }
  }
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error("Usage: node scripts/migrate-css-modules.mjs <file.tsx>...");
  process.exit(1);
}
for (const f of files) migrateFile(f);
