import { config } from 'dotenv';
import { BlockchainService } from './src/services/blockchain.js';

// Load environment variables
config();

async function testBalanceNoDB() {
  try {
    console.log('🔧 Testing balance functionality without database...');
    
    // Test with a known wallet address
    const walletAddress = '0xb2b70B203FeF7504CEE11a99e4e8A0d0892E35eB';
    
    console.log(`  - Wallet Address: ${walletAddress}`);
    console.log(`  - Environment: ${process.env.ENVIRONMENT}`);
    console.log(`  - RPC URL: ${process.env.RPC_URL}`);
    console.log(`  - Chain ID: ${process.env.CHAIN_ID}`);
    
    // Test balance fetching
    console.log('\n🔍 Testing balance fetch...');
    const balance = await BlockchainService.getBalance(walletAddress);
    
    console.log('✅ Balance Result:');
    console.log(`  - Address: ${balance.address}`);
    console.log(`  - Balance: ${balance.balance}`);
    console.log(`  - Formatted: ${balance.formatted} XFI`);
    
    // Test if the balance is reasonable (should be > 0 for mainnet)
    const balanceInXFI = parseFloat(balance.formatted);
    if (balanceInXFI > 0) {
      console.log('✅ Balance check successful - user has XFI tokens');
    } else {
      console.log('⚠️  Balance is 0 - this might be expected for a new wallet');
    }
    
  } catch (error) {
    console.error('❌ Error testing balance:', error);
  }
}

// Run the test
testBalanceNoDB()
  .then(() => {
    console.log('\n✅ Balance test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Balance test failed:', error);
    process.exit(1);
  }); 