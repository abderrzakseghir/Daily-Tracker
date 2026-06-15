import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side proxy: fetches Jira tickets assigned to the current user.
 * Receives the access token and cloud ID in the request body (POST),
 * so they never appear in URLs or server logs.
 */
export async function POST(req: NextRequest) {
  try {
    const { accessToken, cloudId, accountId, cloudUrl } = await req.json();

    if (!accessToken || !cloudId || !accountId) {
      return NextResponse.json({ error: 'Missing accessToken, cloudId or accountId' }, { status: 400 });
    }

    // Use accountId directly — currentUser() doesn't work with OAuth 2.0 (3LO)
    const jql = encodeURIComponent(
      `assignee = "${accountId}" ORDER BY updated DESC`
    );
    const fields = 'summary,status,priority,project,customfield_10020,updated';

    const res = await fetch(
      `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search?jql=${jql}&maxResults=100&fields=${fields}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (res.status === 401) {
      return NextResponse.json({ error: 'token_expired' }, { status: 401 });
    }

    if (!res.ok) {
      return NextResponse.json({ error: `Jira API error: ${res.status}` }, { status: 502 });
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
