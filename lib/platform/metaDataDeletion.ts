import { adminSupabase } from '@/lib/supabase/admin'

// Deletes all data Corvelle holds that is keyed to a given Meta user id. This
// backs the deauthorize and data-deletion callbacks so the app can actually
// honour a deletion request, not just describe one.
//
// The signed_request user_id is an app-scoped id. It may match either:
//  - a messaging user (conversations.external_thread_id) — delete that thread
//    and its messages (messages cascade via the FK), or
//  - a connected account (platform_connections.account_id) — delete the
//    connection (removes the stored, encrypted token).
export async function deleteMetaUserData(userId: string): Promise<void> {
  const metaPlatforms = ['facebook', 'instagram']

  // Conversations for this user — messages cascade on delete (see schema).
  await adminSupabase
    .from('conversations')
    .delete()
    .in('platform', metaPlatforms)
    .eq('external_thread_id', userId)

  // Any stored connection whose account id is this user.
  await adminSupabase
    .from('platform_connections')
    .delete()
    .in('platform', metaPlatforms)
    .eq('account_id', userId)
}
