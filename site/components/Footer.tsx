import { REPO_URL } from "@/lib/config";

export function Footer() {
  return (
    <footer className="pb-9 text-text/62">
      <div className="max-w-[1120px] mx-auto px-5 flex items-center justify-between gap-3 flex-wrap">
        <span className="text-[13px]">Built from repo metadata. Static. SEO-friendly. Forkable.</span>
        {REPO_URL ? (
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="text-[13px] underline">
            Contribute on GitHub
          </a>
        ) : null}
      </div>
    </footer>
  );
}
