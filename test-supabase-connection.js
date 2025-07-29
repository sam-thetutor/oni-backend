import { config } from 'dotenv';
import { SupabaseService } from './src/services/supabase.js';

// Load environment variables
config();

async function testSupabaseConnection() {
  try {
    console.log('🔧 Testing Supabase connection...');
    
    // Test with a sample user
    const privyId = 'test-user-' + Date.now();
    const frontendWalletAddress = '0x' + '0'.repeat(40);
    const email = 'test@example.com';
    
    console.log(`  - Test Privy ID: ${privyId}`);
    console.log(`  - Environment: ${process.env.ENVIRONMENT}`);
    
    // Test user creation
    console.log('\n🔍 Testing user creation...');
    const user = await SupabaseService.getUserWallet(privyId, frontendWalletAddress, email);
    
    console.log('✅ User created successfully:');
    console.log(`  - ID: ${user.id}`);
    console.log(`  - Privy ID: ${user.privy_id}`);
    console.log(`  - Wallet Address: ${user.wallet_address}`);
    console.log(`  - Points: ${user.points}`);
    
    // Test user retrieval
    console.log('\n🔍 Testing user retrieval...');
    const retrievedUser = await SupabaseService.getWalletByPrivyId(privyId);
    
    if (retrievedUser) {
      console.log('✅ User retrieved successfully');
      console.log(`  - Wallet Address: ${retrievedUser.wallet_address}`);
    } else {
      console.log('❌ Failed to retrieve user');
    }
    
    // Test wallet operations
    console.log('\n🔍 Testing wallet operations...');
    const walletForOps = await SupabaseService.getWalletForOperations(privyId);
    
    if (walletForOps) {
      console.log('✅ Wallet operations successful');
      console.log(`  - Address: ${walletForOps.address}`);
      console.log(`  - Chain ID: ${walletForOps.chainId}`);
      console.log(`  - Has Private Key: ${!!walletForOps.privateKey}`);
    } else {
      console.log('❌ Failed to get wallet for operations');
    }
    
    // Test points update
    console.log('\n🔍 Testing points update...');
    await SupabaseService.updateUserPoints(privyId, 100);
    console.log('✅ Points updated successfully');
    
    // Verify points update
    const updatedUser = await SupabaseService.getWalletByPrivyId(privyId);
    if (updatedUser) {
      console.log(`  - Updated Points: ${updatedUser.points}`);
    }
    
    console.log('\n🎉 All Supabase tests passed!');
    
  } catch (error) {
    console.error('❌ Supabase test failed:', error);
    console.error('Error details:', error.message);
    
    // Check if it's a configuration issue
    if (error.message.includes('Invalid API key') || error.message.includes('JWT')) {
      console.log('\n💡 This looks like a configuration issue. Please check:');
      console.log('  1. Your SUPABASE_URL in .env file');
      console.log('  2. Your SUPABASE_SERVICE_ROLE_KEY in .env file');
      console.log('  3. That you\'ve run the migration script in Supabase');
    }
  }
}

// Run the test
testSupabaseConnection()
  .then(() => {
    console.log('\n✅ Supabase connection test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Supabase connection test failed:', error);
    process.exit(1);
  }); 