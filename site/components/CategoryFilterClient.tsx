"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { RegistrySkill } from "@/lib/types";

import { useI18n } from "@/components/I18nProvider";
import { SkillCard } from "@/components/SkillCard";

export function CategoryFilterClient({ skills }: { skills: RegistrySkill[] }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase() ?? "";
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return skills;
    return skills.filter((s) => {
      const haystack = [s.id, s.title, s.description, s.summary, (s.tags ?? []).join(" "), (s.agents ?? []).join(" ")]
        .filter(Boolean)
        .join("\n")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [q, skills]);

  return (
    <div>
      {/* Search input */}
      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <svg className="w-5 h-5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
          </svg>
        </div>
        <input
          ref={inputRef}
          className="w-full h-11 pl-12 pr-20 bg-card border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("filter.placeholder")}
          aria-label={t("filter.ariaLabel")}
        />
        <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
          {q.trim() && (
            <button
              onClick={() => setQ("")}
              className="px-2 py-1 text-xs font-medium text-muted hover:text-foreground transition-colors"
            >
              {t("common.clear")}
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted mb-4">
        {t("filter.count", { shown: results.length, total: skills.length })}
      </p>

      {/* Results grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.map((s) => (
          <SkillCard key={s.id} skill={s} />
        ))}
      </div>

      {/* Empty state */}
      {results.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted">{t("filter.noResults")}</p>
        </div>
      )}
    </div>
  );
}
