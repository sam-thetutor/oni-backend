import { config } from 'dotenv';
import { publicClient } from './dist/config/viem.js';

config();

async function testBalance() {
  try {
    console.log('🔍 Testing Balance Configuration:');
    console.log('Environment:', process.env.ENVIRONMENT);
    console.log('RPC URL:', process.env.RPC_URL);
    console.log('Chain ID:', process.env.CHAIN_ID);
    
    // Test address (replace with your actual address)
    const testAddress = '0xb2b70B203FeF7504CEE11a99e4e8A0d0892E35eB';
    
    console.log('\n🔍 Testing balance for address:', testAddress);
    
    // Get balance
    const balance = await publicClient.getBalance({ address: testAddress });
    
    console.log('Raw balance:', balance.toString());
    console.log('Formatted balance:', (Number(balance) / 10**18).toFixed(6), 'XFI');
    
    // Test chain info
    const chainId = await publicClient.getChainId();
    console.log('Connected chain ID:', chainId);
    
    // Test block number
    const blockNumber = await publicClient.getBlockNumber();
    console.log('Current block number:', blockNumber.toString());
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testBalance(); 