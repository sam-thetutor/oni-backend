import { config } from 'dotenv';
import { createPublicClient, http } from 'viem';
import { defineChain } from 'viem';

config();

// Define CrossFI mainnet chain
const crossfiMainnet = defineChain({
  id: 4158,
  name: 'CrossFI Mainnet',
  nativeCurrency: {
    decimals: 18,
    name: 'XFI',
    symbol: 'XFI',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.mainnet.ms'],
    },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://xfiscan.com' },
  },
});

const CONTRACT_ADDRESS = '0x2162cc7a03a7903Dd01c77cCCb8Bd910B05b06d8';

async function checkContractInfo() {
  console.log('🔍 Checking Contract Information\n');
  console.log(`🏗️  Contract Address: ${CONTRACT_ADDRESS}\n`);

  try {
    // Create public client
    const publicClient = createPublicClient({
      chain: crossfiMainnet,
      transport: http(),
    });

    console.log('📡 Connected to CrossFi Mainnet\n');

    // Check if there's code at the address
    const code = await publicClient.getBytecode({ address: CONTRACT_ADDRESS });
    
    if (code) {
      console.log('✅ Contract has code deployed');
      console.log(`📏 Code size: ${code.length} bytes`);
    } else {
      console.log('❌ No contract code found at this address');
      return;
    }

    // Try to get contract name (if it has a name function)
    try {
      const name = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: [{ inputs: [], name: 'name', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' }],
        functionName: 'name',
      });
      console.log(`📝 Contract Name: ${name}`);
    } catch (error) {
      console.log('📝 Contract Name: Not available');
    }

    // Try to get contract symbol (if it has a symbol function)
    try {
      const symbol = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: [{ inputs: [], name: 'symbol', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' }],
        functionName: 'symbol',
      });
      console.log(`🔤 Contract Symbol: ${symbol}`);
    } catch (error) {
      console.log('🔤 Contract Symbol: Not available');
    }

    // Try to get total supply (if it has a totalSupply function)
    try {
      const totalSupply = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: [{ inputs: [], name: 'totalSupply', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' }],
        functionName: 'totalSupply',
      });
      console.log(`💰 Total Supply: ${totalSupply}`);
    } catch (error) {
      console.log('💰 Total Supply: Not available');
    }

    // Check if it has any payment link related functions
    console.log('\n🔍 Testing Payment Link Functions...');
    
    const testFunctions = [
      'fixedPaymentLink',
      'globalPaymentLink', 
      'createFixedPaymentLink',
      'createGlobalPaymentLink',
      'payFixedPaymentLink',
      'contributeToGlobalPaymentLink'
    ];

    for (const funcName of testFunctions) {
      try {
        // Try to call with a test string
        await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: [{ 
            inputs: [{ type: 'string', name: 'test' }], 
            name: funcName, 
            outputs: [{ type: 'address' }], 
            stateMutability: 'view', 
            type: 'function' 
          }],
          functionName: funcName,
          args: ['test']
        });
        console.log(`✅ ${funcName}: Available`);
      } catch (error) {
        console.log(`❌ ${funcName}: Not available (${error.message.split('\n')[0]})`);
      }
    }

  } catch (error) {
    console.error('❌ Error checking contract:', error);
  }
}

checkContractInfo(); 