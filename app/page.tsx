import Studio from "@/components/Studio";
import { EVENT } from "@/lib/brand";

const TICKER = [
  "BUILD IN GOA",
  "SHIP FROM PARADISE",
  EVENT.hashtag.toUpperCase(),
  "28 – 31 OCT 2026",
  "247 BUILDERS",
  "LESS NOISE. MORE SIGNAL.",
  "NO LOGIN. NO WAITING.",
];

export default function Home() {
  return (
    <>
      <header className="topbar">
        <div className="wrap row">
          <a className="brandmark" href="#studio">
            <span className="dot" />
            FRAME IN GOA
          </a>
          <span className="spacer" />
          <span className="tiny" style={{ display: "none" }} />
          <a className="tiny" href="https://hhgoa.com" target="_blank" rel="noreferrer">
            HHGOA.COM ↗
          </a>
          <a className="btn accent" href="#studio" style={{ padding: "10px 14px" }}>
            OPEN STUDIO
          </a>
        </div>
      </header>

      <div className="ticker" aria-hidden="true">
        <div className="track">
          <span>
            {TICKER.map((t) => (
              <span key={t}>{t} ✦</span>
            ))}
          </span>
          <span>
            {TICKER.map((t) => (
              <span key={`${t}-2`}>{t} ✦</span>
            ))}
          </span>
        </div>
      </div>

      <main className="wrap">
        <section className="hero">
          <span className="kicker">
            HH GOA 2026 · TASK #1 · SHORTLISTING BUILD
          </span>
          <h1 className="big">
            FRAME <em>गोवा</em> <br />
            IN <span className="pink">ONE PASS.</span>
          </h1>
          <p className="lede">
            Drop a photo — get an official-looking HH Goa 2026 builder pass, a circle-safe PFP
            frame, a six-person crew frame or an X banner. Rendered on your device in
            milliseconds, no upload, no signup, no crop tool. Then one tap to X with the caption
            and {EVENT.hashtag} already written.
          </p>
          <div className="hero-stats">
            <span className="stat">
              <b>4</b> FORMATS
            </span>
            <span className="stat">
              <b>3</b> THEMES
            </span>
            <span className="stat">
              <b>0</b> LOGINS
            </span>
            <span className="stat">
              <b>HEIC</b> FROM IPHONE
            </span>
            <span className="stat">
              <b>OG</b> LINK PREVIEWS
            </span>
          </div>
        </section>

        <Studio />

        <section className="grid3">
          <div className="card-lite">
            <b>Instant, on-device</b>
            <p>
              Every pixel is painted straight to a canvas at export resolution. No html2canvas, no
              server round trip — a redraw takes a few milliseconds, and your photo never leaves
              the browser unless you ask for a share link.
            </p>
          </div>
          <div className="card-lite">
            <b>No crop tool needed</b>
            <p>
              A saliency pass (skin-tone + edge energy) finds the face and frames it for you.
              Portrait, landscape, off-centre, HEIC straight off an iPhone — all handled. Drag to
              nudge it if you disagree.
            </p>
          </div>
          <div className="card-lite">
            <b>Share that actually works</b>
            <p>
              Phones get a native share sheet with the PNG attached. Desktop gets the image on the
              clipboard plus a pre-filled composer. Share by link and the preview shows your card —
              never a blank thumbnail.
            </p>
          </div>
        </section>
      </main>

      <footer className="site">
        <div className="wrap">
          BUILT FOR {EVENT.name} {EVENT.year} · {EVENT.place} · {EVENT.dates} ·{" "}
          <a href="https://hhgoa.com" target="_blank" rel="noreferrer">
            HHGOA.COM
          </a>{" "}
          · {EVENT.hashtag}
        </div>
      </footer>
    </>
  );
}
