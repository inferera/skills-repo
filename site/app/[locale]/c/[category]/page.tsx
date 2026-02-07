import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CategoryPageClient } from "../../../c/[category]/CategoryPageClient";
import { loadRegistryCategories, loadRegistryIndex } from "@/lib/registry";
import { getLocalizedText, LOCALE_OPTIONS, isLocale, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

export const dynamicParams = false;

export async function generateStaticParams() {
  const cats = await loadRegistryCategories();
  const locales = LOCALE_OPTIONS;

  // Generate all locale + category combinations
  const params = [];
  for (const locale of locales) {
    for (const cat of cats.categories) {
      params.push({ locale: locale.locale, category: cat.id });
    }
  }
  return params;
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string; category: string }>;
}): Promise<Metadata> {
  const { locale, category } = await params;

  if (!isLocale(locale)) {
    return { title: category };
  }

  const cats = await loadRegistryCategories();
  const cat = cats.categories.find((c) => c.id === category);

  const title = cat ? getLocalizedText(cat.title, locale as Locale) : category;
  const description = cat?.description
    ? getLocalizedText(cat.description, locale as Locale)
    : `Browse skills in ${title}.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}/c/${category}`,
      languages: Object.fromEntries(
        LOCALE_OPTIONS.map(opt => [
          opt.locale,
          opt.locale === DEFAULT_LOCALE ? `/c/${category}` : `/${opt.locale}/c/${category}`
        ])
      )
    }
  };
}

export default async function LocaleCategoryPage({
  params
}: {
  params: Promise<{ locale: string; category: string }>;
}) {
  const { locale, category } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const index = await loadRegistryIndex();
  const cats = await loadRegistryCategories();

  const cat = cats.categories.find((c) => c.id === category) ?? null;

  // v2: filter by category only
  const skills = index.skills
    .filter((s) => s.category === category)
    .sort((a, b) => a.title.localeCompare(b.title));

  return <CategoryPageClient category={category} cat={cat} skills={skills} />;
}
