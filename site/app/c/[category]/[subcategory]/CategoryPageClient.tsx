"use client";

import Link from "next/link";

import type { RegistryCategory, RegistrySkill, RegistrySubcategory } from "@/lib/types";

import { useI18n } from "@/components/I18nProvider";
import { CategoryFilterClient } from "@/components/CategoryFilterClient";

export function CategoryPageClient({
  category,
  subcategory,
  cat,
  sub,
  skills,
}: {
  category: string;
  subcategory: string;
  cat: RegistryCategory | null;
  sub: RegistrySubcategory | null;
  skills: RegistrySkill[];
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 bg-card border border-border rounded-xl">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-heading text-3xl font-bold text-foreground">
              {cat?.title ?? category} / {sub?.title ?? subcategory}
            </h1>
            <p className="text-secondary mt-2">{t("categoryPage.skillsCount", { count: skills.length })}</p>
          </div>

          <Link
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-background-secondary text-foreground font-medium hover:border-border-hover hover:bg-card transition-colors"
            href="/categories"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            {t("categoryPage.allCategories")}
          </Link>
        </div>

        {cat ? (
          <div className="flex gap-2 flex-wrap mt-4">
            {cat.subcategories.map((s) => (
              <Link
                key={s.id}
                className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                  s.id === subcategory
                    ? "bg-accent text-white"
                    : "bg-background-secondary border border-border text-foreground hover:border-border-hover hover:bg-card"
                }`}
                href={`/c/${cat.id}/${s.id}`}
              >
                {s.title}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      <CategoryFilterClient skills={skills} />
    </div>
  );
}

