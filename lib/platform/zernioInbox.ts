import { adminSupabase } from '@/lib/supabase/admin'
import { conflictTarget } from '@/lib/db/conflictTargets'
import {
  listInboxConversations,
  getInboxMessages,
  listZernioAccounts,
  zernioAccountId,
  attachmentStoreUrl,
  type ZernioInboxConversation,
  type ZernioInboxMessage,
} from '@/lib/platform/zernio'

// Backfills the full Instagram/Facebook DM history from Zernio into our
// conversations/messages tables — everything that predates the webhook, plus
// media (stored as durable refreshUrls so photos/videos keep rendering). Runs
// on demand (the "Sync history" button) and once per day on login. Idempotent:
// messages upsert on their external id and are ignored on conflict, so re-runs
// are cheap and never duplicate history.

// Zernio reports X as "twitter"; the rest of the app uses "x".
function normPlatform(p?: string): string {
  return p === 'twitter' ? 'x' : (p ?? '')
}

// Backfill window. We import roughly the last month of DMs, not all history:
// enough that nothing recent is missed, small enough to finish inside a
// serverless request (an all-time pull timed out). Both list and message paging
// stop as soon as they cross the cutoff, so the work is proportional to the
// window, not the account's lifetime.
const DEFAULT_SINCE_DAYS = 30

// Safety caps so a runaway account can't loop forever (100 rows/page). With the
// date cutoff these are rarely hit; they're a backstop.
const MAX_CONV_PAGES = 10 // up to ~1,000 recently-active conversations
const MAX_MSG_PAGES = 6 // up to ~600 messages per conversation

interface AcctRef {
  accountId: string
  platform: string
}

function olderThan(iso: string | undefined, cutoffMs: number): boolean {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return !isNaN(t) && t < cutoffMs
}

// Upsert one conversation without clobbering fields the webhook keeps fresher.
// The list endpoint gives no participant username, and we must not overwrite a
// real "@handle" (or a user's reply/triage status) with a backfill blank — so
// on an existing row we only refresh last_message_at (and a still-"Unknown"
// name). Returns our conversation id, or null on failure.
async function upsertConversation(
  c: ZernioInboxConversation,
  platform: string,
  userId: string | null
): Promise<string | null> {
  if (!c.id) return null
  const participantId = c.participantId ?? null

  // Match an existing thread by the participant first — that's the identity the
  // webhook shares — so backfill lands in the SAME row the webhook created
  // instead of a duplicate. Fall back to the thread id (a prior backfill row).
  const findBy = async (col: 'participant_id' | 'external_thread_id', val: string) => {
    let q = adminSupabase
      .from('conversations')
      .select('id, contact_name, participant_id')
      .eq('platform', platform)
      .eq(col, val)
    if (userId) q = q.eq('user_id', userId)
    return (await q.maybeSingle()).data
  }

  let existing = participantId ? await findBy('participant_id', participantId) : null
  if (!existing) existing = await findBy('external_thread_id', c.id)

  const name = c.participantName || c.participantId || 'Unknown'
  const lastAt = c.updatedTime ?? new Date().toISOString()

  if (existing) {
    const patch: Record<string, unknown> = { last_message_at: lastAt }
    if (existing.contact_name === 'Unknown' && name !== 'Unknown') patch.contact_name = name
    // Stamp the participant id on a row that predates it (webhook rows, or an
    // earlier backfill) so future syncs and webhooks reconcile to it.
    if (!existing.participant_id && participantId) patch.participant_id = participantId
    if (c.participantPicture) patch.contact_avatar = c.participantPicture
    await adminSupabase.from('conversations').update(patch).eq('id', existing.id as string)
    return existing.id as string
  }

  const { data: inserted, error } = await adminSupabase
    .from('conversations')
    .insert({
      platform,
      external_thread_id: c.id,
      participant_id: participantId,
      contact_name: name,
      // No username is exposed by the list endpoint; a later webhook fills the
      // real @handle in. Empty (not the opaque numeric id) keeps the UI clean.
      contact_handle: '',
      contact_avatar: c.participantPicture ?? null,
      status: 'needs_reply',
      last_message_at: lastAt,
      ...(userId ? { user_id: userId } : {}),
    })
    .select('id')
    .single()
  if (error) {
    console.error('[zernio-inbox] conversation insert failed:', error.message)
    return null
  }
  return (inserted?.id as string) ?? null
}

function toMessageRow(m: ZernioInboxMessage, dbConvId: string, userId: string | null) {
  const attachments = (m.attachments ?? [])
    .map((a) => ({ type: a.type ?? a.originalType ?? 'file', url: attachmentStoreUrl(a) }))
    .filter((a) => a.url)
  return {
    conversation_id: dbConvId,
    direction: m.direction === 'outgoing' ? 'outbound' : 'inbound',
    body: m.message ?? '',
    external_message_id: m.id,
    sent_at: m.createdAt ?? new Date().toISOString(),
    ...(attachments.length ? { attachments } : {}),
    ...(userId ? { user_id: userId } : {}),
  }
}

// Fetch newest-first and stop at the cutoff. Only messages within the window
// are stored, and paging halts as soon as a page runs past it.
async function backfillMessages(
  conversationId: string,
  accountId: string,
  dbConvId: string,
  userId: string | null,
  cutoffMs: number
): Promise<number> {
  let cursor: string | undefined
  let count = 0
  for (let page = 0; page < MAX_MSG_PAGES; page++) {
    const res = await getInboxMessages(conversationId, accountId, { cursor, limit: 100, sortOrder: 'desc' })
    if (!res.ok || !res.data) break
    const msgs = res.data.messages ?? []
    const inWindow = msgs.filter((m) => m.id && !olderThan(m.createdAt, cutoffMs))
    const rows = inWindow.map((m) => toMessageRow(m, dbConvId, userId))
    if (rows.length) {
      // Ignore-on-conflict: never overwrite a message (or a reconciled reply) we
      // already hold; just fill in the ones we're missing.
      await adminSupabase.from('messages').upsert(rows, { onConflict: conflictTarget.message(), ignoreDuplicates: true })
      count += rows.length
    }
    // Any message on this page older than the cutoff means we've reached the
    // window's edge — newer pages are exhausted, so stop.
    const reachedEdge = msgs.some((m) => olderThan(m.createdAt, cutoffMs))
    if (reachedEdge || !res.data.pagination?.hasMore || !res.data.pagination.nextCursor) break
    cursor = res.data.pagination.nextCursor
  }
  return count
}

async function backfillAccount(acct: AcctRef, userId: string | null, sinceDays: number) {
  const cutoffMs = Date.now() - sinceDays * 86_400_000
  let cursor: string | undefined
  let conversations = 0
  let messages = 0
  for (let page = 0; page < MAX_CONV_PAGES; page++) {
    const res = await listInboxConversations({ accountId: acct.accountId, cursor, limit: 100, sortOrder: 'desc' })
    if (!res.ok || !res.data) break
    const list = res.data.data ?? []
    for (const c of list) {
      // Newest-updated first, so the first stale conversation ends the walk.
      if (olderThan(c.updatedTime, cutoffMs)) continue
      const platform = normPlatform(c.platform ?? acct.platform)
      const dbId = await upsertConversation(c, platform, userId)
      if (!dbId || !c.id) continue
      conversations++
      messages += await backfillMessages(c.id, c.accountId ?? acct.accountId, dbId, userId, cutoffMs)
    }
    const reachedEdge = list.some((c) => olderThan(c.updatedTime, cutoffMs))
    if (reachedEdge || !res.data.pagination?.hasMore || !res.data.pagination.nextCursor) break
    cursor = res.data.pagination.nextCursor
  }
  return { conversations, messages }
}

export interface InboxBackfillResult {
  conversations: number
  messages: number
  accountsSynced: number
  skipped?: true
  reason?: string
}

// Single-tenant pilot: every connected account belongs to the one creator.
export async function backfillInboxSingleTenant(sinceDays: number = DEFAULT_SINCE_DAYS): Promise<InboxBackfillResult> {
  const res = await listZernioAccounts()
  if (!res.ok || !res.data) return { conversations: 0, messages: 0, accountsSynced: 0, skipped: true, reason: res.error }
  const accounts = Array.isArray(res.data) ? res.data : res.data.accounts ?? []
  let conversations = 0
  let messages = 0
  let accountsSynced = 0
  for (const a of accounts) {
    const id = zernioAccountId(a)
    if (!id) continue
    const r = await backfillAccount({ accountId: id, platform: normPlatform(a.platform) }, null, sinceDays)
    conversations += r.conversations
    messages += r.messages
    accountsSynced++
  }
  return { conversations, messages, accountsSynced }
}

// Multi-user: only this creator's connected accounts.
export async function backfillInboxForUser(userId: string, sinceDays: number = DEFAULT_SINCE_DAYS): Promise<InboxBackfillResult> {
  const { data: accounts } = await adminSupabase
    .from('zernio_accounts')
    .select('zernio_account_id, platform')
    .eq('user_id', userId)
  let conversations = 0
  let messages = 0
  let accountsSynced = 0
  for (const acct of accounts ?? []) {
    const r = await backfillAccount(
      { accountId: acct.zernio_account_id as string, platform: normPlatform(acct.platform as string) },
      userId,
      sinceDays
    )
    conversations += r.conversations
    messages += r.messages
    accountsSynced++
  }
  return { conversations, messages, accountsSynced }
}
