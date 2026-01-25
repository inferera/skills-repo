"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { RegistrySkill } from "@/lib/types";

import { SkillCard } from "@/components/SkillCard";

export function CategoryFilterClient({ skills }: { skills: RegistrySkill[] }) {
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
    <section className="bg-surface-strong border border-black/12 rounded-[16px] shadow-[0_1px_0_rgba(15,23,42,0.06)] p-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="min-w-[260px] flex-[1_1_420px]">
          <label className="block font-extrabold tracking-tight">Filter in this category</label>
          <input
            ref={inputRef}
            className="w-full border border-border bg-white/95 rounded-[14px] px-3.5 py-3 text-[15px] shadow-[inset_0_1px_0_rgba(15,23,42,0.05)] mt-2 focus-visible:outline-2 focus-visible:outline-accent/45 focus-visible:outline-offset-2 focus-visible:border-accent/35"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="keyword / tag / agent…"
            aria-label="Filter skills"
          />
        </div>
        <div className="flex gap-2.5 items-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1.5 font-mono text-xs text-muted bg-white/55">
            {results.length} / {skills.length}
          </div>
          {q.trim() ? (
            <button
              className="inline-flex items-center justify-center gap-2.5 px-3 py-2.5 rounded-[12px] border border-border bg-white/92 font-semibold shadow-[0_1px_0_rgba(15,23,42,0.05)] transition-all duration-150 hover:-translate-y-px hover:border-black/28 hover:shadow-sm text-[13px]"
              onClick={() => setQ("")}
              type="button"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3.5 mt-3.5">
        {results.map((s) => (
          <SkillCard key={s.id} skill={s} />
        ))}
      </div>
    </section>
  );
}
