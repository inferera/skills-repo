import Link from "next/link";

import type { RegistrySkill } from "@/lib/types";

function formatStars(stars: number): string {
  if (stars >= 1000) {
    return `${(stars / 1000).toFixed(1)}k`;
  }
  return stars.toString();
}

export function SkillCard({ skill }: { skill: RegistrySkill }) {
  const repo = skill.repository;

  return (
    <Link
      href={`/s/${skill.id}`}
      className="group block p-4 bg-card border border-border rounded-xl transition-all duration-200 cursor-pointer hover:border-border-hover hover:bg-card-hover"
    >
      {/* Header with avatar and category */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {repo?.avatar ? (
            <img
              src={repo.avatar}
              alt={repo.owner}
              className="w-10 h-10 rounded-lg bg-background-secondary flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
          )}
          <div className="min-w-0">
            <h3 className="font-heading font-semibold text-foreground truncate group-hover:text-accent transition-colors">
              {skill.title}
            </h3>
            {repo?.owner && (
              <p className="text-xs text-muted truncate">{repo.owner}</p>
            )}
          </div>
        </div>
        <span className="flex-shrink-0 px-2 py-1 rounded-md text-xs font-medium bg-accent-muted text-accent">
          {skill.category}
        </span>
      </div>

      {/* Description */}
      <p className="mt-3 text-sm text-secondary line-clamp-2 leading-relaxed">
        {skill.description}
      </p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {(skill.tags ?? []).slice(0, 4).map((t) => (
          <span
            key={t}
            className="px-2 py-0.5 rounded-md text-xs text-muted bg-background-secondary"
          >
            {t}
          </span>
        ))}
      </div>

      {/* Footer with stats */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border">
        {repo?.stars !== undefined && (
          <div className="flex items-center gap-1 text-muted">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 .587l3.668 7.568 8.332 1.151-6.064 5.828 1.48 8.279-7.416-3.967-7.417 3.967 1.481-8.279-6.064-5.828 8.332-1.151z"/>
            </svg>
            <span className="text-xs font-medium">{formatStars(repo.stars)}</span>
          </div>
        )}
        {(skill.agents ?? []).length > 0 && (
          <div className="flex items-center gap-1 text-muted">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            <span className="text-xs font-medium">{skill.agents![0]}</span>
          </div>
        )}
        <div className="ml-auto">
          <svg className="w-4 h-4 text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </div>
      </div>
    </Link>
  );
}
