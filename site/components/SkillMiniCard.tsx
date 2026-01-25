import Link from "next/link";

import type { RegistrySkill } from "@/lib/types";

export function SkillMiniCard({ skill }: { skill: RegistrySkill }) {
  return (
    <Link href={`/s/${skill.id}`} className="card interactive miniCard">
      <div className="miniTop">
        <h3 className="miniTitle">{skill.title}</h3>
        <span className="chip">
          {skill.category}/{skill.subcategory}
        </span>
      </div>
      <p className="muted miniDesc">{skill.description}</p>
    </Link>
  );
}

