import type { Metadata } from "next";

import "./globals.css";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SITE_NAME, SITE_URL } from "@/lib/config";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL || "http://localhost:3000"),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`
  },
  description: "A community-maintained registry of agent skills. Discover, import, and share AI agent capabilities.",
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

// Script to prevent theme flash on load
const themeScript = `
  (function() {
    const theme = localStorage.getItem('theme') || 'system';
    let resolved = theme;
    if (theme === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.classList.add(resolved);
    document.documentElement.style.colorScheme = resolved;
  })();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-background">
        <ThemeProvider>
          <a
            className="absolute left-4 top-4 px-3 py-2 rounded-lg bg-card border border-border text-sm font-medium -translate-y-[200%] transition-transform duration-150 focus:translate-y-0 z-[100]"
            href="#content"
          >
            Skip to content
          </a>
          <Header />
          <main id="content" className="max-w-6xl mx-auto px-4 sm:px-6 py-8 animate-fade-up">
            {children}
          </main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
