import type { ApiResponse } from '@/types';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Appel API typé : déballe { success, data, error } et lève ApiError sinon. */
export async function api<T>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...rest.headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError(0, 'Connexion impossible — vérifiez votre réseau.');
  }

  let body: ApiResponse<T> | null = null;
  try {
    body = await res.json();
  } catch {
    /* réponse vide */
  }

  if (res.status === 401 && typeof window !== 'undefined' && !url.startsWith('/api/auth')) {
    // On efface d'abord le cookie, sinon le middleware renverrait vers /dashboard (boucle)
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/?error=session';
  }
  if (!res.ok || !body?.success) {
    throw new ApiError(res.status, body?.error ?? `Erreur ${res.status}`);
  }
  return body.data as T;
}

export const fetcher = <T>(url: string) => api<T>(url);
