import { multiUserEnabled } from '@/lib/auth/currentUser'

// Upsert ON CONFLICT targets that differ between the single-tenant pilot and
// multi-user mode. External ids (a contact thread, a post id, a snapshot date)
// are only unique WITHIN one creator's accounts — two creators can both DM the
// same person, or post on the same day — so multi-user uses per-user composite
// unique keys (added in migration 030) instead of the pilot's global ones.
//
// This is keyed on multiUserEnabled() so it flips in lock-step with migration
// 030 at cutover: with the flag off the global constraint exists and is used;
// with it on the composite constraint exists and is used. Every upsert that
// targets one of these constraints must go through here.
export const conflictTarget = {
  conversation(): string {
    return multiUserEnabled()
      ? 'user_id,platform,external_thread_id'
      : 'platform,external_thread_id'
  },
  message(): string {
    return multiUserEnabled() ? 'user_id,external_message_id' : 'external_message_id'
  },
  followerSnapshot(): string {
    return multiUserEnabled() ? 'user_id,platform,snapshot_date' : 'platform,snapshot_date'
  },
  contentMetric(): string {
    return multiUserEnabled()
      ? 'user_id,platform,external_post_id'
      : 'platform,external_post_id'
  },
}
