import type { Metadata, Viewport } from "next";
import { Imbue, Victor_Mono } from "next/font/google";
import { siteUrl } from "@/lib/site";
import "./globals.css";

const mono = Victor_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono-src",
  display: "swap",
});

const display = Imbue({
  subsets: ["latin"],
  variable: "--font-display-src",
  display: "swap",
});

const SITE = siteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Frame In Goa — HH Goa 2026 pass & frame generator",
  description:
    "Drop a photo, get an official-looking Hacker House Goa 2026 builder pass, PFP frame, crew frame or X banner in under a second. No login. Share straight to X.",
  keywords: ["HH Goa 2026", "FrameInGoa", "Hacker House Goa", "builder pass", "PFP frame"],
  openGraph: {
    title: "Frame In Goa — HH Goa 2026 pass & frame generator",
    description:
      "Photo in, branded HH Goa 2026 graphic out. Four formats, three themes, zero login. #FrameInGoa",
    url: SITE,
    siteName: "Frame In Goa",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Frame In Goa" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Frame In Goa — HH Goa 2026 pass & frame generator",
    description: "Photo in, branded HH Goa 2026 graphic out. Four formats. No login. #FrameInGoa",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#04160E",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${mono.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
