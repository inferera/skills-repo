import Link from "next/link";

import { SearchClient } from "@/components/SearchClient";
import { loadRegistryCategories, loadRegistryIndex } from "@/lib/registry";

export default async function HomePage() {
  const index = await loadRegistryIndex();
  const categories = await loadRegistryCategories();

  return (
    <div className="grid" style={{ gap: 16 }}>
      <section className="card" style={{ padding: 18 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <div style={{ minWidth: 280, flex: "1 1 520px" }}>
            <h1 style={{ margin: 0, fontSize: 40, letterSpacing: "-0.03em", lineHeight: 1.05 }}>
              Skills, curated like a codebase.
            </h1>
            <p className="muted" style={{ margin: "10px 0 0", fontSize: 16, lineHeight: 1.55 }}>
              Browse community skills by category. Import from GitHub repos. Keep everything reviewable via PRs.
            </p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
              <span className="chip">{index.skills.length} skills</span>
              <span className="chip">{categories.categories.length} categories</span>
              <span className="chip">static + SEO</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Link className="btn primary" href="/import">
              Import from GitHub
            </Link>
            <Link className="btn" href="/categories">
              Browse categories
            </Link>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          {categories.categories.slice(0, 8).map((c) => (
            <Link key={c.id} className="chip" href={`/c/${c.id}/${c.subcategories[0]?.id ?? ""}`.replace(/\/$/, "")}>
              {c.title}
            </Link>
          ))}
        </div>
      </section>

      <SearchClient skills={index.skills} />
    </div>
  );
}
