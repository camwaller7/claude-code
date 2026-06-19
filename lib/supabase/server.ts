import { createServerComponentClient, createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export function createServerClient() {
  return createServerComponentClient({ cookies })
}

export function createRouteHandlerSupabase() {
  return createRouteHandlerClient({ cookies })
}
