import { NextRequest, NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { adminSupabase } from '@/lib/supabase/admin'
import { getValidMetaToken } from '@/lib/platform/tokens'
import { META_GRAPH_VERSION } from '@/lib/platform/metaVersion'

// Owner-only diagnostic endpoint.
// Reports the live webhook subscription state for the connected Instagram
// (and Facebook Page) account by querying Meta's subscribed_apps edge.
// This tells us definitively whether the account is subscribed to receive
// webhook events, or whether Meta rejects the request (permission/access).
export async function GET(request: NextRequest) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  const report: Record<string, unknown> = {
    metaGraphVersion: META_GRAPH_VERSION,
    checkedAt: new Date().toISOString(),
  }

  // Load all Meta-family connections we care about.
  const { data: connections, error: connErr } = await adminSupabase
    .from('platform_connections')
    .select('id, platform, account_id, account_name, account_username, expires_at')
    .in('platform', ['instagram', 'facebook'])

  if (connErr) {
    report.connectionsError = connErr.message
    return NextResponse.json(report, { status: 200 })
  }

  report.connectionCount = connections?.length ?? 0
  const results: unknown[] = []

  for (const conn of connections ?? []) {
    const entry: Record<string, unknown> = {
      platform: conn.platform,
      accountId: conn.account_id,
      accountName: conn.account_name ?? null,
      accountUsername: conn.account_username ?? null,
      tokenExpiresAt: conn.expires_at ?? null,
    }

    try {
      const token = await getValidMetaToken(
        conn.platform as 'facebook' | 'instagram' | 'threads',
        conn.account_id
      )

      if (!token) {
        entry.error = 'No valid token could be retrieved for this connection'
        results.push(entry)
        continue
      }

      // Instagram Login uses graph.instagram.com; Facebook Pages use graph.facebook.com.
      const host =
        conn.platform === 'instagram'
          ? 'https://graph.instagram.com'
          : 'https://graph.facebook.com'

      const url =
        host +
        '/' +
        META_GRAPH_VERSION +
        '/' +
        conn.account_id +
        '/subscribed_apps?access_token=' +
        encodeURIComponent(token)

      const res = await fetch(url, { method: 'GET' })
      const bodyText = await res.text()
      let body: unknown
      try {
        body = JSON.parse(bodyText)
      } catch {
        body = bodyText
      }

      entry.httpStatus = res.status
      entry.subscribedAppsResponse = body

      // Interpret: data array non-empty => subscribed.
      const dataArr = (body as { data?: unknown[] })?.data
      entry.isSubscribed = Array.isArray(dataArr) && dataArr.length > 0
    } catch (e) {
      entry.error = e instanceof Error ? e.message : String(e)
    }

    results.push(entry)
  }

  report.results = results
  return NextResponse.json(report, { status: 200 })
}

