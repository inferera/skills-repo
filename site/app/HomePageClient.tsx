"use client";

import Link from "next/link";

import type { RegistryCategories, RegistryIndex } from "@/lib/types";
import { getLocalizedText, getLocalePath } from "@/lib/i18n";

import { useI18n } from "@/components/I18nProvider";
import { SearchClient } from "@/components/SearchClient";

export function HomePageClient({
  index,
  categories,
}: {
  index: RegistryIndex;
  categories: RegistryCategories;
}) {
  const { t, locale } = useI18n();

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center py-12 sm:py-16">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-muted text-accent text-sm font-medium mb-6">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <span>{t("home.hero.skillsAvailable", { count: index.skills.length })}</span>
        </div>

        <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-4">
          {t("home.hero.title")}
        </h1>

        <p className="text-lg sm:text-xl text-secondary max-w-2xl mx-auto mb-8">
          {t("home.hero.subtitle")}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href={getLocalePath("/import", locale)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            {t("home.hero.submitSkill")}
          </Link>
          <Link
            href={getLocalePath("/categories", locale)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-card border border-border text-foreground font-medium hover:bg-card-hover hover:border-border-hover transition-colors"
          >
            {t("home.hero.browseCategories")}
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </Link>
        </div>
      </section>

      {/* Categories Section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading text-xl font-semibold text-foreground">{t("home.categories.title")}</h2>
          <Link href={getLocalePath("/categories", locale)} className="text-sm text-accent hover:underline">
            {t("home.categories.viewAll")}
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {categories.categories.map((c) => {
            const skillCount = index.skills.filter((s) => s.category === c.id).length;
            const title = getLocalizedText(c.title, locale);
            return (
              <Link
                key={c.id}
                href={getLocalePath(`/c/${c.id}`, locale)}
                className="group flex flex-col items-center p-4 bg-card border border-border rounded-xl hover:border-border-hover hover:bg-card-hover transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <svg className="w-5 h-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                  </svg>
                </div>
                <span className="font-medium text-sm text-foreground text-center">{title}</span>
                <span className="text-xs text-muted mt-1">{t("home.categories.skillCount", { count: skillCount })}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Skills Section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading text-xl font-semibold text-foreground">{t("home.skills.title")}</h2>
        </div>

        <SearchClient skills={index.skills} />
      </section>
    </div>
  );
}

