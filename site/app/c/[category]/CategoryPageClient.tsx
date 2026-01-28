"use client";

import Link from "next/link";

import type { RegistryCategory, RegistrySkill } from "@/lib/types";
import { getLocalizedText } from "@/lib/i18n";

import { useI18n } from "@/components/I18nProvider";
import { CategoryFilterClient } from "@/components/CategoryFilterClient";

export function CategoryPageClient({
  category,
  cat,
  skills,
}: {
  category: string;
  cat: RegistryCategory | null;
  skills: RegistrySkill[];
}) {
  const { t, locale } = useI18n();

  const title = cat ? getLocalizedText(cat.title, locale) : category;
  const description = cat?.description ? getLocalizedText(cat.description, locale) : "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 bg-card border border-border rounded-xl">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h1 className="font-heading text-3xl font-bold text-foreground">
              {title}
            </h1>
            {description && (
              <p className="text-secondary mt-2">{description}</p>
            )}
            <p className="text-muted text-sm mt-3">
              {t("categoryPage.skillsCount", { count: skills.length })}
            </p>
          </div>

          <Link
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-background-secondary text-foreground font-medium hover:border-border-hover hover:bg-card transition-colors shrink-0"
            href="/categories"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            {t("categoryPage.allCategories")}
          </Link>
        </div>
      </div>

      <CategoryFilterClient skills={skills} />
    </div>
  );
}
