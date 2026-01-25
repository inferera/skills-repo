import Link from "next/link";
import type { Metadata } from "next";

import { CategoryFilterClient } from "@/components/CategoryFilterClient";
import { loadRegistryCategories, loadRegistryIndex } from "@/lib/registry";

export const dynamicParams = false;

export async function generateStaticParams() {
  const cats = await loadRegistryCategories();
  return cats.categories.flatMap((c) => c.subcategories.map((s) => ({ category: c.id, subcategory: s.id })));
}

export async function generateMetadata({
  params
}: {
  params: { category: string; subcategory: string };
}): Promise<Metadata> {
  const cats = await loadRegistryCategories();
  const cat = cats.categories.find((c) => c.id === params.category);
  const sub = cat?.subcategories.find((s) => s.id === params.subcategory);

  const title = sub ? `${cat?.title} / ${sub.title}` : `${params.category} / ${params.subcategory}`;
  return {
    title,
    description: `Browse skills in ${title}.`
  };
}

export default async function CategoryPage({ params }: { params: { category: string; subcategory: string } }) {
  const index = await loadRegistryIndex();
  const cats = await loadRegistryCategories();

  const cat = cats.categories.find((c) => c.id === params.category);
  const sub = cat?.subcategories.find((s) => s.id === params.subcategory);

  const skills = index.skills
    .filter((s) => s.category === params.category && s.subcategory === params.subcategory)
    .sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div className="grid" style={{ gap: 16 }}>
      <section className="card" style={{ padding: 18 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, letterSpacing: "-0.02em" }}>
              {cat?.title ?? params.category} / {sub?.title ?? params.subcategory}
            </h1>
            <p className="muted" style={{ margin: "8px 0 0", lineHeight: 1.6 }}>
              {skills.length} skills
            </p>
          </div>

          <Link className="btn" href="/categories">
            All categories
          </Link>
        </div>

        {cat ? (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            {cat.subcategories.map((s) => (
              <Link
                key={s.id}
                className={`btn ${s.id === params.subcategory ? "primary" : ""}`}
                href={`/c/${cat.id}/${s.id}`}
              >
                {s.title}
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      <CategoryFilterClient skills={skills} />
    </div>
  );
}
