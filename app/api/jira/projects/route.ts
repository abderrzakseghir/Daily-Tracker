import { HttpError, ok, withUser } from '@/lib/server/http';
import { jiraErrorMessage, listProjects } from '@/lib/server/jira';

export const dynamic = 'force-dynamic';

export const GET = withUser(async (_req, { userId }) => {
  try {
    return ok(await listProjects(userId));
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(502, jiraErrorMessage(err));
  }
});
