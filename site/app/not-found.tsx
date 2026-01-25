import Link from "next/link";

export default function NotFound() {
  return (
    <section className="bg-surface border border-black/12 rounded-[16px] shadow-[0_1px_0_rgba(15,23,42,0.06)] p-[18px]">
      <h1 className="m-0 text-[28px] tracking-tight">Not found</h1>
      <p className="text-muted mt-2.5 leading-relaxed">
        The page you are looking for does not exist.
      </p>
      <div className="mt-3.5">
        <Link
          className="inline-flex items-center justify-center gap-2.5 px-3.5 py-2.5 rounded-[12px] border border-accent/95 bg-gradient-to-b from-accent to-accent-ink text-white/98 font-semibold shadow-primary transition-all duration-150 hover:-translate-y-px hover:from-accent-ink hover:to-accent-ink"
          href="/"
        >
          Back home
        </Link>
      </div>
    </section>
  );
}
