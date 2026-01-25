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
  params: Promise<{ category: string; subcategory: string }>;
}): Promise<Metadata> {
  const { category, subcategory } = await params;
  const cats = await loadRegistryCategories();
  const cat = cats.categories.find((c) => c.id === category);
  const sub = cat?.subcategories.find((s) => s.id === subcategory);

  const title = sub ? `${cat?.title} / ${sub.title}` : `${category} / ${subcategory}`;
  return {
    title,
    description: `Browse skills in ${title}.`
  };
}

export default async function CategoryPage({
  params
}: {
  params: Promise<{ category: string; subcategory: string }>;
}) {
  const { category, subcategory } = await params;
  const index = await loadRegistryIndex();
  const cats = await loadRegistryCategories();

  const cat = cats.categories.find((c) => c.id === category);
  const sub = cat?.subcategories.find((s) => s.id === subcategory);

  const skills = index.skills
    .filter((s) => s.category === category && s.subcategory === subcategory)
    .sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div className="grid gap-4">
      <section className="bg-surface border border-black/12 rounded-[16px] shadow-[0_1px_0_rgba(15,23,42,0.06)] p-[18px]">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="m-0 text-[28px] tracking-tight">
              {cat?.title ?? category} / {sub?.title ?? subcategory}
            </h1>
            <p className="text-muted mt-2 leading-relaxed">{skills.length} skills</p>
          </div>

          <Link
            className="inline-flex items-center justify-center gap-2.5 px-3.5 py-2.5 rounded-[12px] border border-border bg-white/92 font-semibold shadow-[0_1px_0_rgba(15,23,42,0.05)] transition-all duration-150 hover:-translate-y-px hover:border-black/28 hover:shadow-sm"
            href="/categories"
          >
            All categories
          </Link>
        </div>

        {cat ? (
          <div className="flex gap-2.5 flex-wrap mt-3.5">
            {cat.subcategories.map((s) => (
              <Link
                key={s.id}
                className={`inline-flex items-center justify-center gap-2.5 px-3.5 py-2.5 rounded-[12px] border font-semibold shadow-[0_1px_0_rgba(15,23,42,0.05)] transition-all duration-150 hover:-translate-y-px ${
                  s.id === subcategory
                    ? "border-accent/95 bg-gradient-to-b from-accent to-accent-ink text-white/98 shadow-primary hover:from-accent-ink hover:to-accent-ink"
                    : "border-border bg-white/92 hover:border-black/28 hover:shadow-sm"
                }`}
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
