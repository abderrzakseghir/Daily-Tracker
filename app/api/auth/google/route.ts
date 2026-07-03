import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const appUrl = req.nextUrl.origin;

  if (!clientId) {
    return NextResponse.json(
      { error: 'GOOGLE_CLIENT_ID not configured' },
      { status: 500 }
    );
  }

  const state = crypto.randomBytes(16).toString('hex');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'select_account',
  });

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  );

  response.cookies.set('google_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 300,
    path: '/',
  });

  return response;
}
