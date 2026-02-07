"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, Suspense } from "react";
import Link from "next/link";

import { useI18n } from "@/components/I18nProvider";
import { getLocalePath } from "@/lib/i18n";

type ReviewItem = {
  sourcePath: string;
  id: string;
  title: string;
  description: string;
  targetCategory: string;
  tags: string[];
  isUpdate?: boolean;
};

type ReviewData = {
  sourceRepo: string;
  ref: string;
  items: ReviewItem[];
};

function parseReviewData(encoded: string | null): ReviewData | null {
  if (!encoded) return null;
  try {
    const decoded = decodeURIComponent(atob(encoded));
    return JSON.parse(decoded) as ReviewData;
  } catch {
    return null;
  }
}

function ReviewContent() {
  const { t, locale } = useI18n();
  const searchParams = useSearchParams();
  const dataParam = searchParams.get("data");

  const reviewData = useMemo(() => parseReviewData(dataParam), [dataParam]);

  if (!reviewData) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center">
          <div className="bg-background-secondary w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground mb-2">{t("review.noDataTitle")}</h1>
          <p className="text-secondary mb-6">
            {t("review.noDataDescription")}
          </p>
          <Link
            href={getLocalePath("/import", locale)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover transition-colors"
          >
            {t("review.goToImport")}
          </Link>
        </div>
      </div>
    );
  }

  // Extract repo info
  let repoSlug = reviewData.sourceRepo;
  if (repoSlug.startsWith("https://github.com/")) repoSlug = repoSlug.slice("https://github.com/".length);
  else if (repoSlug.startsWith("http://github.com/")) repoSlug = repoSlug.slice("http://github.com/".length);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <section className="p-6 bg-card border border-border rounded-xl">
        <div className="flex items-start gap-4">
          <div className="bg-accent-muted w-12 h-12 rounded-xl flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12l2 2 4-4" />
              <circle cx="12" cy="12" r="10" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-2xl font-bold text-foreground">{t("review.title")}</h1>
            <p className="text-secondary mt-1">
              {t("review.subtitle")}
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-background-secondary rounded-lg">
            <div className="text-xs font-medium text-muted mb-1">{t("review.sourceRepository")}</div>
            <a
              href={reviewData.sourceRepo}
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline font-mono text-sm break-all"
            >
              {repoSlug}
            </a>
          </div>
          <div className="p-4 bg-background-secondary rounded-lg">
            <div className="text-xs font-medium text-muted mb-1">{t("review.branchRef")}</div>
            <code className="text-foreground font-mono text-sm">{reviewData.ref}</code>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-lg text-sm font-mono text-accent bg-accent-muted">
            {t("review.skillsCount", {
              count: reviewData.items.length,
              s: reviewData.items.length === 1 ? "" : "s",
            })}
          </span>
        </div>
      </section>

      {/* Skills List */}
      <section className="space-y-4">
        <h2 className="font-heading text-xl font-semibold text-foreground">{t("review.skillsToImport")}</h2>

        {reviewData.items.map((item, idx) => (
          <div key={item.id} className="p-5 bg-card border border-border rounded-xl">
            <div className="flex items-start gap-4">
              <div className="bg-background-secondary w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-lg font-bold text-muted">
                {idx + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-lg text-foreground">{item.title}</h3>
                  <span className="px-2 py-0.5 rounded text-xs font-mono text-muted bg-background-secondary border border-border">
                    {item.id}
                  </span>
                  {item.isUpdate && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
                      {t("review.updateBadge")}
                    </span>
                  )}
                </div>

                {item.description && (
                  <p className="text-secondary mt-2">{item.description}</p>
                )}

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Source Path */}
                  <div className="p-3 bg-background-secondary rounded-lg">
                    <div className="text-xs font-medium text-muted mb-1">{t("review.sourcePath")}</div>
                    <code className="text-foreground font-mono text-sm break-all">{item.sourcePath}</code>
                  </div>

                  {/* Target Location */}
                  <div className="p-3 bg-background-secondary rounded-lg">
                    <div className="text-xs font-medium text-muted mb-1">{t("review.targetLocation")}</div>
                    <code className="text-accent font-mono text-sm">
                      {item.targetCategory}
                    </code>
                  </div>
                </div>

                {/* Tags */}
                {item.tags.length > 0 && (
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-muted">{t("review.tagsLabel")}</span>
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-full text-xs bg-accent-muted text-accent"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* View on GitHub */}
                <div className="mt-4 pt-3 border-t border-border">
                  <a
                    href={`${reviewData.sourceRepo}/tree/${reviewData.ref}/${item.sourcePath}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                    </svg>
                    {t("review.viewSourceOnGitHub")}
                  </a>
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Back to Import */}
      <div className="pt-4">
        <Link
          href={getLocalePath("/import", locale)}
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          {t("review.backToImport")}
        </Link>
      </div>
    </div>
  );
}

export default function ReviewPage() {
  const { t, locale } = useI18n();
  return (
    <Suspense fallback={
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto" />
        <p className="text-muted mt-4">{t("review.loading")}</p>
      </div>
    }>
      <ReviewContent />
    </Suspense>
  );
}
