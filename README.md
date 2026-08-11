# Frame In Goa — HH Goa 2026 frame / builder-pass generator

**Task #1 submission for [Hacker House Goa 2026](https://hhgoa.com).** Drop a photo, get an
unmistakably HH Goa graphic back in milliseconds, download it, and post it to X with the caption
and `#FrameInGoa` already written.

Four outputs from one photo:

| Format          | Size      | What it's for                                                  |
| --------------- | --------- | -------------------------------------------------------------- |
| **Builder Pass**| 1080×1350 | 4:5 event badge — name, stack, rolled builder class, ID, QR      |
| **PFP Frame**   | 1080×1080 | Circle-safe avatar: photo front and centre, branding on the rim  |
| **Crew Frame**  | 1600×900  | Up to **6 teammates** in one combined frame                      |
| **X Banner**    | 1500×500  | Profile header, avatar-safe zone kept clear                      |

Three themes (Paradise / Sunset / Midnight), all built from the event's own palette
(`#0B6839` green, `#FF0080` pink, `#FEE101` yellow, cream paper) and typefaces
(Victor Mono + Imbue), with the official `HACKER HOUSE`, `गोवा` and `2:47 PM STUDIO` marks.

---

## How it works

**Everything renders on-device.** `lib/render/templates.ts` paints straight to a 2D canvas at full
export resolution — no `html2canvas`, no headless browser, no server round trip. A redraw is
~5–15 ms, so the preview updates live as you type and "upload → finished art" never shows a
spinner.

**No crop tool.** `lib/render/photo.ts` decodes the file (including **HEIC from iPhone**, via a
lazily-imported decoder so the common path stays light), applies EXIF orientation through
`createImageBitmap({ imageOrientation: 'from-image' })`, downscales anything huge once, then runs a
64px saliency pass — skin-tone likelihood plus edge energy, weighted toward where faces actually
sit — to pick the focal point. Portrait, landscape, off-centre, 12MP: all just work. Drag the
canvas or scroll to override.

**Share that actually lands.** `lib/share.ts` picks the best route the device supports:

1. **Phones** — `navigator.share({ files })`: the native sheet opens X with the PNG attached.
2. **Desktop** — the PNG goes on the clipboard and X opens with the caption pre-filled; one
   `Ctrl/⌘+V` and it's attached. If the clipboard is blocked, it downloads instead.
3. **Link** — `POST /api/publish` stores the PNG and returns `/s/<id>`, a page whose `og:image`
   **is the generated graphic**, so the tweet preview shows the card instead of a blank thumbnail.
   The id is the image URL, base64url-encoded, and only same-origin `/api/card/*` paths or
   `*.public.blob.vercel-storage.com` hosts are ever rendered — no open redirect, no database.

No login. No signup gate. No step between landing and result.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000 — the studio is the landing page.

## Deploy

Works on Vercel with zero configuration; the share-link route degrades gracefully if no blob store
is attached (share still works via native share / clipboard).

```bash
vercel deploy
```

| Env var                 | Needed?  | What it does                                                                 |
| ----------------------- | -------- | ---------------------------------------------------------------------------- |
| `BLOB_READ_WRITE_TOKEN` | optional | Attach a Vercel Blob store to persist shared cards. Without it, publish falls back to the serverless tmpdir (fine locally, ephemeral in prod) and the UI silently drops to image-attach sharing. |
| `NEXT_PUBLIC_SITE_URL`  | optional | Canonical origin for OG tags. Auto-derived from `VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL` otherwise. |

## Layout

```
app/
  page.tsx              landing + studio (one page, one pass)
  s/[id]/page.tsx       share page — og:image is the generated card
  api/publish/route.ts  stores a PNG, returns the share URL
  api/card/[id]/route.ts local/tmpdir fallback image server
components/Studio.tsx   the whole editor: upload, fields, pan/zoom, export
lib/brand.ts            palette, event copy, deterministic builder identity
lib/render/photo.ts     decode + HEIC + EXIF + saliency crop
lib/render/draw.ts      canvas primitives (stamps, palms, halftone, arc text, grain)
lib/render/templates.ts the four formats
lib/share.ts            download / clipboard / native share / publish
public/brand/           official HH Goa marks
public/og.png           static social card for the tool itself
```

`public/og.png` is a checked-in asset; regenerate it by re-running the one-off canvas script in the
git history (`public/_ogmaker.html`) if the branding changes.

## Notes

- Builder class, rarity, beach bag and `#HH-GOA-####` are derived from an FNV-1a hash of
  name + role, so the same builder always gets the same card — no server state, no randomness
  between renders.
- The decorative barcode is decorative. The QR is real and points at the share page (or the tool)
  so anyone who sees the card can make their own.
- `#FrameInGoa` is baked into every caption and every template.
