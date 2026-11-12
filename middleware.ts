import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/server/session';

const PUBLIC_PATHS = ['/', '/offline'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get('x-forwarded-host')?.split(',')[0].trim() || req.headers.get('host');

  // En production, tout passe par le domaine canonique pour que les cookies
  // de session et les redirect_uri OAuth restent cohérents.
  const canonical = process.env.APP_URL;
  if (process.env.VERCEL_ENV === 'production' && canonical) {
    const target = new URL(canonical);
    if (target.host !== host) {
      const url = new URL(req.nextUrl.pathname + req.nextUrl.search, target);
      return NextResponse.redirect(url, 308);
    }
  }

  if (pathname.startsWith('/api/')) return NextResponse.next();

  const uid = await verifySession(req.cookies.get(SESSION_COOKIE)?.value).catch(() => null);

  if (PUBLIC_PATHS.includes(pathname)) {
    if (pathname === '/' && uid) return NextResponse.redirect(new URL('/dashboard', req.url));
    return NextResponse.next();
  }

  if (!uid) {
    const url = new URL('/', req.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|.*\\.(?:svg|png|ico|webmanifest)$).*)'],
};
