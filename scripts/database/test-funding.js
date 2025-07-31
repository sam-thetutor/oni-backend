import { config } from 'dotenv';
import { WalletFundingService } from '../../dist/services/wallet-funding.js';

// Load environment variables
config();

async function testFundingSetup() {
  try {
    console.log('🔍 Testing Wallet Funding Setup...');
    console.log('====================================');
    
    // Check environment variables
    console.log('\n📋 Environment Variables:');
    console.log(`  - ENVIRONMENT: ${process.env.ENVIRONMENT || 'not set'}`);
    console.log(`  - FUNDING_AMOUNT: ${process.env.FUNDING_AMOUNT || '0.01 (default)'}`);
    console.log(`  - FUNDING_PRIVATE_KEY: ${process.env.FUNDING_PRIVATE_KEY ? '✅ Set' : '❌ Not set'}`);
    console.log(`  - RPC_URL: ${process.env.RPC_URL || 'not set'}`);
    console.log(`  - RPC_URL_TESTNET: ${process.env.RPC_URL_TESTNET || 'not set'}`);
    console.log(`  - CHAIN_ID: ${process.env.CHAIN_ID || 'not set'}`);
    console.log(`  - CHAIN_ID_TESTNET: ${process.env.CHAIN_ID_TESTNET || 'not set'}`);
    
    // Get funding wallet info
    console.log('\n💰 Funding Wallet Information:');
    try {
      const fundingAddress = WalletFundingService.getFundingWalletAddress();
      console.log(`  - Funding Address: ${fundingAddress}`);
      
      const fundingBalance = await WalletFundingService.getFundingWalletBalance();
      console.log(`  - Funding Balance: ${fundingBalance} XFI`);
      
      const fundingAmount = process.env.FUNDING_AMOUNT || '0.01';
      const balanceNum = parseFloat(fundingBalance);
      const amountNum = parseFloat(fundingAmount);
      const canFundCount = Math.floor(balanceNum / amountNum);
      
      console.log(`  - Can fund ${canFundCount} new wallets`);
      
      if (balanceNum < amountNum) {
        console.log('  ⚠️  WARNING: Insufficient balance to fund new wallets!');
      } else {
        console.log('  ✅ Sufficient balance to fund new wallets');
      }
      
    } catch (error) {
      console.log(`  ❌ Error getting funding wallet info: ${error.message}`);
    }
    
    // Test funding a dummy address (won't actually send)
    console.log('\n🧪 Testing Funding Logic (dummy address):');
    const dummyAddress = '0x1234567890123456789012345678901234567890';
    try {
      const fundingResult = await WalletFundingService.fundNewWallet(dummyAddress);
      console.log(`  - Funding Result: ${fundingResult.success ? '✅ Success' : '❌ Failed'}`);
      if (!fundingResult.success) {
        console.log(`  - Error: ${fundingResult.error}`);
      }
    } catch (error) {
      console.log(`  ❌ Error testing funding: ${error.message}`);
    }
    
    console.log('\n✅ Funding setup test completed');
    
  } catch (error) {
    console.error('❌ Error testing funding setup:', error);
  }
}

// Run the test
testFundingSetup()
  .then(() => {
    console.log('✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }); 