import { createBrowserClient } from '@supabase/ssr'

// Public keys — safe to hardcode as fallback for client bundle
const SUPABASE_URL = 'https://xbpgnqprsiembfwpzqit.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhicGducXByc2llbWJmd3B6cWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNjcyNDUsImV4cCI6MjA5NzY0MzI0NX0.yF0yrvfamZ-u28i6J_tDCPqr6atERWcaZA_12-yQ0Sw'

export const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
