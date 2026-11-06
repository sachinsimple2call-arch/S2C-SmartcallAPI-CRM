import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vwvsfuvdatdtjlrredvu.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_L7--J6HSa9X8FLb7SVc5gQ_AYy9zngU';

export const supabase = createClient(supabaseUrl, supabaseKey);
