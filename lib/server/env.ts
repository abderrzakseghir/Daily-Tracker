import type { NextRequest } from 'next/server';

/**
 * URL publique canonique de l'application.
 *
 * C'est elle qui sert à construire les redirect_uri OAuth : Google et Atlassian
 * exigent une correspondance EXACTE avec l'URI déclarée dans leur console.
 * Utiliser l'origine de la requête provoquait `redirect_uri_mismatch` dès que
 * l'app était ouverte via une URL de déploiement Vercel différente
 * (preview, alias *.vercel.app, domaine perso…).
 *
 * Priorité : APP_URL > domaine de production Vercel > origine de la requête (dev).
 */
export function getAppUrl(req?: NextRequest): string {
  const explicit = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/+$/, '');

  const prodHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (process.env.VERCEL_ENV === 'production' && prodHost) return `https://${prodHost}`;

  if (req) {
    const proto = req.headers.get('x-forwarded-proto')?.split(',')[0].trim() || req.nextUrl.protocol.replace(':', '');
    return `${proto}://${requestHost(req)}`;
  }
  return 'http://localhost:3000';
}

/** Hôte public réellement utilisé par le navigateur (derrière le proxy Vercel). */
export function requestHost(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-host')?.split(',')[0].trim() ||
    req.headers.get('host') ||
    req.nextUrl.host
  );
}

/** true si la requête n'arrive pas par l'URL canonique (preview, alias…). */
export function isNonCanonicalHost(req: NextRequest): boolean {
  return new URL(getAppUrl(req)).host !== requestHost(req);
}

export function googleRedirectUri(req?: NextRequest): string {
  return `${getAppUrl(req)}/api/auth/google/callback`;
}

export function jiraRedirectUri(req?: NextRequest): string {
  return `${getAppUrl(req)}/api/auth/jira/callback`;
}

export const isProd = process.env.NODE_ENV === 'production';

/** Liste blanche d'e-mails (optionnelle) — ALLOWED_EMAILS="a@x.com,b@y.com". */
export function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const MAX_USERS = Number(process.env.MAX_USERS ?? 10);
