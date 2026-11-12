/**
 * Session signée (HMAC-SHA256) stockée dans un cookie httpOnly.
 * Utilise Web Crypto pour fonctionner à la fois dans le middleware (Edge)
 * et dans les routes API (Node).
 */

export const SESSION_COOKIE = 'dt_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 jours

interface SessionPayload {
  uid: string;
  exp: number; // secondes epoch
}

const encoder = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(input: string): Uint8Array {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacKey(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET manquant ou trop court (32 caractères minimum).');
  }
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function signSession(uid: string): Promise<string> {
  const payload: SessionPayload = { uid, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE };
  const body = b64url(encoder.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(), encoder.encode(body));
  return `${body}.${b64url(new Uint8Array(sig))}`;
}

export async function verifySession(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(),
      fromB64url(sig) as BufferSource,
      encoder.encode(body),
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body))) as SessionPayload;
    if (!payload.uid || payload.exp < Date.now() / 1000) return null;
    return payload.uid;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE,
  };
}
