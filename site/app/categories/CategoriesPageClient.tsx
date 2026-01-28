"use client";

import Link from "next/link";

import type { RegistryCategories } from "@/lib/types";
import { getLocalizedText } from "@/lib/i18n";

import { useI18n } from "@/components/I18nProvider";

export function CategoriesPageClient({
  cats,
  counts,
}: {
  cats: RegistryCategories;
  counts: Record<string, number>;
}) {
  const { t, locale } = useI18n();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-heading text-3xl font-bold text-foreground mb-2">{t("categories.title")}</h1>
        <p className="text-secondary">
          {t("categories.description")}
        </p>
      </div>

      {/* Categories Grid - v2: flat categories */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cats.categories.map((cat) => {
          const count = counts[cat.id] ?? 0;
          const title = getLocalizedText(cat.title, locale);
          const description = cat.description ? getLocalizedText(cat.description, locale) : "";

          return (
            <Link
              key={cat.id}
              href={`/c/${cat.id}`}
              className="group block p-6 bg-card border border-border rounded-xl hover:border-border-hover hover:bg-background-secondary transition-all"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <h2 className="font-heading text-lg font-semibold text-foreground group-hover:text-accent transition-colors truncate">
                    {title}
                  </h2>
                  <span className="text-xs font-mono text-muted mt-1 block">
                    {cat.id}
                  </span>
                </div>
                <span className="px-2 py-1 rounded-md text-sm font-medium text-accent bg-accent/10 shrink-0">
                  {count}
                </span>
              </div>
              {description && (
                <p className="text-sm text-secondary line-clamp-2">{description}</p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

