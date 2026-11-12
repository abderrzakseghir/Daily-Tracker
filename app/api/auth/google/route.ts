import { NextRequest, NextResponse } from 'next/server';
import { getAppUrl, isNonCanonicalHost, googleRedirectUri, isProd } from '@/lib/server/env';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const appUrl = getAppUrl(req);

  if (!clientId) {
    return NextResponse.redirect(`${appUrl}/?error=google_not_configured`);
  }

  // Le cookie `state` doit être posé sur le même domaine que le callback :
  // si l'utilisateur arrive par une autre URL (preview Vercel…), on le renvoie
  // d'abord sur l'URL canonique.
  if (isNonCanonicalHost(req)) {
    return NextResponse.redirect(`${appUrl}/api/auth/google`);
  }

  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(req),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
  );
  response.cookies.set('google_oauth_state', state, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return response;
}
