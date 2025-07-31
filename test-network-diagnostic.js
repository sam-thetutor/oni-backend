import { config } from 'dotenv';
import { createPublicClient, http, getContract } from 'viem';
import { defineChain } from 'viem';

// Load environment variables
config();

console.log('🔍 Network Diagnostic Tool\n');

// Environment variables
const isProduction = process.env.ENVIRONMENT === 'production';
const RPC_URL = isProduction 
  ? (process.env.RPC_URL || 'https://rpc.mainnet.ms')
  : (process.env.RPC_URL_TESTNET || 'https://rpc.testnet.ms');
const CHAIN_ID = isProduction 
  ? parseInt(process.env.CHAIN_ID || '4158')
  : parseInt(process.env.CHAIN_ID_TESTNET || '4157');

console.log('📊 Configuration:');
console.log(`  Environment: ${process.env.ENVIRONMENT || 'not set'}`);
console.log(`  Chain ID: ${CHAIN_ID}`);
console.log(`  RPC URL: ${RPC_URL}`);
console.log(`  Is Production: ${isProduction}\n`);

// Define CrossFi chain
const crossfi = defineChain({
  id: CHAIN_ID,
  name: 'CrossFi',
  network: 'crossfi',
  nativeCurrency: {
    decimals: 18,
    name: 'CrossFi',
    symbol: 'XFI',
  },
  rpcUrls: {
    default: {
      http: [RPC_URL],
    },
    public: {
      http: [RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: isProduction ? 'CrossFi Explorer' : 'CrossFi Testnet Explorer',
      url: isProduction ? 'https://xfiscan.com' : 'https://test.xfiscan.com',
    },
  },
});

// Create public client
const publicClient = createPublicClient({
  chain: crossfi,
  transport: http(RPC_URL),
});

// Test 1: Check network connection
async function testNetworkConnection() {
  console.log('🌐 Test 1: Network Connection');
  console.log('=' .repeat(40));
  
  try {
    const blockNumber = await publicClient.getBlockNumber();
    console.log(`✅ Connected to network`);
    console.log(`   Current block: ${blockNumber}`);
    
    const chainId = await publicClient.getChainId();
    console.log(`   Chain ID: ${chainId}`);
    
    return true;
  } catch (error) {
    console.error('❌ Network connection failed:', error.message);
    return false;
  }
}

// Test 2: Check router contract
async function testRouterContract() {
  console.log('\n🔧 Test 2: Router Contract');
  console.log('=' .repeat(40));
  
  const SWAP_ROUTER_ADDRESS = "0x841a503b62d25f778344a5aeaf6fab07df3e2e73";
  
  try {
    console.log(`Router Address: ${SWAP_ROUTER_ADDRESS}`);
    
    // Check if contract exists
    const code = await publicClient.getBytecode({ address: SWAP_ROUTER_ADDRESS });
    if (!code || code === '0x') {
      console.log('❌ No contract code found at router address');
      return false;
    }
    
    console.log('✅ Contract code found');
    
    // Try to call factory() function
    const factory = await publicClient.readContract({
      address: SWAP_ROUTER_ADDRESS,
      abi: [{"inputs":[],"name":"factory","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}],
      functionName: 'factory',
    });
    
    console.log(`   Factory address: ${factory}`);
    
    return true;
  } catch (error) {
    console.error('❌ Router contract test failed:', error.message);
    return false;
  }
}

// Test 3: Check token contracts
async function testTokenContracts() {
  console.log('\n🪙 Test 3: Token Contracts');
  console.log('=' .repeat(40));
  
  const tokens = {
    XFI: "0x4b641f607570b93520c2e678fb3cc9d712c7d12f",
    CFI: "0x4b641f607570b93520c2e678fb3cc9d712c7d12f",
    USDT: "0x55d398326f99059fF775485246999027B3197955",
    USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"
  };
  
  const erc20Abi = [
    {"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"}
  ];
  
  for (const [symbol, address] of Object.entries(tokens)) {
    try {
      console.log(`\nTesting ${symbol} (${address}):`);
      
      // Check if contract exists
      const code = await publicClient.getBytecode({ address });
      if (!code || code === '0x') {
        console.log(`  ❌ No contract code found`);
        continue;
      }
      
      // Get token info
      const name = await publicClient.readContract({
        address,
        abi: erc20Abi,
        functionName: 'name',
      });
      
      const tokenSymbol = await publicClient.readContract({
        address,
        abi: erc20Abi,
        functionName: 'symbol',
      });
      
      const decimals = await publicClient.readContract({
        address,
        abi: erc20Abi,
        functionName: 'decimals',
      });
      
      console.log(`  ✅ Contract found`);
      console.log(`     Name: ${name}`);
      console.log(`     Symbol: ${tokenSymbol}`);
      console.log(`     Decimals: ${decimals}`);
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }
}

// Test 4: Check if pairs exist
async function testPairs() {
  console.log('\n🔄 Test 4: Check Trading Pairs');
  console.log('=' .repeat(40));
  
  const SWAP_ROUTER_ADDRESS = "0x841a503b62d25f778344a5aeaf6fab07df3e2e73";
  const tokens = {
    XFI: "0x4b641f607570b93520c2e678fb3cc9d712c7d12f",
    USDT: "0x55d398326f99059fF775485246999027B3197955",
    USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"
  };
  
  const testPairs = [
    { from: 'XFI', to: 'USDT' },
    { from: 'XFI', to: 'USDC' },
    { from: 'USDT', to: 'USDC' }
  ];
  
  for (const pair of testPairs) {
    try {
      console.log(`\nTesting pair: ${pair.from} -> ${pair.to}`);
      
      const fromAddress = tokens[pair.from];
      const toAddress = tokens[pair.to];
      
      // Try to get amounts out with a small amount
      const amountsOut = await publicClient.readContract({
        address: SWAP_ROUTER_ADDRESS,
        abi: [{"inputs":[{"internalType":"uint256","name":"amountIn","type":"uint256"},{"internalType":"address[]","name":"path","type":"address[]"}],"name":"getAmountsOut","outputs":[{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"stateMutability":"view","type":"function"}],
        functionName: 'getAmountsOut',
        args: [1000000000000000000n, [fromAddress, toAddress]], // 1 token with 18 decimals
      });
      
      console.log(`  ✅ Pair exists`);
      console.log(`     Input: 1 ${pair.from}`);
      console.log(`     Output: ${amountsOut[1]} wei (${pair.to})`);
      
    } catch (error) {
      console.log(`  ❌ Pair failed: ${error.message}`);
    }
  }
}

// Main diagnostic runner
async function runDiagnostics() {
  console.log('🚀 Starting network diagnostics...\n');
  
  const tests = [
    { name: 'Network Connection', fn: testNetworkConnection },
    { name: 'Router Contract', fn: testRouterContract },
    { name: 'Token Contracts', fn: testTokenContracts },
    { name: 'Trading Pairs', fn: testPairs },
  ];

  for (const test of tests) {
    console.log(`\n🧪 Running: ${test.name}`);
    console.log('=' .repeat(60));
    
    try {
      await test.fn();
    } catch (error) {
      console.error(`❌ ${test.name} failed:`, error.message);
    }
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('📊 DIAGNOSTIC COMPLETE');
  console.log('=' .repeat(60));
}

// Run diagnostics
runDiagnostics().catch(error => {
  console.error('💥 Diagnostic runner failed:', error);
  process.exit(1);
}); 