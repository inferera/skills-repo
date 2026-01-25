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
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-heading text-3xl font-bold text-foreground mb-2">Categories</h1>
        <p className="text-secondary">
          Browse skills by category and subcategory.
        </p>
      </div>

      {/* Categories List */}
      <div className="space-y-6">
        {cats.categories.map((cat) => (
          <section
            key={cat.id}
            className="p-6 bg-card border border-border rounded-xl"
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="font-heading text-xl font-semibold text-foreground">{cat.title}</h2>
                {cat.description && (
                  <p className="text-secondary mt-1">{cat.description}</p>
                )}
              </div>
              <span className="px-2 py-1 rounded-md text-xs font-mono text-muted bg-background-secondary">
                {cat.id}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {cat.subcategories.map((sub) => {
                const key = `${cat.id}/${sub.id}`;
                const count = counts.get(key) ?? 0;
                return (
                  <Link
                    key={sub.id}
                    href={`/c/${cat.id}/${sub.id}`}
                    className="group inline-flex items-center gap-2 px-3 py-2 bg-background-secondary border border-border rounded-lg hover:border-border-hover hover:bg-card transition-colors"
                  >
                    <span className="font-medium text-sm text-foreground group-hover:text-accent transition-colors">
                      {sub.title}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-xs text-muted bg-card">
                      {count}
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
