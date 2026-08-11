/**
 * The four HH Goa output formats. Each one paints straight to a 2D canvas at
 * full export resolution — no DOM screenshotting, no server round trip, so a
 * redraw is ~5–15ms and "upload → finished art" stays inside one frame budget.
 */

import QRCode from "qrcode";
import { EVENT, identityFor, THEMES, type Theme, type ThemeId } from "../brand";
import type { LoadedPhoto } from "./photo";
import {
  arcText,
  barcode,
  clipCircle,
  dashRing,
  drawPhotoCover,
  ensureFonts,
  fillRound,
  grain,
  halftone,
  measure,
  palm,
  roundRect,
  strokeRound,
  sunburst,
  text,
  tintedAsset,
  waves,
  type Ctx,
} from "./draw";

export type FormatId = "pfp" | "pass" | "crew" | "banner";

export interface Member {
  id: string;
  photo: LoadedPhoto | null;
  name: string;
  role: string;
  zoom: number;
  offset: { x: number; y: number };
}

export interface CardState {
  format: FormatId;
  themeId: ThemeId;
  members: Member[];
  teamName: string;
  showName: boolean;
  /** encoded into the QR block; falls back to the event site */
  qrUrl: string;
}

export const FORMATS: Record<
  FormatId,
  { id: FormatId; label: string; blurb: string; w: number; h: number; multi: boolean }
> = {
  pass: {
    id: "pass",
    label: "BUILDER PASS",
    blurb: "4:5 badge for the timeline",
    w: 1080,
    h: 1350,
    multi: false,
  },
  pfp: {
    id: "pfp",
    label: "PFP FRAME",
    blurb: "Circle-safe profile picture",
    w: 1080,
    h: 1080,
    multi: false,
  },
  crew: {
    id: "crew",
    label: "CREW FRAME",
    blurb: "Up to 6 teammates, one frame",
    w: 1600,
    h: 900,
    multi: true,
  },
  banner: {
    id: "banner",
    label: "X BANNER",
    blurb: "1500×500 profile header",
    w: 1500,
    h: 500,
    multi: false,
  },
};

const WORDMARK = "/brand/hacker-house.png";
const GOA_HINDI = "/brand/goa-hindi.svg";
const STUDIO = "/brand/studio-247.svg";

/* ------------------------------------------------------------------ qr */

const qrCache = new Map<string, HTMLCanvasElement>();
async function qr(value: string, size: number, dark: string, light: string) {
  const key = `${value}|${size}|${dark}|${light}`;
  const hit = qrCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  try {
    await QRCode.toCanvas(c, value || `https://${EVENT.site}`, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark, light },
    });
  } catch {
    return null;
  }
  qrCache.set(key, c);
  return c;
}

/* -------------------------------------------------------------- chrome */

function backdrop(ctx: Ctx, W: number, H: number, t: Theme) {
  ctx.fillStyle = t.frame;
  ctx.fillRect(0, 0, W, H);
  halftone(ctx, 0, 0, W, H, t.frameInk, 22, 2.4, 0.13);
}

/** Scalloped stamp edge around the card so it reads as a postage stamp. */
function scallop(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  r: number,
  gap: number
) {
  ctx.save();
  ctx.fillStyle = color;
  const dot = (px: number, py: number) => {
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  };
  const nx = Math.round(w / gap);
  const ny = Math.round(h / gap);
  for (let i = 1; i < nx; i++) {
    dot(x + (w * i) / nx, y);
    dot(x + (w * i) / nx, y + h);
  }
  for (let i = 1; i < ny; i++) {
    dot(x, y + (h * i) / ny);
    dot(x + w, y + (h * i) / ny);
  }
  ctx.restore();
}

async function wordmark(ctx: Ctx, cx: number, top: number, height: number, color: string) {
  const img = await tintedAsset(WORDMARK, color, height);
  if (img) {
    ctx.drawImage(img, cx - img.width / 2, top, img.width, img.height);
    return img.width;
  }
  const size = height * 1.15;
  text(ctx, "HACKER HOUSE", cx, top + height * 0.82, {
    size,
    color,
    family: "display",
    weight: 700,
    align: "center",
    tracking: 2,
  });
  return size * 6;
}

async function goaSticker(ctx: Ctx, cx: number, cy: number, size: number, color: string, rot = -0.12) {
  const img = await tintedAsset(GOA_HINDI, color, size);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  if (img) ctx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height);
  else
    text(ctx, "गोवा", 0, size * 0.36, {
      size: size * 0.95,
      color,
      family: "display",
      weight: 700,
      align: "center",
    });
  ctx.restore();
}

/** Round rubber-stamp seal: rim text up top, palm + year in the middle. */
function seal(ctx: Ctx, cx: number, cy: number, r: number, t: Theme, label: string) {
  ctx.save();
  ctx.strokeStyle = t.ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 8, 0, Math.PI * 2);
  ctx.stroke();
  arcText(ctx, label, cx, cy, r - 19, -Math.PI / 2, {
    size: r * 0.155,
    color: t.ink,
    weight: 700,
    tracking: 1.2,
  });
  arcText(ctx, `· GOA · INDIA ·`, cx, cy, r - 19, Math.PI / 2, {
    size: r * 0.145,
    color: t.accent,
    weight: 700,
    tracking: 1.2,
    direction: -1,
  });
  text(ctx, EVENT.year, cx, cy + r * 0.1, {
    size: r * 0.3,
    color: t.accent,
    weight: 700,
    align: "center",
    tracking: 1,
  });
  ctx.restore();
}

/** Small perforated stamp in the corner ("GOA INDIA"). */
function cornerStamp(ctx: Ctx, x: number, y: number, s: number, t: Theme) {
  ctx.save();
  fillRound(ctx, x, y, s, s, 6, t.bgAlt);
  strokeRound(ctx, x + 5, y + 5, s - 10, s - 10, 4, t.ink, 2, [6, 6]);
  sunburst(ctx, x + s / 2, y + s * 0.6, s * 0.28, t.accent, 3, 0.95);
  text(ctx, "GOA", x + s / 2, y + s * 0.84, {
    size: s * 0.16,
    color: t.ink,
    weight: 700,
    align: "center",
    tracking: 3,
  });
  text(ctx, "INDIA", x + s / 2, y + s * 0.2, {
    size: s * 0.13,
    color: t.inkSoft,
    weight: 600,
    align: "center",
    tracking: 3,
  });
  ctx.restore();
}

function labelValue(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  label: string,
  value: string,
  t: Theme,
  align: CanvasTextAlign = "left"
) {
  const ax = align === "center" ? x + w / 2 : align === "right" ? x + w : x;
  text(ctx, label, ax, y, {
    size: 19,
    color: t.accent,
    weight: 700,
    tracking: 3.4,
    align,
    maxWidth: w,
  });
  text(ctx, value, ax, y + 34, {
    size: 27,
    color: t.ink,
    weight: 700,
    tracking: 0.6,
    align,
    maxWidth: w,
  });
}

function pill(
  ctx: Ctx,
  cx: number,
  cy: number,
  label: string,
  t: Theme,
  fill: string,
  ink: string,
  size = 30,
  padX = 30
) {
  const w = measure(ctx, label, { size, color: ink, weight: 700, tracking: 4 }) + padX * 2;
  const h = size * 1.85;
  fillRound(ctx, cx - w / 2, cy - h / 2, w, h, h / 2, fill);
  text(ctx, label, cx, cy + size * 0.35, {
    size,
    color: ink,
    weight: 700,
    align: "center",
    tracking: 4,
  });
  return { w, h };
}

/* ------------------------------------------------------------ template: pass */

async function drawPass(ctx: Ctx, s: CardState, t: Theme) {
  const W = FORMATS.pass.w;
  const H = FORMATS.pass.h;
  const m = s.members[0];
  const name = (m?.name || "").trim().toUpperCase() || "YOUR NAME";
  const role = (m?.role || "").trim().toUpperCase() || "BUILDER";
  const id = identityFor(m?.name || "builder", m?.role || "");

  backdrop(ctx, W, H, t);
  palm(ctx, 92, H - 34, 0.62, t.frameInk, false, 0.5);
  palm(ctx, W - 92, H - 34, 0.62, t.frameInk, true, 0.5);

  // card
  const cx = 40,
    cy = 40,
    cw = W - 80,
    ch = H - 80;
  ctx.save();
  ctx.fillStyle = t.bg;
  roundRect(ctx, cx, cy, cw, ch, 30);
  ctx.fill();
  ctx.restore();
  scallop(ctx, cx, cy, cw, ch, t.frame, 11, 30);
  strokeRound(ctx, cx + 20, cy + 20, cw - 40, ch - 40, 18, t.accent, 2.5, [10, 11]);
  halftone(ctx, cx, cy, cw, ch, t.ink, 26, 1.7, 0.07);

  const mid = W / 2;

  // header
  cornerStamp(ctx, 84, 78, 118, t);
  const bw = 210,
    bh = 108;
  fillRound(ctx, mid - bw / 2, 78, bw, bh, 16, t.frame);
  text(ctx, "HH GOA", mid, 78 + 46, {
    size: 36,
    color: t.frameInk,
    weight: 700,
    align: "center",
    tracking: 2,
  });
  text(ctx, EVENT.year, mid, 78 + 88, {
    size: 34,
    color: t.accent2,
    weight: 700,
    align: "center",
    tracking: 6,
  });
  seal(ctx, W - 84 - 59, 78 + 59, 59, t, "OFFICIAL BUILDER PASS •");

  // wordmark + गोवा sticker
  const markW = await wordmark(ctx, mid - 52, 208, 100, t.ink);
  await goaSticker(ctx, mid - 52 + markW / 2 + 84, 248, 92, t.accent, -0.14);
  text(ctx, `${EVENT.place}  ·  ${EVENT.dates}`, mid, 354, {
    size: 25,
    color: t.inkSoft,
    weight: 600,
    align: "center",
    tracking: 5.5,
  });

  // portrait
  const ps = 440;
  const px = mid - ps / 2;
  const py = 386;
  ctx.save();
  fillRound(ctx, px + 16, py + 16, ps, ps, 30, t.accent);
  ctx.restore();
  ctx.save();
  roundRect(ctx, px, py, ps, ps, 30);
  ctx.clip();
  ctx.fillStyle = t.bgAlt;
  ctx.fillRect(px, py, ps, ps);
  if (m?.photo) {
    drawPhotoCover(
      ctx,
      m.photo.bitmap,
      m.photo.width,
      m.photo.height,
      { x: px, y: py, w: ps, h: ps },
      m.photo.focus,
      m.zoom,
      m.offset
    );
  } else {
    text(ctx, "DROP A PHOTO", mid, py + ps / 2, {
      size: 34,
      color: t.inkSoft,
      weight: 700,
      align: "center",
      tracking: 4,
    });
  }
  ctx.restore();
  strokeRound(ctx, px, py, ps, ps, 30, t.ink, 8);
  // rarity chip
  const rc = id.rarity;
  ctx.save();
  ctx.translate(px + ps - 8, py + 26);
  ctx.rotate(0.06);
  pill(ctx, 0, 0, rc.label, t, rc.color, rc.label === "LEGENDARY" ? "#04160E" : "#FFF6E0", 22, 20);
  ctx.restore();

  // identity plate
  fillRound(ctx, 140, 858, W - 280, 78, 16, t.plate);
  text(ctx, name, mid, 858 + 54, {
    size: 48,
    color: t.plateInk,
    weight: 700,
    align: "center",
    tracking: 2,
    maxWidth: W - 320,
  });
  pill(ctx, mid, 976, role, t, t.accent2, "#0A0A0A", 27, 26);

  // info columns
  const colW = (cw - 120) / 2;
  labelValue(ctx, cx + 60, 1032, colW - 20, "BUILDER CLASS", id.builderClass, t);
  labelValue(ctx, cx + 60 + colW, 1032, colW - 20, "CURRENTLY SHIPPING", id.shipping, t, "right");

  // perforation + stub
  ctx.save();
  ctx.strokeStyle = t.inkSoft;
  ctx.lineWidth = 2;
  ctx.setLineDash([9, 10]);
  ctx.beginPath();
  ctx.moveTo(cx + 24, 1098);
  ctx.lineTo(cx + cw - 24, 1098);
  ctx.stroke();
  ctx.restore();

  const stubY = 1130;
  text(ctx, "BEACH BAG", cx + 60, stubY, {
    size: 18,
    color: t.accent,
    weight: 700,
    tracking: 3.4,
  });
  text(ctx, id.bag.join("  /  "), cx + 60, stubY + 30, {
    size: 23,
    color: t.ink,
    weight: 600,
    tracking: 1,
    maxWidth: 470,
  });
  text(ctx, `BUILDER ID  #${id.builderId}`, cx + 60, stubY + 74, {
    size: 21,
    color: t.inkSoft,
    weight: 700,
    tracking: 2.6,
  });
  barcode(ctx, cx + 60, stubY + 88, 320, 28, id.seed, t.ink);

  const qc = await qr(s.qrUrl, 112, t.ink, t.bg);
  if (qc) {
    text(ctx, "SCAN → MAKE YOURS", cx + cw - 60, stubY - 6, {
      size: 17,
      color: t.inkSoft,
      weight: 700,
      align: "right",
      tracking: 2,
    });
    ctx.drawImage(qc, cx + cw - 60 - 112, stubY + 6, 112, 112);
  }

  // footer band
  const bandH = 58;
  const bandY = H - 40 - bandH;
  ctx.save();
  roundRect(ctx, cx, bandY, cw, bandH, 0);
  ctx.clip();
  ctx.fillStyle = t.frame;
  ctx.fillRect(cx, bandY, cw, bandH);
  ctx.restore();
  text(ctx, EVENT.hashtag.toUpperCase(), mid, bandY + 39, {
    size: 30,
    color: t.accent2,
    weight: 700,
    align: "center",
    tracking: 7,
  });
  const st = await tintedAsset(STUDIO, t.frameInk, 28);
  if (st) ctx.drawImage(st, cx + 26, bandY + 15, st.width, st.height);
  text(ctx, EVENT.seats, cx + cw - 26, bandY + 37, {
    size: 19,
    color: t.frameInk,
    weight: 700,
    align: "right",
    tracking: 3,
  });

  grain(ctx, W, H, 0.55);
}

/* ------------------------------------------------------------- template: pfp */

async function drawPfp(ctx: Ctx, s: CardState, t: Theme) {
  const W = FORMATS.pfp.w;
  const m = s.members[0];
  const C = W / 2;

  backdrop(ctx, W, W, t);
  palm(ctx, 66, W - 24, 0.55, t.frameInk, false, 0.55);
  palm(ctx, W - 66, W - 24, 0.55, t.frameInk, true, 0.55);
  sunburst(ctx, C, 92, 66, t.accent2, 3, 0.5);

  // photo inside the circle X will crop to
  const R = C - 18;
  ctx.save();
  clipCircle(ctx, C, C, R);
  ctx.fillStyle = t.bgAlt;
  ctx.fillRect(0, 0, W, W);
  if (m?.photo) {
    drawPhotoCover(
      ctx,
      m.photo.bitmap,
      m.photo.width,
      m.photo.height,
      { x: C - R, y: C - R, w: R * 2, h: R * 2 },
      m.photo.focus,
      m.zoom,
      m.offset
    );
  } else {
    text(ctx, "DROP A PHOTO", C, C, {
      size: 44,
      color: t.inkSoft,
      weight: 700,
      align: "center",
      tracking: 4,
    });
  }
  // legibility wash under the rim text
  const g = ctx.createRadialGradient(C, C, R * 0.62, C, C, R);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.42)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, W);
  ctx.restore();

  // branded rim, hugging the circle X crops avatars to
  ctx.save();
  ctx.strokeStyle = t.frame;
  ctx.lineWidth = 50;
  ctx.beginPath();
  ctx.arc(C, C, R - 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  dashRing(ctx, C, C, R - 30, t.accent2, 3, [12, 14]);
  dashRing(ctx, C, C, R + 25, t.accent, 3, [4, 10]);

  const rim = `·  ${EVENT.short} ${EVENT.year}  ·  ${EVENT.hashtag.toUpperCase()}  ·  BUILD IN GOA  ·  SHIP FROM PARADISE  `;
  arcText(ctx, rim, C, C, R - 1, -Math.PI / 2, {
    size: 27,
    color: t.frameInk,
    weight: 700,
    tracking: 3.5,
  });

  // name chip
  const name = (m?.name || "").trim().toUpperCase();
  if (s.showName && name) {
    pill(ctx, C, W - 176, name, t, t.plate, t.plateInk, 34, 34);
  }

  // corner stickers (only seen when the square is posted as an image)
  ctx.save();
  ctx.translate(158, 80);
  ctx.rotate(-0.34);
  pill(ctx, 0, 0, "28-31 OCT", t, t.accent2, "#0A0A0A", 18, 13);
  ctx.restore();
  ctx.save();
  ctx.translate(W - 168, 80);
  ctx.rotate(0.34);
  pill(ctx, 0, 0, "247 BUILDERS", t, t.accent, "#FFF6E0", 18, 13);
  ctx.restore();

  grain(ctx, W, W, 0.5);
}

/* ------------------------------------------------------------ template: crew */

async function drawCrew(ctx: Ctx, s: CardState, t: Theme) {
  const W = FORMATS.crew.w;
  const H = FORMATS.crew.h;
  const people = s.members.slice(0, 6);
  const mid = W / 2;

  backdrop(ctx, W, H, t);
  ctx.save();
  ctx.fillStyle = t.bg;
  roundRect(ctx, 28, 28, W - 56, H - 56, 26);
  ctx.fill();
  ctx.restore();
  scallop(ctx, 28, 28, W - 56, H - 56, t.frame, 10, 30);
  strokeRound(ctx, 46, 46, W - 92, H - 92, 16, t.accent, 2.5, [10, 11]);
  halftone(ctx, 28, 28, W - 56, H - 56, t.ink, 26, 1.7, 0.06);
  sunburst(ctx, W - 190, 214, 132, t.accent2, 4, 0.3);
  palm(ctx, 108, H - 60, 0.78, t.ink, false, 0.16);
  palm(ctx, W - 108, H - 60, 0.78, t.ink, true, 0.16);

  // header
  const markW = await wordmark(ctx, mid - 46, 74, 76, t.ink);
  await goaSticker(ctx, mid - 46 + markW / 2 + 68, 104, 72, t.accent, -0.14);
  const team = (s.teamName || "").trim().toUpperCase() || "THE CREW";
  text(ctx, team, mid, 214, {
    size: 62,
    color: t.ink,
    family: "display",
    weight: 700,
    align: "center",
    tracking: 2,
    maxWidth: W - 300,
  });
  text(ctx, `${EVENT.place}  ·  ${EVENT.dates}  ·  ${EVENT.seats}`, mid, 258, {
    size: 22,
    color: t.inkSoft,
    weight: 600,
    align: "center",
    tracking: 5,
  });

  // people row(s) — one row up to three, two rows beyond that
  const rows = people.length > 3 ? 2 : 1;
  const perRow = Math.ceil(people.length / rows);
  const r = rows === 1 ? (people.length <= 2 ? 168 : 148) : 96;
  const gapX = rows === 1 ? 62 : 46;
  const topY = rows === 1 ? 498 : 372;
  const rowGap = 260;
  const plateH = rows === 1 ? 46 : 34;
  const plateGap = rows === 1 ? 30 : 20;

  people.forEach((p, i) => {
    const row = Math.floor(i / perRow);
    const inRow = i % perRow;
    const count = Math.min(perRow, people.length - row * perRow);
    const span = count * (r * 2 + gapX) - gapX;
    const startX = mid - span / 2 + r;
    const px = startX + inRow * (r * 2 + gapX);
    const py = topY + row * rowGap;

    ctx.save();
    clipCircle(ctx, px, py, r);
    ctx.fillStyle = t.bgAlt;
    ctx.fillRect(px - r, py - r, r * 2, r * 2);
    if (p.photo) {
      drawPhotoCover(
        ctx,
        p.photo.bitmap,
        p.photo.width,
        p.photo.height,
        { x: px - r, y: py - r, w: r * 2, h: r * 2 },
        p.photo.focus,
        p.zoom,
        p.offset
      );
    } else {
      text(ctx, "+", px, py + r * 0.28, {
        size: r * 0.9,
        color: t.inkSoft,
        weight: 700,
        align: "center",
      });
    }
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = t.ink;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    dashRing(ctx, px, py, r + 16, t.accent2, 3, [9, 11]);

    const nm = (p.name || "").trim().toUpperCase() || `BUILDER ${i + 1}`;
    const plateW = r * 2 + 12;
    const plateY = py + r + plateGap;
    fillRound(ctx, px - plateW / 2, plateY, plateW, plateH, 10, t.plate);
    text(ctx, nm, px, plateY + plateH * 0.7, {
      size: rows === 1 ? 25 : 21,
      color: t.plateInk,
      weight: 700,
      align: "center",
      tracking: 1.5,
      maxWidth: plateW - 22,
    });
    // Two rows leaves no room for a second line — names carry it.
    const rl = rows === 1 ? (p.role || "").trim().toUpperCase() : "";
    if (rl)
      text(ctx, rl, px, plateY + plateH + 30, {
        size: 20,
        color: t.inkSoft,
        weight: 600,
        align: "center",
        tracking: 2.5,
        maxWidth: plateW + 30,
      });
  });

  // footer band
  const bandH = 62;
  const bandY = H - 28 - bandH;
  ctx.save();
  roundRect(ctx, 28, bandY, W - 56, bandH, 0);
  ctx.clip();
  ctx.fillStyle = t.frame;
  ctx.fillRect(28, bandY, W - 56, bandH);
  ctx.restore();
  text(ctx, EVENT.hashtag.toUpperCase(), mid, bandY + 41, {
    size: 30,
    color: t.accent2,
    weight: 700,
    align: "center",
    tracking: 7,
  });
  const st = await tintedAsset(STUDIO, t.frameInk, 28);
  if (st) ctx.drawImage(st, 56, bandY + 17, st.width, st.height);
  text(ctx, EVENT.site.toUpperCase(), W - 56, bandY + 40, {
    size: 20,
    color: t.frameInk,
    weight: 700,
    align: "right",
    tracking: 3,
  });

  grain(ctx, W, H, 0.5);
}

/* ---------------------------------------------------------- template: banner */

async function drawBanner(ctx: Ctx, s: CardState, t: Theme) {
  const W = FORMATS.banner.w;
  const H = FORMATS.banner.h;
  const m = s.members[0];

  backdrop(ctx, W, H, t);
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, W, H);
  halftone(ctx, 0, 0, W, H, t.ink, 24, 1.8, 0.07);
  sunburst(ctx, W * 0.55, H * 0.46, 190, t.accent2, 5, 0.2);

  // photo panel on the right, feathered into the paper
  const pw = 620;
  const pxs = W - pw;
  ctx.save();
  ctx.beginPath();
  ctx.rect(pxs, 0, pw, H);
  ctx.clip();
  if (m?.photo) {
    drawPhotoCover(
      ctx,
      m.photo.bitmap,
      m.photo.width,
      m.photo.height,
      { x: pxs, y: 0, w: pw, h: H },
      m.photo.focus,
      m.zoom,
      m.offset
    );
    const g = ctx.createLinearGradient(pxs, 0, pxs + 280, 0);
    g.addColorStop(0, t.bg);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(pxs, 0, 300, H);
  }
  ctx.restore();

  // left type block
  const markW = await wordmark(ctx, 60 + 290, 92, 70, t.ink);
  await goaSticker(ctx, 60 + 290 + markW / 2 + 66, 124, 68, t.accent, -0.14);
  const name = (m?.name || "").trim().toUpperCase();
  text(ctx, name || EVENT.tagline, 60, 268, {
    size: 58,
    color: t.ink,
    family: "display",
    weight: 700,
    tracking: 1,
    maxWidth: 760,
  });
  const role = (m?.role || "").trim().toUpperCase();
  text(ctx, role ? `${role}  ·  ${EVENT.place}` : `${EVENT.place}  ·  ${EVENT.dates}`, 60, 316, {
    size: 24,
    color: t.inkSoft,
    weight: 600,
    tracking: 4,
    maxWidth: 760,
  });
  waves(ctx, 60, 356, 420, t.accent, 2, 4, 12, 3);

  // Kept clear of the bottom-left corner: X parks the profile avatar there.
  const tagW = measure(ctx, EVENT.hashtag.toUpperCase(), {
    size: 25,
    color: t.accent2,
    weight: 700,
    tracking: 4,
  });
  let bx = 470;
  ctx.save();
  ctx.translate(bx + tagW / 2 + 26, H - 74);
  pill(ctx, 0, 0, EVENT.hashtag.toUpperCase(), t, t.frame, t.accent2, 25, 26);
  ctx.restore();
  bx += tagW + 52 + 22;
  const dateW = measure(ctx, EVENT.datesTight, {
    size: 25,
    color: "#0A0A0A",
    weight: 700,
    tracking: 4,
  });
  ctx.save();
  ctx.translate(bx + dateW / 2 + 24, H - 74);
  pill(ctx, 0, 0, EVENT.datesTight, t, t.accent2, "#0A0A0A", 25, 24);
  ctx.restore();

  palm(ctx, 96, H - 8, 0.5, t.ink, false, 0.16);
  ctx.save();
  ctx.strokeStyle = t.frame;
  ctx.lineWidth = 18;
  ctx.strokeRect(9, 9, W - 18, H - 18);
  ctx.restore();

  grain(ctx, W, H, 0.5);
}

/* ------------------------------------------------------------------ entry */

export async function renderCard(
  canvas: HTMLCanvasElement,
  state: CardState,
  scale = 1
): Promise<{ w: number; h: number }> {
  const f = FORMATS[state.format];
  const t = THEMES[state.themeId];
  const W = Math.round(f.w * scale);
  const H = Math.round(f.h * scale);
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext("2d", { alpha: false })!;
  ctx.save();
  ctx.scale(scale, scale);
  ctx.imageSmoothingQuality = "high";
  ctx.textBaseline = "alphabetic";

  await ensureFonts();
  if (state.format === "pass") await drawPass(ctx, state, t);
  else if (state.format === "pfp") await drawPfp(ctx, state, t);
  else if (state.format === "crew") await drawCrew(ctx, state, t);
  else await drawBanner(ctx, state, t);

  ctx.restore();
  return { w: W, h: H };
}

export function fileNameFor(state: CardState) {
  const who = (state.members[0]?.name || state.teamName || "builder")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `hhgoa-2026-${state.format}-${who || "builder"}.png`;
}
