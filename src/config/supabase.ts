import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

// Environment-aware Supabase configuration
const isProduction = process.env.ENVIRONMENT === 'production';

const supabaseUrl = isProduction 
  ? (process.env.SUPABASE_URL || '')
  : (process.env.SUPABASE_URL_TESTNET || '');

const supabaseKey = isProduction
  ? (process.env.SUPABASE_ANON_KEY || '')
  : (process.env.SUPABASE_ANON_KEY_TESTNET || '');

const supabaseServiceKey = isProduction
  ? (process.env.SUPABASE_SERVICE_ROLE_KEY || '')
  : (process.env.SUPABASE_SERVICE_ROLE_KEY_TESTNET || '');

console.log(`🔧 Supabase Configuration:`);
console.log(`  - Environment: ${isProduction ? 'Production' : 'Development/Testnet'}`);
console.log(`  - URL: ${supabaseUrl || 'NOT SET'}`);
console.log(`  - Anon Key: ${supabaseKey ? 'SET' : 'NOT SET'}`);
console.log(`  - Service Key: ${supabaseServiceKey ? 'SET' : 'NOT SET'}`);

// Validate configuration
if (!supabaseUrl) {
  throw new Error(`SUPABASE_URL is not set for ${isProduction ? 'production' : 'testnet'} environment`);
}

if (!supabaseKey) {
  throw new Error(`SUPABASE_ANON_KEY is not set for ${isProduction ? 'production' : 'testnet'} environment`);
}

if (!supabaseServiceKey) {
  throw new Error(`SUPABASE_SERVICE_ROLE_KEY is not set for ${isProduction ? 'production' : 'testnet'} environment`);
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Create Supabase admin client for server-side operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Database types (you'll generate these from Supabase)
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          privy_id: string;
          email: string | null;
          wallet_address: string;
          frontend_wallet_address: string;
          encrypted_private_key: string;
          points: number;
          total_volume: number;
          weekly_points: number | null;
          weekly_volume: number | null;
          username: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          privy_id: string;
          email?: string | null;
          wallet_address: string;
          frontend_wallet_address: string;
          encrypted_private_key: string;
          points?: number;
          total_volume?: number;
          weekly_points?: number | null;
          weekly_volume?: number | null;
          username?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          privy_id?: string;
          email?: string | null;
          wallet_address?: string;
          frontend_wallet_address?: string;
          encrypted_private_key?: string;
          points?: number;
          total_volume?: number;
          weekly_points?: number | null;
          weekly_volume?: number | null;
          username?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      payment_links: {
        Row: {
          id: string;
          link_id: string;
          user_id: string;
          amount: string | null;
          is_global: boolean;
          is_paid: boolean;
          paid_amount: string | null;
          paid_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          link_id: string;
          user_id: string;
          amount?: string | null;
          is_global?: boolean;
          is_paid?: boolean;
          paid_amount?: string | null;
          paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          link_id?: string;
          user_id?: string;
          amount?: string | null;
          is_global?: boolean;
          is_paid?: boolean;
          paid_amount?: string | null;
          paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      dca_orders: {
        Row: {
          id: string;
          user_id: string;
          from_token: string;
          to_token: string;
          amount: string;
          trigger_price: number;
          trigger_type: 'above' | 'below';
          status: 'active' | 'executed' | 'cancelled' | 'failed' | 'expired';
          executed_at: string | null;
          transaction_hash: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          from_token: string;
          to_token: string;
          amount: string;
          trigger_price: number;
          trigger_type: 'above' | 'below';
          status?: 'active' | 'executed' | 'cancelled' | 'failed' | 'expired';
          executed_at?: string | null;
          transaction_hash?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          from_token?: string;
          to_token?: string;
          amount?: string;
          trigger_price?: number;
          trigger_type?: 'above' | 'below';
          status?: 'active' | 'executed' | 'cancelled' | 'failed' | 'expired';
          executed_at?: string | null;
          transaction_hash?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
} 