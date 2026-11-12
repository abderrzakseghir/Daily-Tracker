import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/**
 * Client Supabase côté serveur (clé service_role).
 * Ne JAMAIS importer depuis un composant client.
 */
export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Supabase non configuré : définissez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.',
    );
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Next.js 14 met en cache les fetch() serveur (Data Cache) : sans `no-store`,
    // les lectures Supabase restaient figées et une tâche créée « disparaissait ».
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });
  return client;
}
