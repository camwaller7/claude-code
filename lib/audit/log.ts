import { adminSupabase } from '@/lib/supabase/admin'

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
export async function auditLog(action: AuditAction, detail?: Record<string, unknown>, actorEmail?: string | null): Promise<void> {
  try {
    await adminSupabase.from('audit_log').insert({
      actor_email: actorEmail ?? null,
      action,
      detail: detail ?? null,
    })
  } catch (e) {
    console.error('[audit] failed to write log entry:', e)
  }
}
