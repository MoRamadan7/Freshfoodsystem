import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://nbtednvjdrnjasfmtkoq.supabase.co'
const supabaseAnonKey = 'sb_publishable_Mo5Hk0aRfbTs5KaD8yb9jw_zDeNZTG-'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)