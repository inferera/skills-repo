import Link from "next/link";

import type { RegistrySkill } from "@/lib/types";

export function SkillCard({ skill }: { skill: RegistrySkill }) {
  return (
    <Link
      href={`/s/${skill.id}`}
      className="card"
      style={{
        gridColumn: "span 12",
        padding: 16,
        display: "block"
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, fontSize: 18, letterSpacing: "-0.01em" }}>{skill.title}</h3>
            <span className="chip">
              {skill.category}/{skill.subcategory}
            </span>
          </div>
          <p className="muted" style={{ margin: "8px 0 0", lineHeight: 1.5 }}>
            {skill.description}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        {(skill.tags ?? []).slice(0, 6).map((t) => (
          <span key={t} className="chip">
            #{t}
          </span>
        ))}
        {(skill.agents ?? []).slice(0, 3).map((a) => (
          <span key={a} className="chip">
            {a}
          </span>
        ))}
      </div>
    </Link>
  );
}

