import Link from "next/link";

import { SearchClient } from "@/components/SearchClient";
import { loadRegistryCategories, loadRegistryIndex } from "@/lib/registry";

export default async function HomePage() {
  const index = await loadRegistryIndex();
  const categories = await loadRegistryCategories();

  return (
    <div className="grid gap-4">
      <section className="bg-surface border border-black/12 rounded-[16px] shadow-[0_1px_0_rgba(15,23,42,0.06)] p-[18px]">
        <div className="flex items-start justify-between gap-3.5 flex-wrap">
          <div className="min-w-[280px] flex-[1_1_520px]">
            <h1 className="m-0 text-[40px] tracking-tighter leading-[1.05]">
              Skills, curated like a codebase.
            </h1>
            <p className="text-muted mt-2.5 text-base leading-relaxed">
              Browse community skills by category. Import from GitHub repos. Keep everything reviewable via PRs.
            </p>

            <div className="flex gap-2.5 flex-wrap mt-3.5">
              <span className="inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1.5 font-mono text-xs text-muted bg-white/55">
                {index.skills.length} skills
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1.5 font-mono text-xs text-muted bg-white/55">
                {categories.categories.length} categories
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1.5 font-mono text-xs text-muted bg-white/55">
                static + SEO
              </span>
            </div>
          </div>

          <div className="flex gap-2.5 flex-wrap items-center">
            <Link
              className="inline-flex items-center justify-center gap-2.5 px-3.5 py-2.5 rounded-[12px] border border-accent/95 bg-gradient-to-b from-accent to-accent-ink text-white/98 font-semibold shadow-primary transition-all duration-150 hover:-translate-y-px hover:from-accent-ink hover:to-accent-ink"
              href="/import"
            >
              Import from GitHub
            </Link>
            <Link
              className="inline-flex items-center justify-center gap-2.5 px-3.5 py-2.5 rounded-[12px] border border-border bg-white/92 font-semibold shadow-[0_1px_0_rgba(15,23,42,0.05)] transition-all duration-150 hover:-translate-y-px hover:border-black/28 hover:shadow-sm"
              href="/categories"
            >
              Browse categories
            </Link>
          </div>
        </div>

        <div className="flex gap-2.5 flex-wrap mt-4">
          {categories.categories.slice(0, 8).map((c) => (
            <Link
              key={c.id}
              className="inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1.5 font-mono text-xs text-muted bg-white/55 transition-all duration-150 hover:border-accent/26 hover:text-accent"
              href={`/c/${c.id}/${c.subcategories[0]?.id ?? ""}`.replace(/\/$/, "")}
            >
              {c.title}
            </Link>
          ))}
        </div>
      </section>

      <SearchClient skills={index.skills} />
    </div>
  );
}
