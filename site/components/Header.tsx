import Link from "next/link";

import { REPO_URL, SITE_NAME } from "@/lib/config";

export function Header() {
  return (
    <header
      className="card"
      style={{
        margin: "18px auto 0",
        maxWidth: 1120,
        padding: "14px 16px"
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontWeight: 800, letterSpacing: "-0.02em" }}>{SITE_NAME}</span>
          <span className="chip">community</span>
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link className="btn" href="/categories">
            Categories
          </Link>
          <Link className="btn primary" href="/import">
            Import
          </Link>
          {REPO_URL ? (
            <a className="btn" href={REPO_URL} target="_blank" rel="noreferrer">
              GitHub
            </a>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

