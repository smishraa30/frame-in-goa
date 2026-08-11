import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EVENT } from "@/lib/brand";
import { siteUrl } from "@/lib/site";
import { decodeId } from "@/lib/store";

type Params = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> };

const SITE = siteUrl();

function absolute(url: string) {
  return url.startsWith("/") ? `${SITE}${url}` : url;
}

function caption(sp: Record<string, string>) {
  const who = sp.n?.trim();
  const bits = [who, sp.r?.trim()].filter(Boolean).join(" — ");
  return bits || `An ${EVENT.short} ${EVENT.year} builder`;
}

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const { id } = await params;
  const sp = await searchParams;
  const img = decodeId(id);
  if (!img) return { title: "Card not found · Frame In Goa" };

  const title = `${caption(sp)} · ${EVENT.short} ${EVENT.year}`;
  const description = `${sp.c ? `${sp.c} · ` : ""}${sp.i ? `#${sp.i} · ` : ""}Made with Frame In Goa. Build in Goa, ship from paradise. ${EVENT.hashtag}`;
  const image = absolute(img);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: image, alt: title }],
      type: "article",
      url: `${SITE}/s/${id}`,
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function SharePage({ params, searchParams }: Params) {
  const { id } = await params;
  const sp = await searchParams;
  const img = decodeId(id);
  if (!img) notFound();

  return (
    <main className="share-page">
      <div className="share-card">
        <span className="kicker">{EVENT.short} {EVENT.year} · {EVENT.hashtag}</span>
        <h1 className="big" style={{ fontSize: "clamp(34px,7vw,64px)", margin: "16px 0 20px" }}>
          {caption(sp)}
        </h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img} alt={`${caption(sp)} — HH Goa 2026 card`} />
        <p className="lede" style={{ margin: "18px auto 22px" }}>
          {sp.c ? `Builder class: ${sp.c}. ` : ""}
          {sp.i ? `Builder ID #${sp.i}. ` : ""}
          Made in one pass with Frame In Goa — drop a photo, get your own in seconds.
        </p>
        <a className="btn accent" href="/">
          MAKE YOUR OWN →
        </a>
      </div>
    </main>
  );
}
