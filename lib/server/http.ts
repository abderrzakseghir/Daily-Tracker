import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySession } from './session';
import type { ApiResponse } from '@/types';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiResponse<T>>({ success: true, data }, init);
}

export function fail(status: number, error: string) {
  return NextResponse.json<ApiResponse>({ success: false, error }, { status });
}

/** Retourne l'id utilisateur de la session ou lève 401. */
export async function requireUserId(req: NextRequest): Promise<string> {
  const uid = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid) throw new HttpError(401, 'Session expirée, reconnectez-vous.');
  return uid;
}

type Handler<C> = (req: NextRequest, ctx: C & { userId: string }) => Promise<Response>;

/** Enveloppe une route : auth + gestion d'erreurs uniforme { success, error }. */
export function withUser<C = { params: Record<string, string> }>(handler: Handler<C>) {
  return async (req: NextRequest, ctx: C) => {
    try {
      const userId = await requireUserId(req);
      return await handler(req, { ...ctx, userId });
    } catch (err) {
      if (err instanceof HttpError) return fail(err.status, err.message);
      console.error(`[API] ${req.method} ${req.nextUrl.pathname}`, err);
      return fail(500, err instanceof Error ? err.message : 'Erreur serveur');
    }
  };
}

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function assertDate(value: unknown, field = 'date'): string {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) {
    throw new HttpError(400, `${field} invalide (format attendu AAAA-MM-JJ)`);
  }
  return value;
}
