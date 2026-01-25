import { REPO_URL } from "@/lib/config";

export function Footer() {
  return (
    <footer
      style={{
        maxWidth: 1120,
        margin: "0 auto",
        padding: "0 20px 36px",
        color: "rgba(11, 11, 16, 0.6)"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13 }}>Built from repo metadata. Static. Fast. Forkable.</span>
        {REPO_URL ? (
          <a href={REPO_URL} target="_blank" rel="noreferrer" style={{ fontSize: 13, textDecoration: "underline" }}>
            Contribute on GitHub
          </a>
        ) : null}
      </div>
    </footer>
  );
}

