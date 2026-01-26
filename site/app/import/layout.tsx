import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Submit",
  description: "Submit skills from a public GitHub repository (creates a PR via an issue-triggered workflow).",
  robots: {
    index: false,
    follow: false
  }
};

export default function ImportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
