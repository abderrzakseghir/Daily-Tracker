import { NextRequest, NextResponse } from 'next/server';
import { allowedEmails, getAppUrl, googleRedirectUri, isProd, MAX_USERS } from '@/lib/server/env';
import { SESSION_COOKIE, sessionCookieOptions, signSession } from '@/lib/server/session';
import { db } from '@/lib/server/supabase';
import { DEFAULT_SETTINGS } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const appUrl = getAppUrl(req);
  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const storedState = req.cookies.get('google_oauth_state')?.value;

  const fail = (reason: string) => {
    const res = NextResponse.redirect(`${appUrl}/?error=${reason}`);
    res.cookies.delete('google_oauth_state');
    return res;
  };

  if (searchParams.get('error')) return fail('google_denied');
  if (!code || !state || state !== storedState) return fail('invalid_state');

  try {
    // ① Échange du code
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code,
        redirect_uri: googleRedirectUri(req),
      }),
    });
    if (!tokenRes.ok) {
      console.error('[Google OAuth] token exchange', tokenRes.status, await tokenRes.text());
      return fail('token_exchange');
    }
    const tokens = await tokenRes.json();

    // ② Profil
    const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      cache: 'no-store', // l'identité ne doit jamais venir d'un cache
    });
    if (!profileRes.ok) return fail('profile');
    const profile = (await profileRes.json()) as {
      sub: string;
      email: string;
      email_verified: boolean;
      name?: string;
      picture?: string;
    };
    if (!profile.email_verified) return fail('email_not_verified');
    const email = profile.email.toLowerCase();

    // ③ Utilisateur existant ?
    const { data: existing, error: findError } = await db()
      .from('users')
      .select('id')
      .eq('google_id', profile.sub)
      .maybeSingle();
    if (findError) throw findError;

    let userId = existing?.id as string | undefined;
    const now = new Date().toISOString();

    if (userId) {
      await db()
        .from('users')
        .update({
          email,
          name: profile.name ?? email,
          avatar: profile.picture ?? null,
          last_login_at: now,
          updated_at: now,
        })
        .eq('id', userId);
    } else {
      // ④ Nouveau compte : liste blanche + limite d'utilisateurs
      const allowlist = allowedEmails();
      if (allowlist.length > 0 && !allowlist.includes(email)) return fail('not_allowed');
      const { count } = await db().from('users').select('id', { count: 'exact', head: true });
      if ((count ?? 0) >= MAX_USERS) return fail('max_users');

      const { data: created, error } = await db()
        .from('users')
        .insert({
          google_id: profile.sub,
          email,
          name: profile.name ?? email,
          avatar: profile.picture ?? null,
          settings: DEFAULT_SETTINGS,
          last_login_at: now,
        })
        .select('id')
        .single();
      if (error) throw error;
      userId = created.id as string;
    }

    // ⑤ Session
    const res = NextResponse.redirect(`${appUrl}/dashboard`);
    res.cookies.delete('google_oauth_state');
    res.cookies.set(SESSION_COOKIE, await signSession(userId!), sessionCookieOptions(isProd));
    return res;
  } catch (err) {
    console.error('[Google OAuth] callback', err);
    return fail('server');
  }
}
