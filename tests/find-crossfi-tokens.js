import { config } from 'dotenv';
import { createPublicClient, http, getContract } from 'viem';
import { defineChain } from 'viem';

// Load environment variables
config();

console.log('🔍 CrossFi Token Discovery Tool\n');

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

// ERC20 ABI for token detection
const ERC20_ABI = [
  {"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
];

// Common token addresses to check (these are educated guesses based on common patterns)
const COMMON_ADDRESSES = [
  // CrossFi native token possibilities
  "0x0000000000000000000000000000000000000000", // Native XFI (not a contract)
  "0x4b641f607570b93520c2e678fb3cc9d712c7d12f", // Current XFI address
  "0x4b641f607570b93520c2e678fb3cc9d712c7d12f", // Current CFI address
  
  // USDT possibilities
  "0x55d398326f99059fF775485246999027B3197955", // Current USDT address
  "0xdAC17F958D2ee523a2206206994597C13D831ec7", // Standard USDT address
  "0x0000000000000000000000000000000000000000", // Placeholder
  
  // USDC possibilities  
  "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", // Current USDC address
  "0xA0b86a33E6441b8c4C8C8C8C8C8C8C8C8C8C8C8", // Standard USDC address
  "0x0000000000000000000000000000000000000000", // Placeholder
  
  // Wrapped XFI possibilities
  "0xbb4CdB9CBd36B01bD1cBaEF2aF378a0b6C7C8C8C", // WXFI pattern
  "0x4b641f607570b93520c2e678fb3cc9d712c7d12f", // Current pattern
];

// Known CrossFi addresses from documentation or common patterns
const KNOWN_CROSSFI_ADDRESSES = [
  // These are addresses that might be actual CrossFi tokens
  "0x4b641f607570b93520c2e678fb3cc9d712c7d12f", // Current XFI/CFI
  "0x55d398326f99059fF775485246999027B3197955", // Current USDT
  "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", // Current USDC
];

async function checkTokenContract(address) {
  try {
    // Check if contract exists
    const code = await publicClient.getBytecode({ address });
    if (!code || code === '0x') {
      return null;
    }
    
    // Try to get token info
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      publicClient.readContract({
        address,
        abi: ERC20_ABI,
        functionName: 'name',
      }),
      publicClient.readContract({
        address,
        abi: ERC20_ABI,
        functionName: 'symbol',
      }),
      publicClient.readContract({
        address,
        abi: ERC20_ABI,
        functionName: 'decimals',
      }),
      publicClient.readContract({
        address,
        abi: ERC20_ABI,
        functionName: 'totalSupply',
      }),
    ]);
    
    return {
      address,
      name,
      symbol,
      decimals,
      totalSupply: totalSupply.toString(),
      formattedSupply: (parseFloat(totalSupply.toString()) / Math.pow(10, decimals)).toLocaleString(),
    };
  } catch (error) {
    return null;
  }
}

async function findCrossFiTokens() {
  console.log('🔍 Searching for CrossFi tokens...\n');
  
  const foundTokens = [];
  
  // Check known addresses first
  console.log('📋 Checking known addresses:');
  for (const address of KNOWN_CROSSFI_ADDRESSES) {
    console.log(`\nChecking: ${address}`);
    const token = await checkTokenContract(address);
    if (token) {
      console.log(`  ✅ Found: ${token.name} (${token.symbol})`);
      console.log(`     Decimals: ${token.decimals}`);
      console.log(`     Total Supply: ${token.formattedSupply}`);
      foundTokens.push(token);
    } else {
      console.log(`  ❌ No contract found`);
    }
  }
  
  // Check for WXFI (Wrapped XFI) - common pattern
  console.log('\n🔍 Checking for WXFI pattern...');
  const wxfiAddresses = [
    "0xbb4CdB9CBd36B01bD1cBaEF2aF378a0b6C7C8C8C",
    "0x4b641f607570b93520c2e678fb3cc9d712c7d12f",
  ];
  
  for (const address of wxfiAddresses) {
    const token = await checkTokenContract(address);
    if (token && (token.symbol.toLowerCase().includes('wxfi') || token.symbol.toLowerCase().includes('xfi'))) {
      console.log(`  ✅ Found WXFI: ${token.name} (${token.symbol})`);
      foundTokens.push(token);
    }
  }
  
  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 DISCOVERED TOKENS');
  console.log('=' .repeat(60));
  
  if (foundTokens.length === 0) {
    console.log('❌ No ERC20 tokens found on CrossFi mainnet');
    console.log('\n💡 Suggestions:');
    console.log('  1. CrossFi might not have ERC20 tokens deployed yet');
    console.log('  2. Token addresses might be different');
    console.log('  3. Check CrossFi documentation for official token addresses');
    console.log('  4. Consider using testnet for development');
  } else {
    console.log(`✅ Found ${foundTokens.length} tokens:`);
    foundTokens.forEach((token, index) => {
      console.log(`\n${index + 1}. ${token.name} (${token.symbol})`);
      console.log(`   Address: ${token.address}`);
      console.log(`   Decimals: ${token.decimals}`);
      console.log(`   Total Supply: ${token.formattedSupply}`);
    });
    
    console.log('\n💡 Recommended configuration:');
    console.log('Update your tokens.ts file with the discovered addresses.');
  }
}

// Run token discovery
findCrossFiTokens().catch(error => {
  console.error('💥 Token discovery failed:', error);
  process.exit(1);
}); 