import { config } from 'dotenv';
import { connectDB } from './src/db/connect.js';
import { WalletService } from './src/services/wallet.js';
import { BlockchainService } from './src/services/blockchain.js';

// Load environment variables
config();

async function testBalanceDirect() {
  try {
    // Connect to database
    await connectDB();
    
    console.log('🔧 Testing balance functionality directly...');
    
    // Test with the existing user
    const privyId = 'did:privy:cmcpapapg01cmju0l1sjz555s';
    
    // Get user from database
    const user = await WalletService.getWalletByPrivyId(privyId);
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log(`✅ Found user: ${user.privyId}`);
    console.log(`  - Wallet Address: ${user.walletAddress}`);
    console.log(`  - Environment: ${process.env.ENVIRONMENT}`);
    console.log(`  - RPC URL: ${process.env.RPC_URL}`);
    console.log(`  - Chain ID: ${process.env.CHAIN_ID}`);
    
    // Test balance fetching
    console.log('\n🔍 Testing balance fetch...');
    const balance = await BlockchainService.getBalance(user.walletAddress);
    
    console.log('✅ Balance Result:');
    console.log(`  - Address: ${balance.address}`);
    console.log(`  - Balance: ${balance.balance}`);
    console.log(`  - Formatted: ${balance.formatted} XFI`);
    
    // Test wallet for operations
    console.log('\n🔍 Testing wallet for operations...');
    const walletForOps = await WalletService.getWalletForOperations(privyId);
    
    if (walletForOps) {
      console.log('✅ Wallet for operations:');
      console.log(`  - Address: ${walletForOps.address}`);
      console.log(`  - Chain ID: ${walletForOps.chainId}`);
      console.log(`  - Has Private Key: ${!!walletForOps.privateKey}`);
    } else {
      console.log('❌ Failed to get wallet for operations');
    }
    
  } catch (error) {
    console.error('❌ Error testing balance:', error);
  }
}

// Run the test
testBalanceDirect()
  .then(() => {
    console.log('\n✅ Balance test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Balance test failed:', error);
    process.exit(1);
  }); 