"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { REPO_URL, SITE_NAME } from "@/lib/config";
import { useI18n } from "@/components/I18nProvider";
import { getLocalePath } from "@/lib/i18n";
import { LanguageSelector } from "@/components/LanguageSelector";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  const { t, locale } = useI18n();
  const headerRef = useRef<HTMLElement | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const update = () => {
      const h = el.getBoundingClientRect().height;
      document.documentElement.style.setProperty("--app-header-height", `${Math.round(h)}px`);
    };

    update();

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  // Close mobile menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [mobileMenuOpen]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <>
      <header ref={headerRef} className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href={getLocalePath("/", locale)} className="flex items-center gap-2.5 group">
              <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-accent">
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="font-heading font-semibold text-lg tracking-tight text-foreground">{SITE_NAME}</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1 sm:gap-2">
              <Link
                href={getLocalePath("/categories", locale)}
                className="px-3 py-2 rounded-lg text-sm font-medium text-secondary hover:text-foreground hover:bg-card transition-colors"
              >
                {t("nav.categories")}
              </Link>
              <Link
                href={getLocalePath("/import", locale)}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-colors"
              >
                {t("nav.submit")}
              </Link>
              {REPO_URL && (
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-secondary hover:text-foreground hover:bg-card transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  <span>{t("nav.github")}</span>
                </a>
              )}
              <div className="ml-1 sm:ml-2">
                <LanguageSelector />
              </div>
              <div className="ml-1 sm:ml-2">
                <ThemeToggle />
              </div>
            </nav>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg text-foreground hover:bg-card transition-colors"
              aria-label={mobileMenuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
      )}

      {/* Mobile Menu Panel */}
      <div
        className={`
          fixed top-0 right-0 z-50 h-full w-72 max-w-[85vw]
          bg-background border-l border-border
          transform transition-transform duration-300 ease-in-out
          md:hidden
          ${mobileMenuOpen ? "translate-x-0" : "translate-x-full"}
        `}
        role="dialog"
        aria-modal="true"
        aria-label={t("nav.mobileMenu")}
      >
        {/* Mobile Menu Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-border">
          <span className="font-heading font-semibold text-foreground">{t("nav.menu")}</span>
          <button
            onClick={closeMobileMenu}
            className="flex items-center justify-center w-10 h-10 rounded-lg text-foreground hover:bg-card transition-colors"
            aria-label={t("nav.closeMenu")}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mobile Menu Content */}
        <div className="flex flex-col h-[calc(100%-4rem)] overflow-y-auto">
          {/* Navigation Links */}
          <nav className="flex flex-col p-4 gap-2">
            <Link
              href={getLocalePath("/categories", locale)}
              onClick={closeMobileMenu}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium text-foreground hover:bg-card transition-colors"
            >
              <svg className="w-5 h-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              {t("nav.categories")}
            </Link>
            <Link
              href={getLocalePath("/import", locale)}
              onClick={closeMobileMenu}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium bg-accent text-white hover:bg-accent-hover transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              {t("nav.submit")}
            </Link>
            {REPO_URL && (
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                onClick={closeMobileMenu}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium text-foreground hover:bg-card transition-colors"
              >
                <svg className="w-5 h-5 text-muted" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                {t("nav.github")}
              </a>
            )}
          </nav>

          {/* Divider */}
          <div className="mx-4 border-t border-border" />

          {/* Settings Section */}
          <div className="p-4 space-y-4">
            {/* Language Selection */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-muted px-1">
                {t("nav.language")}
              </label>
              <LanguageSelector />
            </div>

            {/* Theme Selection */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-muted px-1">
                {t("nav.theme")}
              </label>
              <ThemeToggle variant="expanded" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
