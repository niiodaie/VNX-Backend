import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

let supabase: SupabaseClient | null = null;

/**
 * Initialize Supabase client
 */
export const initSupabase = (): SupabaseClient => {
  if (!supabaseUrl || !supabaseServiceKey) {
    logger.warn('Supabase credentials not configured. Database features will be unavailable.');
    // Return a mock client for development
    return {} as SupabaseClient;
  }

  if (!supabase) {
    supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: false,
      },
    });
    logger.info('Supabase client initialized successfully');
  }

  return supabase;
};

/**
 * Get Supabase client instance
 */
export const getSupabase = (): SupabaseClient => {
  if (!supabase) {
    return initSupabase();
  }
  return supabase;
};

export default getSupabase;

