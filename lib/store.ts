/**
 * Server-side card storage for the share-link route.
 *
 * Vercel Blob when a token is configured (production), a tmpdir fallback
 * otherwise so `npm run dev` still gives you a working link preview.
 * Either way the /s/<id> page stays stateless: the id *is* the image URL,
 * base64url-encoded, and only hosts on the allow-list are ever rendered.
 */

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const TMP = path.join(os.tmpdir(), "frame-in-goa");

export const hasBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export function encodeId(url: string) {
  return Buffer.from(url, "utf8").toString("base64url");
}

export function decodeId(id: string): string | null {
  try {
    const url = Buffer.from(id, "base64url").toString("utf8");
    return isAllowed(url) ? url : null;
  } catch {
    return null;
  }
}

/** Only our own API path or a Vercel Blob public URL may become an og:image. */
export function isAllowed(url: string) {
  if (url.startsWith("/api/card/")) return true;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export async function saveCard(id: string, bytes: Buffer, contentType = "image/png") {
  // Serverless tmpdir is per-instance and short-lived: a link written there
  // would preview fine for a minute and 404 later. Better to refuse and let
  // the client attach the image directly.
  if (!hasBlob() && process.env.VERCEL) {
    throw new Error("no_durable_storage");
  }
  if (hasBlob()) {
    const { put } = await import("@vercel/blob");
    const res = await put(`cards/${id}.png`, bytes, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });
    return res.url;
  }
  await fs.mkdir(TMP, { recursive: true });
  await fs.writeFile(path.join(TMP, `${id}.png`), bytes);
  return `/api/card/${id}`;
}

export async function readLocalCard(id: string): Promise<Buffer | null> {
  if (!/^[a-z0-9_-]{6,64}$/i.test(id)) return null;
  try {
    return await fs.readFile(path.join(TMP, `${id}.png`));
  } catch {
    return null;
  }
}
