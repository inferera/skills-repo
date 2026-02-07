import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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
