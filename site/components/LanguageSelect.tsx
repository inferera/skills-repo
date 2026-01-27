"use client";

import { LOCALE_OPTIONS, type Locale } from "@/lib/i18n";

import { useI18n } from "@/components/I18nProvider";

export function LanguageSelect() {
  const { locale, setLocale, t } = useI18n();

  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      className="h-9 px-3 bg-card border border-border rounded-lg text-sm text-foreground hover:bg-card-hover hover:border-border-hover transition-colors cursor-pointer"
      aria-label={t("language.label")}
      title={t("language.label")}
    >
      {LOCALE_OPTIONS.map((o) => (
        <option key={o.locale} value={o.locale}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

