import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(url && anon)

if (!supabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — see .env.example')
}

export const SUPABASE_URL = url ?? 'http://localhost'
export const SUPABASE_ANON_KEY = anon ?? 'anon'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
