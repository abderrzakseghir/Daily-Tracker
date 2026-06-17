import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side proxy: fetches Jira tickets assigned to the current user.
 * Receives the access token and cloud ID in the request body (POST),
 * so they never appear in URLs or server logs.
 */
export async function POST(req: NextRequest) {
  try {
    const { accessToken, cloudId, accountId, cloudUrl } = await req.json();

    if (!accessToken || !cloudId) {
      return NextResponse.json({ error: 'Missing accessToken or cloudId' }, { status: 400 });
    }

    // Debug: log the cloudId we received to verify it's a Jira cloud ID
    console.log('[Jira tickets] Received cloudId:', cloudId, '| accountId:', accountId ?? '(none)');

    // Migrated from deprecated GET /rest/api/3/search to POST /rest/api/3/search/jql
    // See: https://developer.atlassian.com/changelog/#CHANGE-2046
    const jiraUrl = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search/jql`;
    console.log('[Jira tickets] POST', jiraUrl);

    const res = await fetch(jiraUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        jql: 'assignee = currentUser() ORDER BY updated DESC',
        maxResults: 100,
        fields: ['summary', 'status', 'priority', 'project', 'customfield_10020', 'updated'],
      }),
    });

    if (res.status === 401) {
      return NextResponse.json({ error: 'token_expired' }, { status: 401 });
    }

    if (!res.ok) {
      const errBody = await res.text();
      console.error('[Jira tickets] API error', res.status, errBody);
      return NextResponse.json({ error: `Jira API error: ${res.status}`, detail: errBody }, { status: 502 });
    }

    const data = await res.json();

    const jiraBase = cloudUrl || 'https://afludia.atlassian.net';

    const tickets = (data.issues ?? []).map((issue: any) => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status?.name ?? '',
      priority: issue.fields.priority?.name ?? 'None',
      project: issue.fields.project?.name ?? '',
      projectKey: issue.fields.project?.key ?? '',
      sprint: issue.fields.customfield_10020?.[0]?.name,
      updatedAt: issue.fields.updated,
      url: `${jiraBase}/browse/${issue.key}`,
    }));

    return NextResponse.json({ tickets });
  } catch (err) {
    console.error('[Jira tickets]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
