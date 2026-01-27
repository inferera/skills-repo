import Link from "next/link";

import { T } from "@/components/T";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
      <div className="w-16 h-16 rounded-full bg-accent-muted flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 8v4M12 16h.01"/>
        </svg>
      </div>
      <h1 className="font-heading text-3xl font-bold text-foreground mb-2">
        <T k="notFound.title" />
      </h1>
      <p className="text-secondary mb-6 max-w-md">
        <T k="notFound.description" />
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover transition-colors"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        <T k="notFound.backHome" />
      </Link>
    </div>
  );
}
