import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const appUrl = req.nextUrl.origin;

  const storedState = req.cookies.get('google_oauth_state')?.value;

  if (!code || !state || state !== storedState) {
    const response = NextResponse.redirect(`${appUrl}/?google=error&reason=invalid_state`);
    response.cookies.delete('google_oauth_state');
    return response;
  }

  try {
    // Exchange authorization code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code,
        redirect_uri: `${appUrl}/api/auth/google/callback`,
      }),
    });

    if (!tokenRes.ok) {
      throw new Error(`Token exchange failed: ${tokenRes.status}`);
    }

    const tokens = await tokenRes.json();

    // Fetch Google user profile
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoRes.ok) {
      throw new Error(`User info fetch failed: ${userInfoRes.status}`);
    }

    const googleUser = await userInfoRes.json();

    const userInfo = {
      googleId: googleUser.id as string,
      email: googleUser.email as string,
      name: googleUser.name as string,
      avatar: googleUser.picture as string | undefined,
    };

    const response = NextResponse.redirect(`${appUrl}/`);
    response.cookies.delete('google_oauth_state');
    response.cookies.set('google_session', JSON.stringify(userInfo), {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 300,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('[Google OAuth] Callback error:', error);
    const response = NextResponse.redirect(`${appUrl}/?google=error&reason=auth_failed`);
    response.cookies.delete('google_oauth_state');
    return response;
  }
}
