import { HttpError, ok, withUser } from '@/lib/server/http';
import { jiraErrorMessage, searchIssues } from '@/lib/server/jira';

export const dynamic = 'force-dynamic';

/**
 * GET /api/jira/issues?q=texte|CLE-12&scope=mine|all&open=1
 * Recherche de tickets pour lier / importer.
 */
export const GET = withUser(async (req, { userId }) => {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  const scope = req.nextUrl.searchParams.get('scope') ?? 'mine';
  const openOnly = req.nextUrl.searchParams.get('open') !== '0';

  const clauses: string[] = [];
  if (scope === 'mine') clauses.push('assignee = currentUser()');
  if (openOnly) clauses.push('statusCategory != Done');
  if (q) {
    const safe = q.replace(/["\\]/g, '');
    if (/^[A-Z][A-Z0-9_]+-\d+$/i.test(safe)) clauses.push(`key = "${safe.toUpperCase()}"`);
    else clauses.push(`text ~ "${safe}*"`);
  }
  if (clauses.length === 0) clauses.push('updated >= -30d');
  const jql = `${clauses.join(' AND ')} ORDER BY updated DESC`;

  try {
    return ok(await searchIssues(userId, jql, 50));
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(502, jiraErrorMessage(err));
  }
});
