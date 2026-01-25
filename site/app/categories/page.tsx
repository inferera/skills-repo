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
    <div className="grid gap-4">
      <section className="bg-surface border border-black/12 rounded-[16px] shadow-[0_1px_0_rgba(15,23,42,0.06)] p-[18px]">
        <h1 className="m-0 text-[28px] tracking-tight">Categories</h1>
        <p className="text-muted mt-2 leading-relaxed">
          Two-level classification: category / subcategory.
        </p>
      </section>

      <div className="grid gap-3.5">
        {cats.categories.map((cat) => (
          <section
            key={cat.id}
            className="bg-surface border border-black/12 rounded-[16px] shadow-[0_1px_0_rgba(15,23,42,0.06)] p-4"
          >
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <div>
                <h2 className="m-0 text-lg">{cat.title}</h2>
                {cat.description ? (
                  <p className="text-muted mt-1.5 leading-relaxed">{cat.description}</p>
                ) : null}
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1.5 font-mono text-xs text-muted bg-white/55">
                {cat.id}
              </span>
            </div>

            <div className="flex gap-2.5 flex-wrap mt-3">
              {cat.subcategories.map((sub) => {
                const key = `${cat.id}/${sub.id}`;
                return (
                  <Link
                    key={sub.id}
                    className="inline-flex items-center justify-center gap-2.5 px-3.5 py-2.5 rounded-[12px] border border-border bg-white/92 font-semibold shadow-[0_1px_0_rgba(15,23,42,0.05)] transition-all duration-150 hover:-translate-y-px hover:border-black/28 hover:shadow-sm"
                    href={`/c/${cat.id}/${sub.id}`}
                  >
                    <span className="font-bold">{sub.title}</span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1.5 font-mono text-xs text-muted bg-white/55 ml-2.5">
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
