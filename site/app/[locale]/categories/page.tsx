import { CategoriesPageClient } from "../../categories/CategoriesPageClient";
import { loadRegistryCategories, loadRegistryIndex } from "@/lib/registry";
import { LOCALE_OPTIONS, isLocale, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamicParams = false;

export async function generateStaticParams() {
  // Generate static pages for all locales including English
  return LOCALE_OPTIONS.map(opt => ({ locale: opt.locale }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  if (!isLocale(locale)) {
    return { title: "Categories" };
  }

  const titles: Record<Locale, string> = {
    "en": "Categories",
    "zh-CN": "分类",
    "zh-TW": "分類",
    "ja": "カテゴリ",
    "ko": "카테고리",
    "de": "Kategorien",
    "es": "Categorías",
    "fr": "Catégories",
    "pt": "Categorias",
    "ru": "Категории"
  };

  return {
    title: titles[locale as Locale],
    alternates: {
      canonical: `/${locale}/categories`,
      languages: Object.fromEntries(
        LOCALE_OPTIONS.map(opt => [
          opt.locale,
          opt.locale === DEFAULT_LOCALE ? '/categories' : `/${opt.locale}/categories`
        ])
      )
    }
  };
}

export default async function LocaleCategoriesPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const cats = await loadRegistryCategories();
  const index = await loadRegistryIndex();

  // v2: flat categories (no subcategories)
  const counts: Record<string, number> = {};
  for (const s of index.skills) {
    counts[s.category] = (counts[s.category] ?? 0) + 1;
  }

  return <CategoriesPageClient cats={cats} counts={counts} />;
}
