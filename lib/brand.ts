/**
 * HH Goa 2026 brand tokens + deterministic "builder identity" generation.
 * Palette + type sampled from hhgoa.com so output is unmistakably this event.
 */

export const PALETTE = {
  green: "#0B6839",
  greenDeep: "#04361D",
  greenInk: "#062B17",
  cream: "#FFF6E0",
  creamSoft: "#FFFBE8",
  pink: "#FF0080",
  yellow: "#FEE101",
  yellowDeep: "#EDD723",
  ink: "#0A0A0A",
  sand: "#F4E2B8",
  sea: "#0E7C7B",
  sunset: "#FF5A1F",
} as const;

export const EVENT = {
  name: "HACKER HOUSE GOA",
  short: "HH GOA",
  year: "2026",
  dates: "28 – 31 OCT 2026",
  datesTight: "28-31 OCT 2026",
  place: "GOA, INDIA",
  studio: "2:47 PM STUDIO",
  site: "hhgoa.com",
  hashtag: "#FrameInGoa",
  tagline: "LESS NOISE. MORE SIGNAL.",
  taglineAlt: "4 DAYS. ONE RHYTHM.",
  seats: "247 BUILDERS",
} as const;

export type ThemeId = "paradise" | "sunset" | "midnight";

export interface Theme {
  id: ThemeId;
  label: string;
  /** paper the card is printed on */
  bg: string;
  bgAlt: string;
  ink: string;
  inkSoft: string;
  accent: string;
  accent2: string;
  /** full-bleed border the card sits on */
  frame: string;
  frameInk: string;
  /** name plate */
  plate: string;
  plateInk: string;
  /** dark backdrop => halftone + grain need different blend */
  dark: boolean;
}

export const THEMES: Record<ThemeId, Theme> = {
  paradise: {
    id: "paradise",
    label: "PARADISE",
    bg: PALETTE.cream,
    bgAlt: PALETTE.creamSoft,
    ink: PALETTE.greenInk,
    inkSoft: "rgba(6,43,23,0.55)",
    accent: PALETTE.pink,
    accent2: PALETTE.yellow,
    frame: PALETTE.green,
    frameInk: PALETTE.creamSoft,
    plate: PALETTE.green,
    plateInk: PALETTE.cream,
    dark: false,
  },
  sunset: {
    id: "sunset",
    label: "SUNSET",
    bg: "#FFE2BC",
    bgAlt: "#FFC98F",
    ink: "#48122C",
    inkSoft: "rgba(72,18,44,0.55)",
    accent: "#D1145A",
    accent2: "#FFC400",
    frame: "#D1145A",
    frameInk: "#FFF1D6",
    plate: "#48122C",
    plateInk: "#FFE2BC",
    dark: false,
  },
  midnight: {
    id: "midnight",
    label: "MIDNIGHT",
    bg: "#07281A",
    bgAlt: "#0B3A26",
    ink: PALETTE.creamSoft,
    inkSoft: "rgba(255,251,232,0.6)",
    accent: PALETTE.pink,
    accent2: PALETTE.yellow,
    frame: "#04160E",
    frameInk: PALETTE.yellow,
    plate: PALETTE.yellow,
    plateInk: "#04160E",
    dark: true,
  },
};

export const THEME_LIST: Theme[] = [THEMES.paradise, THEMES.sunset, THEMES.midnight];

/* ------------------------------------------------------------------ */
/* deterministic identity                                              */
/* ------------------------------------------------------------------ */

/** FNV-1a — stable across runs/devices so a name always maps to the same card. */
export function hash(input: string): number {
  let h = 0x811c9dc5;
  const s = input.trim().toLowerCase() || "builder";
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function pick<T>(arr: readonly T[], seed: number, salt: number): T {
  return arr[(seed + salt * 0x9e3779b1) % arr.length];
}

const CLASSES = [
  "TERMINAL WIZARD",
  "SHADER SHAMAN",
  "LATENCY HUNTER",
  "PROTOCOL PIRATE",
  "PIXEL SMUGGLER",
  "MERGE CONFLICT SLAYER",
  "NIGHT SHIFT ORACLE",
  "PROMPT ALCHEMIST",
  "REGEX MONK",
  "TYPE SAFETY ZEALOT",
  "COLD START SURFER",
  "CACHE WHISPERER",
  "ZERO KNOWLEDGE NOMAD",
  "BUFFER OVERLORD",
  "DEPLOY DAREDEVIL",
  "SEMICOLON MINIMALIST",
  "GPU MONSOON",
  "EDGE RUNTIME RONIN",
  "STATE MACHINE SAILOR",
  "PACKET BEACHCOMBER",
] as const;

interface Rarity {
  label: string;
  weight: number;
  color: string;
}

const RARITY: Rarity[] = [
  { label: "COMMON", weight: 46, color: "#0B6839" },
  { label: "RARE", weight: 30, color: "#0E7C7B" },
  { label: "EPIC", weight: 17, color: "#FF0080" },
  { label: "LEGENDARY", weight: 7, color: "#EDD723" },
];

const BAG = [
  ["COCONUT", "VS CODE", "LO-FI BEATS"],
  ["FILTER COFFEE", "NEOVIM", "SUNSCREEN"],
  ["CHAI FLASK", "MECH KEYBOARD", "SALT AIR"],
  ["COLD BREW", "TMUX", "SURF WAX"],
  ["FENI (ONE)", "GHOSTTY", "OCEAN NOISE"],
  ["MANGO SLICE", "CURSOR", "HAMMOCK WIFI"],
] as const;

const SHIPPING = [
  "BUILDING THE FUTURE",
  "SHIPPING FROM SAND",
  "0 TO 1, ON THE BEACH",
  "SOMETHING UNREASONABLE",
  "AN UNFAIR ADVANTAGE",
  "DEMO ON DAY FOUR",
  "AGENTS THAT ACTUALLY WORK",
  "LESS NOISE, MORE SIGNAL",
] as const;

export interface Identity {
  builderId: string;
  builderClass: string;
  rarity: Rarity;
  bag: readonly string[];
  shipping: string;
  seed: number;
}

export function identityFor(name: string, role: string): Identity {
  const seed = hash(`${name}|${role}`);
  let roll = seed % 100;
  let rarity = RARITY[0];
  for (const r of RARITY) {
    if (roll < r.weight) {
      rarity = r;
      break;
    }
    roll -= r.weight;
  }
  return {
    seed,
    builderId: `HH-GOA-${(seed % 9000) + 1000}`,
    builderClass: pick(CLASSES, seed, 1),
    rarity,
    bag: pick(BAG, seed, 2),
    shipping: pick(SHIPPING, seed, 3),
  };
}

/* ------------------------------------------------------------------ */
/* share copy                                                          */
/* ------------------------------------------------------------------ */

export function tweetText(opts: {
  name?: string;
  role?: string;
  builderId?: string;
  builderClass?: string;
  format: string;
  url?: string;
}): string {
  const who = opts.name?.trim() || "I";
  const lines: string[] = [];
  lines.push(`🌴 Just minted my HH Goa 2026 ${opts.format} at Frame In Goa.`);
  lines.push("");
  if (opts.name?.trim()) lines.push(`👤 ${who}${opts.role?.trim() ? ` — ${opts.role.trim()}` : ""}`);
  if (opts.builderClass) lines.push(`⚡ Builder class: ${opts.builderClass}`);
  if (opts.builderId) lines.push(`🪪 Builder ID: #${opts.builderId}`);
  lines.push("");
  lines.push("Build in Goa. Ship from paradise. 28–31 Oct 2026.");
  lines.push("");
  lines.push(`Make yours in 5 seconds: ${opts.url || ""}`.trim());
  lines.push("");
  lines.push(`${EVENT.hashtag} #HHGoa2026`);
  return lines.join("\n");
}
