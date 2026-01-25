import Link from "next/link";

import { loadRegistryCategories, loadRegistryIndex } from "@/lib/registry";

export const dynamic = "error";

export const metadata = {
  title: "Categories"
};

export default async function CategoriesPage() {
  const cats = await loadRegistryCategories();
  const index = await loadRegistryIndex();

  const counts = new Map<string, number>();
  for (const s of index.skills) {
    const key = `${s.category}/${s.subcategory}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <section className="card" style={{ padding: 18 }}>
        <h1 style={{ margin: 0, fontSize: 28, letterSpacing: "-0.02em" }}>Categories</h1>
        <p className="muted" style={{ margin: "8px 0 0", lineHeight: 1.6 }}>
          Two-level classification: category / subcategory.
        </p>
      </section>

      <div className="grid" style={{ gap: 14 }}>
        {cats.categories.map((cat) => (
          <section key={cat.id} className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>{cat.title}</h2>
                {cat.description ? (
                  <p className="muted" style={{ margin: "6px 0 0", lineHeight: 1.55 }}>
                    {cat.description}
                  </p>
                ) : null}
              </div>
              <span className="chip">{cat.id}</span>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
              {cat.subcategories.map((sub) => {
                const key = `${cat.id}/${sub.id}`;
                return (
                  <Link key={sub.id} className="btn" href={`/c/${cat.id}/${sub.id}`}>
                    <span style={{ fontWeight: 700 }}>{sub.title}</span>
                    <span className="chip" style={{ marginLeft: 10 }}>
                      {counts.get(key) ?? 0}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
