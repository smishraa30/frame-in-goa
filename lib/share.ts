/**
 * Download + share plumbing.
 *
 * Share to X takes the best route the device actually supports:
 *   1. Web Share (files)  — phones: opens X with the PNG already attached.
 *   2. Clipboard image    — desktop: paste into the composer with one keystroke.
 *   3. Published link     — an /s/<id> page whose og:image IS the graphic, so
 *                           the tweet preview shows the card, never a blank box.
 */

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png", quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not encode the image."))),
      type,
      quality
    );
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function copyImage(blob: Blob): Promise<boolean> {
  try {
    if (!navigator.clipboard || typeof ClipboardItem === "undefined") return false;
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    return true;
  } catch {
    return false;
  }
}

export function xIntent(text: string, url?: string) {
  const p = new URLSearchParams();
  p.set("text", text);
  if (url) p.set("url", url);
  return `https://x.com/intent/post?${p.toString()}`;
}

export interface PublishResult {
  id: string;
  pageUrl: string;
  imageUrl: string;
}

export async function publishCard(
  blob: Blob,
  meta: { name?: string; role?: string; format: string; builderClass?: string; builderId?: string }
): Promise<PublishResult | null> {
  try {
    const fd = new FormData();
    fd.append("image", blob, "card.png");
    fd.append("meta", JSON.stringify(meta));
    const res = await fetch("/api/publish", { method: "POST", body: fd });
    if (!res.ok) return null;
    const data = (await res.json()) as PublishResult;
    return data?.pageUrl ? data : null;
  } catch {
    return null;
  }
}

export type ShareRoute = "native" | "clipboard" | "download";

export interface ShareOutcome {
  route: ShareRoute;
  opened: boolean;
  link?: string;
}

/** Fire-and-forget share; resolves with what actually happened so the UI can say so. */
export async function shareToX(opts: {
  blob: Blob;
  filename: string;
  text: string;
  link?: string;
}): Promise<ShareOutcome> {
  const file = new File([opts.blob], opts.filename, { type: opts.blob.type });

  // 1. Native share sheet with the file attached (iOS/Android).
  try {
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({
        files: [file],
        text: opts.link ? `${opts.text}` : opts.text,
      });
      return { route: "native", opened: true, link: opts.link };
    }
  } catch (err: any) {
    if (err?.name === "AbortError") return { route: "native", opened: false, link: opts.link };
  }

  // 2. Desktop: image on the clipboard + prefilled composer.
  const copied = await copyImage(opts.blob);
  if (!copied) downloadBlob(opts.blob, opts.filename);
  window.open(xIntent(opts.text, opts.link), "_blank", "noopener,noreferrer");
  return { route: copied ? "clipboard" : "download", opened: true, link: opts.link };
}
