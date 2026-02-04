import type { Metadata } from "next";
import { HomePageClient } from "./HomePageClient";
import { loadRegistryCategories, loadRegistryIndex } from "@/lib/registry";
import { LOCALE_OPTIONS, DEFAULT_LOCALE } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Skills Registry",
  description: "Discover and share reusable skills for Claude AI agents. Browse curated skills, import from GitHub, and enhance your AI workflows.",
  alternates: {
    canonical: "/",
    languages: Object.fromEntries(
      LOCALE_OPTIONS.map(opt => [
        opt.locale,
        opt.locale === DEFAULT_LOCALE ? '/' : `/${opt.locale}`
      ])
    )
  }
};

export default async function HomePage() {
  const index = await loadRegistryIndex();
  const categories = await loadRegistryCategories();

  return <HomePageClient index={index} categories={categories} />;
}
