import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

async function testSupabaseUrl() {
  const currentUrl = process.env.SUPABASE_URL;
  
  console.log('🔧 Current Supabase Configuration:');
  console.log(`  - URL: ${currentUrl}`);
  console.log(`  - URL Format: ${currentUrl?.includes('db.') ? '❌ Database URL (incorrect)' : '✅ Project URL (correct)'}`);
  
  if (currentUrl?.includes('db.')) {
    console.log('\n❌ Issue detected: You\'re using a database URL instead of a project URL');
    console.log('\n💡 To fix this:');
    console.log('1. Go to your Supabase project dashboard');
    console.log('2. Navigate to Settings → API');
    console.log('3. Copy the "Project URL" (not the database URL)');
    console.log('4. Update your SUPABASE_URL environment variable');
    console.log('\nExample:');
    console.log('  ❌ https://db.qqkvznppzuxqidkekoxj.supabase.co');
    console.log('  ✅ https://qqkvznppzuxqidkekoxj.supabase.co');
  } else {
    console.log('\n✅ URL format looks correct!');
    
    // Test the connection
    try {
      const supabase = createClient(currentUrl, process.env.SUPABASE_ANON_KEY || '');
      const { data, error } = await supabase.from('users').select('count').limit(1);
      
      if (error) {
        console.log('❌ Connection failed:', error.message);
      } else {
        console.log('✅ Connection successful!');
      }
    } catch (err) {
      console.log('❌ Connection failed:', err.message);
    }
  }
}

testSupabaseUrl(); 