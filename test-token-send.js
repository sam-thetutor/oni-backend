import { TokenService } from './dist/services/tokens.js';
import { User } from './dist/models/User.js';
import { connectDB } from './dist/db/connect.js';

async function testTokenSend() {
  try {
    await connectDB();
    console.log('✅ Connected to database');

    // Use the specific user address
    const userAddress = '0x514D8876eAe2B500F756769b23345602dFF7dA82';
    const user = await User.findOne({ walletAddress: userAddress });
    if (!user) {
      console.log(`❌ User with wallet ${userAddress} not found in database`);
      return;
    }

    console.log(`👤 Testing with user: ${user.walletAddress}`);
    console.log(`🔑 User has encrypted private key: ${user.encryptedPrivateKey ? 'Yes' : 'No'}`);

    // Test USDT balance first
    console.log('\n💰 Checking USDT balance...');
    const usdtBalance = await TokenService.getTokenBalance(
      '0x38E88b1ed92065eD20241A257ef3713A131C9155', // USDT address
      user.walletAddress
    );
    console.log(`USDT Balance: ${usdtBalance.formatted} USDT`);

    // Test USDC balance
    console.log('\n💰 Checking USDC balance...');
    const usdcBalance = await TokenService.getTokenBalance(
      '0x7bBcE15166bBc008EC1aDF9b3D6bbA0602FCE7Ba', // USDC address
      user.walletAddress
    );
    console.log(`USDC Balance: ${usdcBalance.formatted} USDC`);

    // Test validation
    console.log('\n🔍 Testing balance validation...');
    const validation = await TokenService.validateSufficientBalance(
      '0x38E88b1ed92065eD20241A257ef3713A131C9155', // USDT address
      user.walletAddress,
      '0.1' // Small amount for testing
    );
    console.log(`Validation result:`, validation);

    // Test token transfer (commented out to avoid actual transactions)
    /*
    console.log('\n🔄 Testing token transfer...');
    const result = await TokenService.transferToken(
      user,
      '0x38E88b1ed92065eD20241A257ef3713A131C9155', // USDT address
      '0x514d8876eae2b500f756769b23345602dff7da82', // Test recipient
      '0.01' // Small amount
    );
    console.log(`Transfer result:`, result);
    */

    console.log('\n✅ Token send functionality test completed');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testTokenSend(); 