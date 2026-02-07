import { ImportClient } from "../../import/ImportClient";
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
    return { title: "Import Skills" };
  }

  const titles: Record<Locale, string> = {
    "en": "Import Skills",
    "zh-CN": "导入技能",
    "zh-TW": "匯入技能",
    "ja": "スキルをインポート",
    "ko": "스킬 가져오기",
    "de": "Fähigkeiten importieren",
    "es": "Importar habilidades",
    "fr": "Importer des compétences",
    "pt": "Importar habilidades",
    "ru": "Импорт навыков"
  };

  return {
    title: titles[locale as Locale],
    alternates: {
      canonical: `/${locale}/import`,
      languages: Object.fromEntries(
        LOCALE_OPTIONS.map(opt => [
          opt.locale,
          opt.locale === DEFAULT_LOCALE ? '/import' : `/${opt.locale}/import`
        ])
      )
    }
  };
}

export default async function LocaleImportPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const categories = await loadRegistryCategories();
  const registryIndex = await loadRegistryIndex();

  return <ImportClient initialCategories={categories} initialRegistryIndex={registryIndex} />;
}
