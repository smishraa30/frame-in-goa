/**
 * Photo intake: decode (incl. HEIC), respect EXIF orientation, downscale,
 * and pick a sensible crop focus so users never have to crop by hand.
 * Everything runs in the browser — no upload, no round trip, no wait.
 */

export interface LoadedPhoto {
  bitmap: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
  /** 0..1 focal point chosen by the saliency pass */
  focus: { x: number; y: number };
  /** average colour, used to tint frames / pick contrast */
  avg: { r: number; g: number; b: number };
}

const MAX_EDGE = 2200;

function isHeic(file: File) {
  const n = file.name.toLowerCase();
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    n.endsWith(".heic") ||
    n.endsWith(".heif")
  );
}

async function heicToJpegBlob(file: File): Promise<Blob> {
  // Loaded on demand so the 99% JPG/PNG path never pays for the decoder.
  const mod: any = await import("heic-to");
  const convert = mod.heicTo || mod.default?.heicTo || mod.default;
  const out = await convert({ blob: file, type: "image/jpeg", quality: 0.92 });
  return Array.isArray(out) ? out[0] : out;
}

async function decode(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      // `from-image` applies EXIF rotation for us (Chrome/Safari/Firefox current).
      return await createImageBitmap(blob, { imageOrientation: "from-image" } as any);
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    (img as any).crossOrigin = "anonymous";
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("Could not read that image."));
      img.src = url;
    });
    if (typeof img.decode === "function") {
      try {
        await img.decode();
      } catch {
        /* Safari sometimes rejects decode() on object URLs; onload already fired */
      }
    }
    return img;
  } finally {
    // Revoke late — Safari needs the URL alive until the first paint.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

function drawToCanvas(
  src: ImageBitmap | HTMLImageElement,
  w: number,
  h: number
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src as CanvasImageSource, 0, 0, c.width, c.height);
  return c;
}

/**
 * Cheap saliency: skin-tone likelihood + local edge energy on a 64px thumb.
 * Beats naive centre-crop on off-centre portraits, costs ~1ms.
 */
function analyse(src: ImageBitmap | HTMLImageElement, w: number, h: number) {
  const S = 64;
  const tw = w >= h ? S : Math.max(16, Math.round((w / h) * S));
  const th = h > w ? S : Math.max(16, Math.round((h / w) * S));
  const c = drawToCanvas(src, tw, th);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  const { data } = ctx.getImageData(0, 0, tw, th);

  const at = (x: number, y: number) => (y * tw + x) * 4;
  let sr = 0,
    sg = 0,
    sb = 0,
    n = 0;
  const score = new Float32Array(tw * th);

  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const i = at(x, y);
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      sr += r;
      sg += g;
      sb += b;
      n++;

      // skin-tone heuristic (RGB rule-of-thumb, tolerant across tones)
      const mx = Math.max(r, g, b),
        mn = Math.min(r, g, b);
      const skin =
        r > 60 && g > 30 && b > 15 && r > g && g > b && mx - mn > 12 && Math.abs(r - g) > 8
          ? 1
          : 0;

      // edge energy
      let e = 0;
      if (x > 0 && y > 0 && x < tw - 1 && y < th - 1) {
        const l = data[at(x - 1, y)],
          rr = data[at(x + 1, y)],
          u = data[at(x, y - 1)],
          d = data[at(x, y + 1)];
        e = (Math.abs(l - rr) + Math.abs(u - d)) / 255;
      }

      // bias slightly toward the upper-middle: faces live there in portraits
      const bias = 1 - Math.min(1, Math.abs(x / tw - 0.5) * 1.3 + Math.abs(y / th - 0.4) * 1.1);
      score[y * tw + x] = (skin * 2.4 + e * 1.1) * (0.55 + 0.45 * bias);
    }
  }

  let wx = 0,
    wy = 0,
    tot = 0;
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const s = score[y * tw + x];
      wx += (x + 0.5) * s;
      wy += (y + 0.5) * s;
      tot += s;
    }
  }

  const focus =
    tot > 1e-3
      ? { x: clamp01(wx / tot / tw), y: clamp01(wy / tot / th) }
      : { x: 0.5, y: 0.42 };

  return {
    focus,
    avg: { r: Math.round(sr / n), g: Math.round(sg / n), b: Math.round(sb / n) },
  };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export async function loadPhoto(file: File): Promise<LoadedPhoto> {
  if (file.size > 40 * 1024 * 1024) throw new Error("That file is over 40MB — try a smaller one.");

  let blob: Blob = file;
  if (isHeic(file)) {
    try {
      blob = await heicToJpegBlob(file);
    } catch {
      throw new Error("Couldn't read that HEIC. Screenshot it or export as JPG and retry.");
    }
  }

  let src = await decode(blob);
  let w = "width" in src ? src.width : (src as HTMLImageElement).naturalWidth;
  let h = "height" in src ? src.height : (src as HTMLImageElement).naturalHeight;
  if (!w || !h) throw new Error("That image looks empty.");

  // Downscale monsters once, up front — every later redraw gets cheaper.
  const edge = Math.max(w, h);
  if (edge > MAX_EDGE) {
    const k = MAX_EDGE / edge;
    const c = drawToCanvas(src, w * k, h * k);
    const scaled = await createImageBitmapSafe(c);
    src = scaled;
    w = c.width;
    h = c.height;
  }

  const { focus, avg } = analyse(src, w, h);
  return { bitmap: src, width: w, height: h, focus, avg };
}

async function createImageBitmapSafe(
  c: HTMLCanvasElement
): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(c);
    } catch {
      /* noop */
    }
  }
  const img = new Image();
  img.src = c.toDataURL("image/png");
  await new Promise((r) => (img.onload = r));
  return img;
}

/** Load one of our own /public assets (used for the official wordmarks). */
const assetCache = new Map<string, Promise<HTMLImageElement | null>>();
export function loadAsset(src: string): Promise<HTMLImageElement | null> {
  let p = assetCache.get(src);
  if (!p) {
    p = new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null); // templates fall back to drawn type
      img.src = src;
    });
    assetCache.set(src, p);
  }
  return p;
}
