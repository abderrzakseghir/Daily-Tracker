import { NextRequest, NextResponse } from 'next/server';

interface WorklogEntry {
  key: string;
  durationMinutes: number;
  /**
   * ISO 8601 string with timezone offset built on the CLIENT SIDE
   * (browser) so it reflects the user's actual local timezone.
   * Example: "2026-06-15T09:00:00.000+0200"
   * If omitted, Jira defaults to the current time — which is almost certainly wrong.
   */
  started?: string;
}

/**
 * POST /api/jira/worklog
 *
 * Proxy that posts a worklog entry for each ticket to the Jira Cloud API.
 * Body: { accessToken: string; cloudId: string; tickets: WorklogEntry[] }
 *
 * Uses Promise.allSettled so a single failure does not cancel the others.
 * Returns 200 when all worklogs succeeded, 207 when some failed, 400/500 on
 * missing params or server errors.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accessToken, cloudId, tickets } = body as {
      accessToken?: string;
      cloudId?: string;
      tickets?: WorklogEntry[];
    };

    if (!accessToken || !cloudId) {
      return NextResponse.json(
        { error: 'Missing accessToken or cloudId' },
        { status: 400 },
      );
    }

    if (!Array.isArray(tickets) || tickets.length === 0) {
      return NextResponse.json({ synced: 0 });
    }

    // Post all worklogs in parallel; collect results without short-circuiting.
    // Validation is done per-ticket inside the map so a single bad entry
    // doesn't abort the whole batch (was previously an early-exit loop).
    const results = await Promise.allSettled(
      tickets.map(async (ticket) => {
        // Per-ticket validation — reject this ticket only, not the whole batch.
        if (!ticket.key || typeof ticket.durationMinutes !== 'number' || ticket.durationMinutes <= 0) {
          throw new Error(`Entrée invalide : key="${ticket.key}" durationMinutes=${ticket.durationMinutes}`);
        }

        const url = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${encodeURIComponent(ticket.key)}/worklog`;

        // Debug log — always fires, even if the fetch fails.
        console.log(
          `[Jira worklog] ▶ ${ticket.key} | started=${ticket.started ?? '(non défini)'} | ${ticket.durationMinutes} min = ${ticket.durationMinutes * 60} s`,
        );

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            timeSpentSeconds: ticket.durationMinutes * 60,
            // Without `started`, Jira logs to "now" instead of the scheduled date.
            ...(ticket.started ? { started: ticket.started } : {}),
          }),
        });

        if (!res.ok) {
          const detail = await res.text();
          console.error(`[Jira worklog] ✗ ${ticket.key} – HTTP ${res.status}:`, detail);
          if (res.status === 401 || res.status === 403) {
            throw new Error(`token_expired (HTTP ${res.status}): ${detail}`);
          }
          throw new Error(`Jira API error ${res.status}: ${detail}`);
        }

        console.log(`[Jira worklog] ✓ ${ticket.key} enregistré.`);
        return ticket.key;
      }),
    );

    const failed = results
      .map((r, i) =>
        r.status === 'rejected'
          ? { key: tickets[i].key, reason: (r.reason as Error).message }
          : null,
      )
      .filter(Boolean);

    const synced = results.filter((r) => r.status === 'fulfilled').length;

    console.log(
      `[Jira worklog] Résumé : ${synced}/${tickets.length} ticket(s) envoyés avec succès, ${failed.length} échec(s).`,
    );

    if (failed.length > 0) {
      console.error('[Jira worklog] Détails des échecs :', failed);
      // 207 Multi-Status: some succeeded, some failed
      return NextResponse.json(
        {
          synced,
          failed: failed.length,
          details: failed,
          error: `${failed.length} worklog(s) n'ont pas pu être envoyés sur Jira.`,
        },
        { status: 207 },
      );
    }

    return NextResponse.json({ synced });
  } catch (err) {
    console.error('[Jira worklog]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
