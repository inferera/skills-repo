import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { LOCALE_OPTIONS } from './lib/i18n';

const SUPPORTED_LOCALES: Set<string> = new Set(LOCALE_OPTIONS.map(o => o.locale));

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Skip middleware for API routes, static files, and Next.js internals
  if (
    path.startsWith('/api') ||
    path.startsWith('/_next') ||
    path.startsWith('/favicon.ico') ||
    path.includes('.')
  ) {
    return NextResponse.next();
  }

  // Check if the first path segment looks like a locale but isn't supported
  // Matches patterns like: xx, xxx, xx-XX, xx-XXX (e.g., it, fil, pt-BR, zh-Hant)
  const match = path.match(/^\/([^/]+)(\/.*)?$/);
  if (match) {
    const firstSegment = match[1];
    const rest = match[2] || '/';
    if (
      /^[a-z]{2,3}(-[a-zA-Z]{2,4})?$/i.test(firstSegment) &&
      !SUPPORTED_LOCALES.has(firstSegment)
    ) {
      const newUrl = new URL(`/en${rest}`, request.url);
      return NextResponse.redirect(newUrl, 302);
    }
  }

  // Old unprefixed URLs that should redirect to /en/ versions
  const oldPaths = [
    '/categories',
    '/import',
  ];

  // Check exact matches
  for (const oldPath of oldPaths) {
    if (path === oldPath || path === `${oldPath}/`) {
      const newUrl = new URL(`/en${path}`, request.url);
      return NextResponse.redirect(newUrl, 301); // Permanent redirect
    }
  }

  // Check dynamic routes: /s/* and /c/*
  if (path.startsWith('/s/') || path.startsWith('/c/')) {
    const newUrl = new URL(`/en${path}`, request.url);
    return NextResponse.redirect(newUrl, 301); // Permanent redirect
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files with extensions
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
