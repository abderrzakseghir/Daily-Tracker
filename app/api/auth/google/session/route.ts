import { NextRequest, NextResponse } from 'next/server';

/**
 * One-time claim endpoint: returns the Google user info from the session cookie
 * and immediately deletes it. Called once by the login page after OAuth redirect.
 */
export async function GET(req: NextRequest) {
  const cookie = req.cookies.get('google_session');

  if (!cookie?.value) {
    return NextResponse.json({ error: 'No pending Google session' }, { status: 404 });
  }

  try {
    const userInfo = JSON.parse(cookie.value);
    const response = NextResponse.json({ userInfo });
    response.cookies.delete('google_session');
    return response;
  } catch {
    return NextResponse.json({ error: 'Invalid session data' }, { status: 400 });
  }
}
