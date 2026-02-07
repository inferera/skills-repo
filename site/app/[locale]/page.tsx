import { HomePageClient } from "../HomePageClient";
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
    return { title: "Skills Registry" };
  }

  // Localized metadata
  const titles: Record<Locale, string> = {
    "en": "Skills Registry",
    "zh-CN": "技能注册表",
    "zh-TW": "技能註冊表",
    "ja": "スキルレジストリ",
    "ko": "스킬 레지스트리",
    "de": "Skills Registry",
    "es": "Skills Registry",
    "fr": "Skills Registry",
    "pt": "Skills Registry",
    "ru": "Skills Registry"
  };

  const descriptions: Record<Locale, string> = {
    "en": "A community-maintained registry of skills for AI agents",
    "zh-CN": "社区维护的 AI Agent 技能注册表",
    "zh-TW": "社區維護的 AI Agent 技能註冊表",
    "ja": "コミュニティが維持する AI エージェントのスキルレジストリ",
    "ko": "커뮤니티가 관리하는 AI 에이전트 스킬 레지스트리",
    "de": "Ein von der Community gepflegtes Register für KI-Agenten-Fähigkeiten",
    "es": "Un registro de habilidades para agentes IA mantenido por la comunidad",
    "fr": "Un registre de compétences pour agents IA maintenu par la communauté",
    "pt": "Um registro de habilidades para agentes IA mantido pela comunidade",
    "ru": "Реестр навыков для ИИ-агентов, поддерживаемый сообществом"
  };

  return {
    title: titles[locale as Locale],
    description: descriptions[locale as Locale],
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(
        LOCALE_OPTIONS.map(opt => [
          opt.locale,
          opt.locale === DEFAULT_LOCALE ? '/' : `/${opt.locale}`
        ])
      )
    }
  };
}

export default async function LocaleHomePage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Validate locale
  if (!isLocale(locale)) {
    notFound();
  }

  const index = await loadRegistryIndex();
  const categories = await loadRegistryCategories();

  return <HomePageClient index={index} categories={categories} />;
}
