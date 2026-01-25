"use client";

import { useMemo, useState } from "react";

import type { RegistrySkill } from "@/lib/types";

import { SkillCard } from "@/components/SkillCard";

export function CategoryFilterClient({ skills }: { skills: RegistrySkill[] }) {
  const [q, setQ] = useState("");

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
    <section className="card" style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 260, flex: "1 1 420px" }}>
          <label style={{ display: "block", fontWeight: 700, letterSpacing: "-0.01em" }}>Filter in this category</label>
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="keyword / tag / agent…"
            aria-label="Filter skills"
            style={{ marginTop: 8 }}
          />
        </div>
        <div className="chip">
          {results.length} / {skills.length}
        </div>
      </div>

      <div className="grid cards" style={{ marginTop: 14 }}>
        {results.map((s) => (
          <SkillCard key={s.id} skill={s} />
        ))}
      </div>
    </section>
  );
}
