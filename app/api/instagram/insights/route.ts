import { NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase/admin'
import { requireApiAuth } from '@/lib/auth/requireApiAuth'
import { getValidMetaToken, PlatformNotConnectedError, isTokenAuthError } from '@/lib/platform/tokens'
import { META_GRAPH_VERSION } from '@/lib/platform/metaVersion'

// ─── Instagram Insights sync ──────────────────────────────────────────────────
// Pulls the connected Instagram Business/Creator account's follower count and
// per-post performance metrics from the Graph API and writes them into
// follower_snapshots + content_metrics, which power the Audience dashboard.
//
// Requires the account to have granted instagram_manage_insights. Runs on a
// schedule (see lib/inngest/functions.ts) and once on connect.

const IG = 'https://graph.instagram.com'

interface IgMedia {
  id: string
  caption?: string
  media_type?: string // IMAGE | VIDEO | CAROUSEL_ALBUM
  media_product_type?: string // FEED | REELS | STORY
  like_count?: number
  comments_count?: number
  timestamp: string
}

interface IgInsightValue {
  name: string
  values: { value: number }[]
}

// Map Instagram's media_product_type/media_type onto our content_metrics buckets
function mediaTypeOf(m: IgMedia): string {
  if (m.media_product_type === 'REELS') return 'reel'
  if (m.media_type === 'CAROUSEL_ALBUM') return 'carousel'
  if (m.media_type === 'VIDEO') return 'video'
  return 'image'
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const json = await res.json()
  if (!res.ok || (json && json.error)) {
    throw new Error(json?.error?.message ?? 'Instagram API error ' + res.status)
  }
  return json as T
}

export async function POST(request: Request) {
  const unauthorized = await requireApiAuth(request)
  if (unauthorized) return unauthorized

  try {
    const { data: conn } = await adminSupabase
      .from('platform_connections')
      .select('account_id')
      .eq('platform', 'instagram')
      .limit(1)
      .single()

    if (!conn) {
      // Not connected: nothing to sync. 200 so the scheduled job no-ops.
      return NextResponse.json({ skipped: true, reason: 'not_connected', platform: 'instagram' })
    }

    const accountId = conn.account_id as string
    const token = await getValidMetaToken('instagram', accountId)

    // ── 1. Follower snapshot (one row per day; unique on platform+snapshot_date) ──
    const account = await fetchJson<{ followers_count?: number }>(
      IG + '/' + META_GRAPH_VERSION + '/me?fields=followers_count&access_token=' + token
    )
    const today = new Date().toISOString().slice(0, 10)
    let followerRow = 0
    if (typeof account.followers_count === 'number') {
      await adminSupabase.from('follower_snapshots').upsert(
        { platform: 'instagram', followers: account.followers_count, snapshot_date: today },
        { onConflict: 'platform,snapshot_date' }
      )
      followerRow = 1
    }

    // ── 2. Recent media + per-post insights ──
    const mediaList = await fetchJson<{ data?: IgMedia[] }>(
      IG + '/' + META_GRAPH_VERSION + '/me/media' +
        '?fields=id,caption,media_type,media_product_type,like_count,comments_count,timestamp' +
        '&limit=25&access_token=' + token
    )

    let metricsSynced = 0
    for (const m of mediaList.data ?? []) {
      // Insight metric names differ by media type; reels expose plays/reach.
      const metricNames =
        mediaTypeOf(m) === 'reel'
          ? 'plays,reach,saved,shares,total_interactions'
          : 'impressions,reach,saved,shares,total_interactions'

      let views = 0
      let saves = 0
      let shares = 0
      try {
        const ins = await fetchJson<{ data?: IgInsightValue[] }>(
          IG + '/' + META_GRAPH_VERSION + '/' + m.id + '/insights' +
            '?metric=' + metricNames + '&access_token=' + token
        )
        const byName: Record<string, number> = {}
        for (const v of ins.data ?? []) byName[v.name] = v.values?.[0]?.value ?? 0
        views = byName.plays ?? byName.impressions ?? byName.reach ?? 0
        saves = byName.saved ?? 0
        shares = byName.shares ?? 0
      } catch (err) {
        // Some media (very old, or stories) reject insight queries — skip metrics but still record the post.
        console.error('[instagram/insights] insight fetch failed for ' + m.id + ':', err instanceof Error ? err.message : err)
      }

      await adminSupabase.from('content_metrics').upsert(
        {
          platform: 'instagram',
          external_post_id: m.id,
          caption: m.caption ?? null,
          media_type: mediaTypeOf(m),
          views,
          likes: m.like_count ?? 0,
          comments: m.comments_count ?? 0,
          shares,
          saves,
          follows_gained: 0,
          posted_at: m.timestamp,
        },
        { onConflict: 'platform,external_post_id' }
      )
      metricsSynced++
    }

    return NextResponse.json({ followerSnapshots: followerRow, metricsSynced })
  } catch (err) {
    // Not connected, or the stored token was invalidated (password change,
    // revoked access, expired session): the owner needs to reconnect Instagram.
    // Return 200 so the daily job no-ops instead of retrying a "500" — the
    // reconnect prompt lives in the UI, not in an endlessly-failing cron.
    if (err instanceof PlatformNotConnectedError || isTokenAuthError(err)) {
      console.warn('[instagram/insights] skipped — Instagram needs reconnecting:', err instanceof Error ? err.message : err)
      return NextResponse.json({
        skipped: true,
        reason: err instanceof PlatformNotConnectedError ? 'not_connected' : 'reauth_required',
        platform: 'instagram',
      })
    }
    console.error('Instagram insights sync error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
