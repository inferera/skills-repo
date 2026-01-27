"use client";

import type { MessageKey } from "@/lib/i18n";
import { useI18n } from "@/components/I18nProvider";

export function T({ k, params }: { k: MessageKey; params?: Record<string, string | number> }) {
  const { t } = useI18n();
  return <>{t(k, params)}</>;
}

