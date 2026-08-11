/**
 * Canvas primitives for the HH Goa templates.
 * Everything here is vector-drawn (or tinted from the official marks) so a
 * card renders identically at 1x preview and 2x export.
 */

import { loadAsset } from "./photo";

export type Ctx = CanvasRenderingContext2D;

/* ---------------------------------------------------------------- fonts */

let fontCache: { mono: string; display: string } | null = null;

/** Custom properties can still hold un-substituted var() in some engines. */
function resolveVar(cs: CSSStyleDeclaration, name: string): string {
  let v = cs.getPropertyValue(name).trim();
  for (let i = 0; i < 4 && v.includes("var("); i++) {
    v = v.replace(/var\((--[a-z0-9-]+)\)/gi, (_, n) => cs.getPropertyValue(n).trim());
  }
  return v.replace(/,\s*,/g, ",").replace(/^,|,$/g, "").trim();
}

export function fonts() {
  if (fontCache) return fontCache;
  const cs = typeof window !== "undefined" ? getComputedStyle(document.documentElement) : null;
  const mono = (cs && resolveVar(cs, "--font-mono")) || "ui-monospace, monospace";
  const display = (cs && resolveVar(cs, "--font-display")) || "Georgia, serif";
  fontCache = { mono, display };
  return fontCache;
}

/** Fonts must be resident before the first canvas paint or text falls back. */
export async function ensureFonts() {
  if (typeof document === "undefined" || !document.fonts) return;
  const f = fonts();
  const probes = [
    `400 32px ${f.mono}`,
    `700 32px ${f.mono}`,
    `400 64px ${f.display}`,
    `700 64px ${f.display}`,
  ];
  try {
    await Promise.all(probes.map((p) => document.fonts.load(p)));
    await document.fonts.ready;
  } catch {
    /* non-fatal: system fallback still renders */
  }
  fontCache = null; // re-read in case CSS vars resolved late
  fonts();
}

/* ---------------------------------------------------------------- shapes */

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function fillRound(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: string
) {
  ctx.save();
  ctx.fillStyle = color;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();
}

export function strokeRound(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: string,
  lw: number,
  dash?: number[]
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  if (dash) ctx.setLineDash(dash);
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();
  ctx.restore();
}

/* ----------------------------------------------------------------- text */

export interface TextOpts {
  size: number;
  color: string;
  family?: "mono" | "display";
  weight?: number;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  tracking?: number;
  maxWidth?: number;
  opacity?: number;
  italic?: boolean;
}

function fontString(o: TextOpts, size: number) {
  const f = fonts();
  const fam = o.family === "display" ? f.display : f.mono;
  return `${o.italic ? "italic " : ""}${o.weight ?? 500} ${size}px ${fam}`;
}

export function measure(ctx: Ctx, str: string, o: TextOpts, size = o.size) {
  ctx.save();
  ctx.font = fontString(o, size);
  const track = o.tracking ?? 0;
  const w = ctx.measureText(str).width + track * Math.max(0, str.length - 1);
  ctx.restore();
  return w;
}

/** Draws text; shrinks to fit maxWidth. Returns the size actually used. */
export function text(ctx: Ctx, str: string, x: number, y: number, o: TextOpts): number {
  let size = o.size;
  if (o.maxWidth) {
    let guard = 0;
    while (measure(ctx, str, o, size) > o.maxWidth && size > 6 && guard++ < 200) size -= 1;
  }

  ctx.save();
  ctx.globalAlpha = o.opacity ?? 1;
  ctx.font = fontString(o, size);
  ctx.fillStyle = o.color;
  ctx.textBaseline = o.baseline ?? "alphabetic";
  const track = o.tracking ?? 0;
  const align = o.align ?? "left";

  if (!track) {
    ctx.textAlign = align;
    ctx.fillText(str, x, y);
  } else {
    // Manual tracking keeps Safari (no ctx.letterSpacing until 17.4) identical.
    const total = measure(ctx, str, o, size);
    let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
    ctx.textAlign = "left";
    for (const ch of str) {
      ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width + track;
    }
  }
  ctx.restore();
  return size;
}

/** Text on a circular arc — used for the round "seal" stamps. */
export function arcText(
  ctx: Ctx,
  str: string,
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  o: TextOpts & { direction?: 1 | -1 }
) {
  ctx.save();
  ctx.font = fontString(o, o.size);
  ctx.fillStyle = o.color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const dir = o.direction ?? 1;
  const track = o.tracking ?? 0;
  const widths = [...str].map((c) => ctx.measureText(c).width + track);
  const totalArc = widths.reduce((a, b) => a + b, 0) / radius;
  let angle = startAngle - (dir * totalArc) / 2;
  for (let i = 0; i < str.length; i++) {
    const step = widths[i] / radius;
    angle += (dir * step) / 2;
    ctx.save();
    ctx.translate(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    ctx.rotate(angle + (dir === 1 ? Math.PI / 2 : -Math.PI / 2));
    ctx.fillText(str[i], 0, 0);
    ctx.restore();
    angle += (dir * step) / 2;
  }
  ctx.restore();
}

/* -------------------------------------------------------------- texture */

let grainTile: HTMLCanvasElement | null = null;
function makeGrain() {
  if (grainTile) return grainTile;
  const s = 128;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(s, s);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 26;
  }
  ctx.putImageData(img, 0, 0);
  grainTile = c;
  return c;
}

export function grain(ctx: Ctx, w: number, h: number, alpha = 0.5) {
  const pat = ctx.createPattern(makeGrain(), "repeat");
  if (!pat) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export function halftone(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  step = 18,
  radius = 2.1,
  alpha = 0.18
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  for (let yy = y; yy < y + h; yy += step) {
    for (let xx = x; xx < x + w; xx += step) {
      ctx.beginPath();
      ctx.arc(xx, yy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Postage-stamp scalloped edge: punch half-circles out of the artwork. */
export function perforate(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  gap: number
) {
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "#000";
  const punch = (px: number, py: number) => {
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  };
  const nx = Math.max(2, Math.round(w / gap));
  const ny = Math.max(2, Math.round(h / gap));
  for (let i = 0; i <= nx; i++) {
    const px = x + (w * i) / nx;
    punch(px, y);
    punch(px, y + h);
  }
  for (let i = 0; i <= ny; i++) {
    const py = y + (h * i) / ny;
    punch(x, py);
    punch(x + w, py);
  }
  ctx.restore();
}

/* ------------------------------------------------------------- graphics */

/** Goa palm — hand-rolled so it scales cleanly and costs no bytes. */
export function palm(
  ctx: Ctx,
  x: number,
  y: number,
  scale: number,
  color: string,
  flip = false,
  alpha = 1
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(flip ? -scale : scale, scale);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;

  // trunk
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-14, -70, -34, -128);
  ctx.stroke();

  // fronds
  const frond = (ang: number, len: number) => {
    ctx.save();
    ctx.translate(-34, -128);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.55, -len * 0.34, len, -len * 0.06);
    ctx.quadraticCurveTo(len * 0.55, -len * 0.06, 0, 0);
    ctx.fill();
    ctx.restore();
  };
  frond(-0.35, 78);
  frond(0.28, 70);
  frond(Math.PI + 0.42, 74);
  frond(Math.PI - 0.22, 66);
  frond(-1.15, 58);

  // coconuts
  ctx.beginPath();
  ctx.arc(-30, -120, 5, 0, Math.PI * 2);
  ctx.arc(-40, -116, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function sunburst(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  color: string,
  rays = 5,
  alpha = 1
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 0);
  ctx.fill();
  // Stacked chords below the dome — classic HH Goa sunrise mark.
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, r * 0.07);
  for (let i = 1; i <= rays; i++) {
    const y = cy + (r * 0.26) * i;
    const dy = y - cy;
    const half = Math.sqrt(Math.max(0, r * r - dy * dy)) * 0.92;
    if (half < r * 0.12) break;
    ctx.beginPath();
    ctx.moveTo(cx - half, y);
    ctx.lineTo(cx + half, y);
    ctx.stroke();
  }
  ctx.restore();
}

export function waves(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  color: string,
  rows = 3,
  amp = 5,
  gap = 12,
  lw = 3
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  for (let r = 0; r < rows; r++) {
    ctx.beginPath();
    const yy = y + r * gap;
    ctx.moveTo(x, yy);
    for (let i = 0; i <= w; i += 10) {
      ctx.lineTo(x + i, yy + Math.sin((i / w) * Math.PI * 8 + r) * amp);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Decorative code-39-ish barcode (visual only, never scanned). */
export function barcode(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number,
  color: string
) {
  ctx.save();
  ctx.fillStyle = color;
  let s = seed || 1;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff);
  let cx = x;
  while (cx < x + w) {
    const bw = 2 + Math.floor(rnd() * 5);
    if (rnd() > 0.42) ctx.fillRect(cx, y, bw, h);
    cx += bw + 2 + Math.floor(rnd() * 4);
  }
  ctx.restore();
}

/** Tint any alpha mask (our official marks are single-colour) to `color`. */
const tintCache = new Map<string, HTMLCanvasElement>();
export async function tintedAsset(
  src: string,
  color: string,
  height: number
): Promise<HTMLCanvasElement | null> {
  const key = `${src}|${color}|${Math.round(height)}`;
  const hit = tintCache.get(key);
  if (hit) return hit;
  const img = await loadAsset(src);
  if (!img) return null;
  const nw = img.naturalWidth || img.width || 1;
  const nh = img.naturalHeight || img.height || 1;
  const w = Math.round((nw / nh) * height);
  const c = document.createElement("canvas");
  c.width = Math.max(1, w);
  c.height = Math.max(1, Math.round(height));
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  tintCache.set(key, c);
  return c;
}

/* ---------------------------------------------------------------- photo */

export interface PhotoBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Cover-fit a photo into a box around its focal point, with user pan/zoom
 * applied on top. Handles portrait, landscape and square without cropping UI.
 */
export function drawPhotoCover(
  ctx: Ctx,
  img: CanvasImageSource,
  iw: number,
  ih: number,
  box: PhotoBox,
  focus: { x: number; y: number },
  zoom = 1,
  offset = { x: 0, y: 0 }
) {
  const scale = Math.max(box.w / iw, box.h / ih) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  // Focal point maps to the box centre, then clamped so no empty edge shows.
  let dx = box.x + box.w / 2 - focus.x * dw + offset.x * box.w;
  let dy = box.y + box.h / 2 - focus.y * dh + offset.y * box.h;
  dx = Math.min(box.x, Math.max(box.x + box.w - dw, dx));
  dy = Math.min(box.y, Math.max(box.y + box.h - dh, dy));
  ctx.drawImage(img, dx, dy, dw, dh);
}

export function clipCircle(ctx: Ctx, cx: number, cy: number, r: number) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
}

/** Dashed ring used around portraits. */
export function dashRing(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  color: string,
  lw: number,
  dash: number[] = [10, 12]
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function shadow(ctx: Ctx, color: string, blur: number, dx = 0, dy = 0) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = dx;
  ctx.shadowOffsetY = dy;
}

export function clearShadow(ctx: Ctx) {
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}
