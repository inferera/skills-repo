"use client";

import { useI18n } from "@/components/I18nProvider";

export function SkipToContent() {
  const { t } = useI18n();
  return (
    <a
      className="absolute left-4 top-4 px-3 py-2 rounded-lg bg-card border border-border text-sm font-medium -translate-y-[200%] transition-transform duration-150 focus:translate-y-0 z-[100]"
      href="#content"
    >
      {t("site.skipToContent")}
    </a>
  );
}

