"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EVENT, THEME_LIST, identityFor, type ThemeId } from "@/lib/brand";
import { loadPhoto, type LoadedPhoto } from "@/lib/render/photo";
import {
  FORMATS,
  fileNameFor,
  renderCard,
  type CardState,
  type FormatId,
  type Member,
} from "@/lib/render/templates";
import {
  canvasToBlob,
  copyImage,
  downloadBlob,
  publishCard,
  shareToX,
  xIntent,
} from "@/lib/share";
import { tweetText } from "@/lib/brand";

const MAX_CREW = 6;

const blankMember = (): Member => ({
  id: Math.random().toString(36).slice(2),
  photo: null,
  name: "",
  role: "",
  zoom: 1,
  offset: { x: 0, y: 0 },
});

export default function Studio() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const targetMember = useRef<number>(0);
  const renderToken = useRef(0);

  const [format, setFormat] = useState<FormatId>("pass");
  const [themeId, setThemeId] = useState<ThemeId>("paradise");
  const [members, setMembers] = useState<Member[]>([blankMember()]);
  const [teamName, setTeamName] = useState("");
  const [showName, setShowName] = useState(true);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ msg: string; kind?: "ok" | "err" } | null>(null);
  const [ms, setMs] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [makeLink, setMakeLink] = useState(true);

  const spec = FORMATS[format];
  const hasPhoto = members.some((m) => m.photo);
  const primary = members[0];
  const identity = useMemo(
    () => identityFor(primary?.name || "builder", primary?.role || ""),
    [primary?.name, primary?.role]
  );

  const state: CardState = useMemo(
    () => ({
      format,
      themeId,
      members,
      teamName,
      showName,
      qrUrl: link || (typeof window !== "undefined" ? window.location.origin : `https://${EVENT.site}`),
    }),
    [format, themeId, members, teamName, showName, link]
  );

  /* ----------------------------------------------------------- render */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const token = ++renderToken.current;
    // A timer, not rAF: background/hidden tabs never fire animation frames and
    // the preview would silently stay blank.
    const timer = setTimeout(async () => {
      const t0 = performance.now();
      try {
        await renderCard(canvas, state, 1);
      } catch (err) {
        // A half-decoded photo can throw once; the next state change repaints.
        console.error("[frame-in-goa] render failed", err);
      }
      if (token === renderToken.current) setMs(Math.round(performance.now() - t0));
    }, 8);
    return () => clearTimeout(timer);
  }, [state]);

  /* ------------------------------------------------------------ input */

  const setMember = useCallback((i: number, patch: Partial<Member>) => {
    setMembers((prev) => prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }, []);

  const ingest = useCallback(
    async (file: File, index: number) => {
      setBusy("READING PHOTO…");
      setNote(null);
      try {
        const photo: LoadedPhoto = await loadPhoto(file);
        setMembers((prev) => {
          const next = [...prev];
          while (next.length <= index) next.push(blankMember());
          next[index] = { ...next[index], photo, zoom: 1, offset: { x: 0, y: 0 } };
          return next;
        });
        setLink(null);
        setNote({ msg: "PHOTO IN. AUTO-FRAMED ON THE FACE.", kind: "ok" });
        setTimeout(() => nameRef.current?.focus(), 60);
      } catch (e: any) {
        setNote({ msg: (e?.message || "Could not read that image.").toUpperCase(), kind: "err" });
      } finally {
        setBusy(null);
      }
    },
    []
  );

  const onPick = (index: number) => {
    targetMember.current = index;
    fileRef.current?.click();
  };

  // Drop or paste anywhere on the page.
  useEffect(() => {
    const stop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const onDrop = (e: DragEvent) => {
      stop(e);
      setDragOver(false);
      const f = e.dataTransfer?.files?.[0];
      if (f) void ingest(f, format === "crew" ? active : 0);
    };
    const onOver = (e: DragEvent) => {
      stop(e);
      setDragOver(true);
    };
    const onLeave = () => setDragOver(false);
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
      const f = item?.getAsFile();
      if (f) void ingest(f, format === "crew" ? active : 0);
    };
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("paste", onPaste);
    };
  }, [ingest, format, active]);

  /* --------------------------------------------------- pan / zoom */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const idx = () => (FORMATS[format].multi ? active : 0);

    const down = (e: PointerEvent) => {
      if (!members[idx()]?.photo) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const rect = canvas.getBoundingClientRect();
      const dx = (e.clientX - lastX) / rect.width;
      const dy = (e.clientY - lastY) / rect.height;
      lastX = e.clientX;
      lastY = e.clientY;
      const i = idx();
      setMembers((prev) =>
        prev.map((m, k) =>
          k === i
            ? {
                ...m,
                offset: {
                  x: Math.max(-1, Math.min(1, m.offset.x + dx * 1.6)),
                  y: Math.max(-1, Math.min(1, m.offset.y + dy * 1.6)),
                },
              }
            : m
        )
      );
    };
    const up = (e: PointerEvent) => {
      dragging = false;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* pointer already gone */
      }
    };
    const wheel = (e: WheelEvent) => {
      const i = idx();
      if (!members[i]?.photo) return;
      e.preventDefault();
      setMembers((prev) =>
        prev.map((m, k) =>
          k === i ? { ...m, zoom: Math.max(1, Math.min(3, m.zoom * (e.deltaY > 0 ? 0.94 : 1.06))) } : m
        )
      );
    };

    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("wheel", wheel);
    };
  }, [members, format, active]);

  /* --------------------------------------------------------- outputs */

  const snapshot = useCallback(async () => {
    const canvas = canvasRef.current!;
    await renderCard(canvas, state, 1);
    return canvasToBlob(canvas, "image/png");
  }, [state]);

  const onDownload = async () => {
    setBusy("ENCODING…");
    try {
      const blob = await snapshot();
      downloadBlob(blob, fileNameFor(state));
      setNote({ msg: `SAVED · ${spec.w}×${spec.h} PNG`, kind: "ok" });
    } catch {
      setNote({ msg: "EXPORT FAILED — TRY AGAIN.", kind: "err" });
    } finally {
      setBusy(null);
    }
  };

  const onCopy = async () => {
    setBusy("COPYING…");
    try {
      const blob = await snapshot();
      const ok = await copyImage(blob);
      if (ok) setNote({ msg: "IMAGE COPIED — PASTE IT STRAIGHT INTO X.", kind: "ok" });
      else {
        downloadBlob(blob, fileNameFor(state));
        setNote({ msg: "CLIPBOARD BLOCKED — DOWNLOADED INSTEAD.", kind: "ok" });
      }
    } finally {
      setBusy(null);
    }
  };

  const onShare = async () => {
    setBusy("PACKING FOR X…");
    try {
      const blob = await snapshot();
      let shareLink = link || undefined;
      if (makeLink && !shareLink) {
        const pub = await publishCard(blob, {
          name: primary?.name,
          role: primary?.role,
          format: spec.label,
          builderClass: identity.builderClass,
          builderId: identity.builderId,
        });
        if (pub) {
          shareLink = pub.pageUrl;
          setLink(pub.pageUrl);
        }
      }
      const text = tweetText({
        name: primary?.name,
        role: primary?.role,
        builderId: identity.builderId,
        builderClass: identity.builderClass,
        format: spec.label.toLowerCase(),
        url: shareLink ? "" : undefined,
      });
      const out = await shareToX({
        blob,
        filename: fileNameFor(state),
        text,
        link: shareLink,
      });
      if (out.route === "native")
        setNote({
          msg: out.opened ? "SHARE SHEET OPEN — PICK X." : "SHARE CANCELLED.",
          kind: "ok",
        });
      else if (out.route === "clipboard")
        setNote({ msg: "X OPENED · IMAGE ON CLIPBOARD — HIT ⌘/CTRL+V.", kind: "ok" });
      else setNote({ msg: "X OPENED · IMAGE DOWNLOADED — ATTACH IT.", kind: "ok" });
    } catch {
      setNote({ msg: "SHARE FAILED — DOWNLOAD AND POST MANUALLY.", kind: "err" });
    } finally {
      setBusy(null);
    }
  };

  const onCopyLink = async () => {
    let l = link;
    if (!l) {
      setBusy("PUBLISHING…");
      const blob = await snapshot();
      const pub = await publishCard(blob, {
        name: primary?.name,
        role: primary?.role,
        format: spec.label,
        builderClass: identity.builderClass,
        builderId: identity.builderId,
      });
      setBusy(null);
      if (!pub) {
        setNote({ msg: "LINK STORE OFF — USE DOWNLOAD OR COPY IMAGE.", kind: "err" });
        return;
      }
      l = pub.pageUrl;
      setLink(l);
    }
    try {
      await navigator.clipboard.writeText(l);
      setNote({ msg: "SHARE LINK COPIED — PREVIEW SHOWS YOUR CARD.", kind: "ok" });
    } catch {
      setNote({ msg: l, kind: "ok" });
    }
  };

  /* ------------------------------------------------------------- crew */

  const addMember = () =>
    setMembers((prev) => (prev.length >= MAX_CREW ? prev : [...prev, blankMember()]));
  const removeMember = (i: number) =>
    setMembers((prev) => (prev.length <= 1 ? prev : prev.filter((_, k) => k !== i)));

  useEffect(() => {
    if (format === "crew" && members.length === 1) addMember();
    if (active >= members.length) setActive(members.length - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, members.length]);

  /* ------------------------------------------------------------ view */

  const activeIndex = spec.multi ? active : 0;
  const activeMember = members[activeIndex];

  return (
    <section className="studio" id="studio">
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="sr"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void ingest(f, targetMember.current);
          e.target.value = "";
        }}
      />

      {/* -------------------------------------------------- preview */}
      <div className="stage">
        <div className={`canvas-shell${dragOver ? " over" : ""}`}>
          <canvas ref={canvasRef} className="preview" aria-label="Live preview of your HH Goa graphic" />
        </div>
        <div className="stage-meta">
          <span className="badge-live">LIVE</span>
          <span>
            {spec.w}×{spec.h}
          </span>
          {ms !== null && <span>RENDERED IN {ms}MS</span>}
          {hasPhoto && <span>DRAG THE ART TO REFRAME · SCROLL TO ZOOM</span>}
          {!hasPhoto && <span>DROP OR PASTE A PHOTO ANYWHERE</span>}
        </div>
      </div>

      {/* -------------------------------------------------- controls */}
      <div>
        <div className="panel">
          <h3>01 · Pick a format</h3>
          <div className="tabs">
            {Object.values(FORMATS).map((f) => (
              <button
                key={f.id}
                className="tab"
                aria-pressed={format === f.id}
                onClick={() => setFormat(f.id)}
                type="button"
              >
                {f.label}
                <small>{f.blurb}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <h3>02 · {spec.multi ? "Your crew" : "Your photo & details"}</h3>

          {!spec.multi && (
            <>
              <div
                className="drop"
                onClick={() => onPick(0)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onPick(0)}
              >
                <strong>{primary?.photo ? "CHANGE PHOTO" : "DROP / PASTE / TAP TO UPLOAD"}</strong>
                <span>JPG · PNG · WEBP · HEIC FROM IPHONE · UP TO 40MB</span>
              </div>

              <div style={{ height: 14 }} />
              <div className="row2">
                <div className="field">
                  <label htmlFor="f-name">Name</label>
                  <input
                    id="f-name"
                    ref={nameRef}
                    type="text"
                    value={primary?.name || ""}
                    maxLength={26}
                    placeholder="SATOSHI NAKAMOTO"
                    onChange={(e) => setMember(0, { name: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="f-role">Stack / role</label>
                  <input
                    id="f-role"
                    type="text"
                    value={primary?.role || ""}
                    maxLength={26}
                    placeholder="FULL-STACK · RUST · AI"
                    onChange={(e) => setMember(0, { role: e.target.value })}
                  />
                </div>
              </div>

              <div className="chips" style={{ marginBottom: 10 }}>
                <span className="tiny">CLASS ROLLED FOR YOU:</span>
                <span className="chip" aria-pressed="true">
                  {identity.builderClass} · {identity.rarity.label}
                </span>
              </div>
            </>
          )}

          {spec.multi && (
            <>
              <div className="field">
                <label htmlFor="f-team">Team name</label>
                <input
                  id="f-team"
                  type="text"
                  value={teamName}
                  maxLength={22}
                  placeholder="THE CREW"
                  onChange={(e) => setTeamName(e.target.value)}
                />
              </div>
              {members.map((m, i) => (
                <div
                  className="member"
                  key={m.id}
                  onFocus={() => setActive(i)}
                  onClick={() => setActive(i)}
                  style={active === i ? { borderColor: "var(--yellow)" } : undefined}
                >
                  <div className="thumb" onClick={() => onPick(i)} title="Upload photo">
                    {m.photo ? (
                      <PhotoThumb photo={m.photo} />
                    ) : (
                      <span>ADD<br />PHOTO</span>
                    )}
                  </div>
                  <div>
                    <input
                      type="text"
                      value={m.name}
                      maxLength={20}
                      placeholder={`BUILDER ${i + 1}`}
                      onChange={(e) => setMember(i, { name: e.target.value })}
                    />
                    <input
                      type="text"
                      value={m.role}
                      maxLength={20}
                      placeholder="ROLE / STACK"
                      onChange={(e) => setMember(i, { role: e.target.value })}
                    />
                  </div>
                  <button
                    className="iconbtn"
                    type="button"
                    onClick={() => removeMember(i)}
                    aria-label={`Remove builder ${i + 1}`}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                className="btn ghost full"
                type="button"
                onClick={addMember}
                disabled={members.length >= MAX_CREW}
              >
                + ADD TEAMMATE ({members.length}/{MAX_CREW})
              </button>
            </>
          )}
        </div>

        <div className="panel">
          <h3>03 · Style</h3>
          <div className="chips">
            {THEME_LIST.map((t) => (
              <button
                key={t.id}
                type="button"
                className="chip"
                aria-pressed={themeId === t.id}
                onClick={() => setThemeId(t.id)}
              >
                <span className="swatch" style={{ background: t.frame }} />
                <span className="swatch" style={{ background: t.bg }} />
                {t.label}
              </button>
            ))}
          </div>

          {format === "pfp" && (
            <div className="chips" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="chip"
                aria-pressed={showName}
                onClick={() => setShowName((v) => !v)}
              >
                NAME TAG {showName ? "ON" : "OFF"}
              </button>
            </div>
          )}

          {activeMember?.photo && (
            <div style={{ marginTop: 14 }}>
              <label className="tiny" htmlFor="zoom">
                ZOOM {spec.multi ? `· BUILDER ${activeIndex + 1}` : ""}
              </label>
              <input
                id="zoom"
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={activeMember.zoom}
                onChange={(e) => setMember(activeIndex, { zoom: Number(e.target.value) })}
              />
              <button
                className="btn ghost full"
                type="button"
                onClick={() => setMember(activeIndex, { zoom: 1, offset: { x: 0, y: 0 } })}
              >
                RESET AUTO-FRAME
              </button>
            </div>
          )}
        </div>

        <div className="panel">
          <h3>04 · Ship it</h3>
          <div className="actions">
            <button className="btn primary" type="button" onClick={onShare} disabled={!!busy}>
              {busy ? busy : "SHARE TO X"}
            </button>
            <button className="btn accent" type="button" onClick={onDownload} disabled={!!busy}>
              DOWNLOAD PNG
            </button>
            <button className="btn ghost" type="button" onClick={onCopy} disabled={!!busy}>
              COPY IMAGE
            </button>
            <button className="btn ghost" type="button" onClick={onCopyLink} disabled={!!busy}>
              {link ? "COPY SHARE LINK" : "GET SHARE LINK"}
            </button>
          </div>

          <div className="chips" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="chip"
              aria-pressed={makeLink}
              onClick={() => setMakeLink((v) => !v)}
            >
              LINK PREVIEW {makeLink ? "ON" : "OFF"}
            </button>
            <span className="tiny" style={{ maxWidth: 260 }}>
              PUBLISHES THE IMAGE SO THE TWEET CARD SHOWS YOUR GRAPHIC
            </span>
          </div>

          <p className={`note${note?.kind === "err" ? " err" : note?.kind === "ok" ? " ok" : ""}`}>
            {note?.msg || `CAPTION IS PRE-WRITTEN WITH ${EVENT.hashtag.toUpperCase()}`}
          </p>

          {link && (
            <a className="btn ghost full" href={link} target="_blank" rel="noreferrer">
              OPEN SHARE PAGE ↗
            </a>
          )}
          <a
            className="btn ghost full"
            style={{ marginTop: 10 }}
            href={xIntent(
              tweetText({
                name: primary?.name,
                role: primary?.role,
                builderId: identity.builderId,
                builderClass: identity.builderClass,
                format: spec.label.toLowerCase(),
                url: link || "",
              })
            )}
            target="_blank"
            rel="noreferrer"
          >
            OPEN X WITH CAPTION ONLY ↗
          </a>
        </div>
      </div>
    </section>
  );
}

/** Tiny preview of a decoded photo for the crew rows. */
function PhotoThumb({ photo }: { photo: LoadedPhoto }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = 124;
    c.height = 124;
    const ctx = c.getContext("2d")!;
    const s = Math.max(124 / photo.width, 124 / photo.height);
    const w = photo.width * s;
    const h = photo.height * s;
    ctx.drawImage(
      photo.bitmap as CanvasImageSource,
      62 - photo.focus.x * w,
      62 - photo.focus.y * h,
      w,
      h
    );
  }, [photo]);
  return <canvas ref={ref} style={{ width: "100%", height: "100%", display: "block" }} />;
}
