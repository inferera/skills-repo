import Link from "next/link";

export default function NotFound() {
  return (
    <section className="card" style={{ padding: 18 }}>
      <h1 style={{ margin: 0, fontSize: 28 }}>Not found</h1>
      <p className="muted" style={{ margin: "10px 0 0", lineHeight: 1.6 }}>
        The page you are looking for does not exist.
      </p>
      <div style={{ marginTop: 14 }}>
        <Link className="btn primary" href="/">
          Back home
        </Link>
      </div>
    </section>
  );
}

