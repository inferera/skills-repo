import Link from "next/link";

import { REPO_URL, SITE_NAME } from "@/lib/config";

export function Header() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-[12px] bg-bg/88 border-b border-black/10">
      <div className="max-w-[1120px] mx-auto px-5 flex items-center justify-between gap-3.5 py-3.5">
        <Link href="/" className="flex items-baseline gap-3 min-w-0" aria-label={`${SITE_NAME} home`}>
          <span
            className="w-3 h-3 rounded-[4px] bg-accent shadow-[0_10px_24px_rgba(37,99,235,0.22)] shrink-0"
            aria-hidden="true"
          />
          <span className="font-[850] tracking-tight whitespace-nowrap">{SITE_NAME}</span>
          <span className="inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1.5 font-mono text-xs text-muted bg-white/55">
            registry
          </span>
        </Link>

        <nav className="flex items-center gap-2.5 flex-wrap" aria-label="Primary">
          <Link
            className="inline-flex items-center justify-center gap-2.5 px-3.5 py-2.5 rounded-[12px] border border-border bg-white/92 font-semibold shadow-[0_1px_0_rgba(15,23,42,0.05)] transition-all duration-150 hover:-translate-y-px hover:border-black/28 hover:shadow-sm"
            href="/categories"
          >
            Categories
          </Link>
          <Link
            className="inline-flex items-center justify-center gap-2.5 px-3.5 py-2.5 rounded-[12px] border border-accent/95 bg-gradient-to-b from-accent to-accent-ink text-white/98 font-semibold shadow-primary transition-all duration-150 hover:-translate-y-px hover:from-accent-ink hover:to-accent-ink"
            href="/import"
          >
            Import
          </Link>
          {REPO_URL ? (
            <a
              className="inline-flex items-center justify-center gap-2.5 px-3.5 py-2.5 rounded-[12px] border border-border bg-white/92 font-semibold shadow-[0_1px_0_rgba(15,23,42,0.05)] transition-all duration-150 hover:-translate-y-px hover:border-black/28 hover:shadow-sm"
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
