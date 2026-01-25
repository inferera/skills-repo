import type { Metadata } from "next";

import "./globals.css";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { SITE_NAME, SITE_URL } from "@/lib/config";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL || "http://localhost:3000"),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`
  },
  description: "A community-maintained registry of agent skills.",
  openGraph: {
    title: SITE_NAME,
    description: "A community-maintained registry of agent skills.",
    type: "website"
  },
  robots: {
    index: true,
    follow: true
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a
          className="absolute left-3.5 top-3 px-3 py-2.5 rounded-[12px] bg-surface-strong border border-border shadow-sm -translate-y-[200%] transition-transform duration-150 focus:translate-y-0 focus:outline-none z-[100]"
          href="#content"
        >
          Skip to content
        </a>
        <Header />
        <main id="content" className="max-w-[1120px] mx-auto px-5 py-[30px] pb-[72px] animate-fade-up">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
