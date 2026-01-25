import Link from "next/link";

import type { RegistrySkill } from "@/lib/types";

export function SkillCard({ skill }: { skill: RegistrySkill }) {
  return (
    <Link
      href={`/s/${skill.id}`}
      className="block p-4 bg-surface border border-black/12 rounded-[16px] shadow-[0_1px_0_rgba(15,23,42,0.06)] transition-all duration-150 cursor-pointer hover:-translate-y-0.5 hover:border-accent/26 hover:shadow-md focus-visible:outline-2 focus-visible:outline-accent/50 focus-visible:outline-offset-2"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <h3 className="m-0 text-lg tracking-tight">{skill.title}</h3>
        <span className="inline-flex items-center gap-2 rounded-full border border-accent/28 px-2.5 py-1.5 font-mono text-xs text-accent/96 bg-accent/9">
          {skill.category}/{skill.subcategory}
        </span>
      </div>

      <p className="text-muted mt-2.5 leading-relaxed">{skill.description}</p>

      <div className="flex gap-2 flex-wrap mt-3">
        {(skill.tags ?? []).slice(0, 6).map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1.5 font-mono text-xs text-muted bg-white/55"
          >
            #{t}
          </span>
        ))}
        {(skill.agents ?? []).slice(0, 3).map((a) => (
          <span
            key={a}
            className="inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1.5 font-mono text-xs text-muted bg-white/55"
          >
            {a}
          </span>
        ))}
      </div>
    </Link>
  );
}
