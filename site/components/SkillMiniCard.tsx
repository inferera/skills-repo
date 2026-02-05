import Link from "next/link";

import type { RegistrySkill } from "@/lib/types";
import type { Locale } from "@/lib/i18n";
import { getLocalizedText, getLocalePath } from "@/lib/i18n";

export function SkillMiniCard({ skill, locale }: { skill: RegistrySkill; locale: Locale }) {
  const repo = skill.repository;

  return (
    <Link
      href={getLocalePath(`/s/${skill.id}`, locale)}
      className="group flex items-center gap-3 p-3 bg-card border border-border rounded-lg transition-all duration-200 cursor-pointer hover:border-border-hover hover:bg-card-hover"
    >
      {repo?.avatar ? (
        <img
          src={repo.avatar}
          alt={repo.owner}
          className="w-8 h-8 rounded-md bg-background-secondary flex-shrink-0"
        />
      ) : (
        <div className="w-8 h-8 rounded-md bg-accent-muted flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h4 className="font-medium text-sm text-foreground truncate group-hover:text-accent transition-colors">
          {skill.title}
        </h4>
        <p className="text-xs text-muted truncate">{getLocalizedText(skill.description, locale)}</p>
      </div>
      <svg className="w-4 h-4 text-muted group-hover:text-accent flex-shrink-0 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 18l6-6-6-6"/>
      </svg>
    </Link>
  );
}
