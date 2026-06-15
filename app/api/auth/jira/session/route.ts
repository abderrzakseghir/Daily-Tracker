import { NextRequest, NextResponse } from 'next/server';

/**
 * One-time claim endpoint: returns the Jira connection data from the cookie
 * and immediately deletes it. Called once by the Settings page after redirect.
 */
export async function GET(req: NextRequest) {
  const cookie = req.cookies.get('jira_connection');

  if (!cookie?.value) {
    return NextResponse.json({ error: 'No pending Jira connection' }, { status: 404 });
  }

  try {
    const connection = JSON.parse(cookie.value);
    const response = NextResponse.json({ connection });
    response.cookies.delete('jira_connection');
    return response;
  } catch {
    return NextResponse.json({ error: 'Invalid connection data' }, { status: 400 });
  }
}
