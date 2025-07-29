import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();
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
if (!supabaseUrl) {
    throw new Error(`SUPABASE_URL is not set for ${isProduction ? 'production' : 'testnet'} environment`);
}
if (!supabaseKey) {
    throw new Error(`SUPABASE_ANON_KEY is not set for ${isProduction ? 'production' : 'testnet'} environment`);
}
if (!supabaseServiceKey) {
    throw new Error(`SUPABASE_SERVICE_ROLE_KEY is not set for ${isProduction ? 'production' : 'testnet'} environment`);
}
export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
//# sourceMappingURL=supabase.js.map