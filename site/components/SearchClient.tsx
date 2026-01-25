"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { RegistrySkill } from "@/lib/types";

import { SkillCard } from "@/components/SkillCard";

export function SearchClient({ skills }: { skills: RegistrySkill[] }) {
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
    if (!query) return skills.slice(0, 12);

    return skills
      .filter((s) => {
        const haystack = [s.id, s.title, s.description, s.summary, (s.tags ?? []).join(" "), (s.agents ?? []).join(" ")]
          .filter(Boolean)
          .join("\n")
          .toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 24);
  }, [q, skills]);

  return (
    <section>
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
          className="w-full h-12 pl-12 pr-24 bg-card border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search skills by name, tag, or agent..."
          aria-label="Search skills"
        />
        <div className="absolute inset-y-0 right-0 pr-4 flex items-center gap-2">
          {q.trim() && (
            <button
              onClick={() => setQ("")}
              className="px-2 py-1 text-xs font-medium text-muted hover:text-foreground transition-colors"
            >
              Clear
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center px-2 py-1 rounded-md text-xs font-mono text-muted bg-background-secondary border border-border">
            /
          </kbd>
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted">
          {q.trim()
            ? `${results.length} result${results.length !== 1 ? "s" : ""} found`
            : `Showing ${results.length} of ${skills.length} skills`}
        </p>
      </div>

      {/* Results grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.map((s) => (
          <SkillCard key={s.id} skill={s} />
        ))}
      </div>

      {/* Empty state */}
      {results.length === 0 && q.trim() && (
        <div className="text-center py-12">
          <svg className="w-12 h-12 text-muted mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
          </svg>
          <p className="text-muted">No skills found for &quot;{q}&quot;</p>
          <button
            onClick={() => setQ("")}
            className="mt-2 text-sm text-accent hover:underline"
          >
            Clear search
          </button>
        </div>
      )}
    </section>
  );
}
