import Link from "next/link";

import type { RegistrySkill } from "@/lib/types";

export function SkillMiniCard({ skill }: { skill: RegistrySkill }) {
  return (
    <Link
      href={`/s/${skill.id}`}
      className="block px-3.5 py-3 bg-surface border border-black/12 rounded-[16px] shadow-[0_1px_0_rgba(15,23,42,0.06)] transition-all duration-150 cursor-pointer hover:-translate-y-0.5 hover:border-accent/26 hover:shadow-md focus-visible:outline-2 focus-visible:outline-accent/50 focus-visible:outline-offset-2"
    >
      <div className="flex items-baseline justify-between gap-2.5 flex-wrap">
        <h3 className="m-0 text-sm tracking-tight">{skill.title}</h3>
        <span className="inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1.5 font-mono text-xs text-muted bg-white/55">
          {skill.category}/{skill.subcategory}
        </span>
      </div>
      <p className="text-muted mt-1.5 text-[13px] leading-normal">{skill.description}</p>
    </Link>
  );
}
