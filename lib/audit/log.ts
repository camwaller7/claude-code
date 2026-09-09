import { adminSupabase } from '@/lib/supabase/admin'
import { getCurrentUserId } from '@/lib/auth/currentUser'

export type AuditAction =
  | 'sign_in'
  | 'sign_in_failed'
  | 'password_set'
  | 'password_reset'
  | 'terms_accepted'
  | 'forbidden_access_attempt'
  | 'platform_connected'
  | 'settings_changed'
  | 'deal_status_changed'
  | 'deal_created'
  | 'client_updated'
  | 'ai_action'
  | 'maintenance_mode_toggled'
  | 'account_deleted'
  | 'data_exported'

/**
 * Fire-and-forget audit write — never let logging failure break the actual
 * request. Uses the service-role client because this table has no client-
 * writable RLS policy at all (append-only from the server side only).
 */
export async function auditLog(
  action: AuditAction,
  detail?: Record<string, unknown>,
  actorEmail?: string | null,
  userId?: string | null
): Promise<void> {
  // Stamp the acting user so the per-user audit panel (which filters by user_id
  // in multi-user mode) shows the user's own activity instead of nothing. When
  // no userId is passed, resolve it from the session; null in background/webhook
  // contexts (system events) and harmless in the pilot (the panel reads unfiltered).
  let uid = userId ?? null
  if (uid == null) {
    try { uid = await getCurrentUserId() } catch { uid = null }
  }
  try {
    await adminSupabase.from('audit_log').insert({
      actor_email: actorEmail ?? null,
      user_id: uid,
      action,
      detail: detail ?? null,
    })
  } catch (e) {
    console.error('[audit] failed to write log entry:', e)
  }
}
