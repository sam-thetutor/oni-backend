import { config } from 'dotenv';
import { createPublicClient, http, parseEther, formatEther } from 'viem';
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

// Payment Link Contract ABI for reading data
const PAYMENT_LINK_ABI = [
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "name": "fixedPaymentLink",
    "outputs": [
      {
        "internalType": "address",
        "name": "creator",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "link",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "internalType": "enum PayLink.statusEnum",
        "name": "status",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "name": "globalPaymentLink",
    "outputs": [
      {
        "internalType": "address",
        "name": "creator",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "link",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "totalContributions",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// Contract address from your constants
const CONTRACT_ADDRESS = '0x8Ceb24694b8d3965Bd7224652B15B2A4f65Bd130';

async function fetchPaymentLinkDetails(linkId) {
  console.log(`🔍 Fetching payment link details for: ${linkId}\n`);

  try {
    // Create public client
    const publicClient = createPublicClient({
      chain: crossfiMainnet,
      transport: http(),
    });

    console.log('📡 Connected to CrossFi Mainnet');
    console.log(`🏗️  Contract Address: ${CONTRACT_ADDRESS}\n`);

    // Try to fetch as fixed payment link first
    console.log('🔍 Checking if it\'s a fixed payment link...');
    try {
      const fixedLinkData = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: PAYMENT_LINK_ABI,
        functionName: 'fixedPaymentLink',
        args: [linkId],
      });

      console.log('📊 Raw fixed link data:', fixedLinkData);

      // Handle array return format
      const [creator, link, amount, status] = fixedLinkData;

      if (creator && creator !== '0x0000000000000000000000000000000000000000') {
        console.log('✅ Found as Fixed Payment Link!');
        console.log('📋 Details:');
        console.log(`  Creator: ${creator}`);
        console.log(`  Link ID: ${link}`);
        console.log(`  Amount: ${formatEther(amount)} XFI`);
        console.log(`  Status: ${getStatusText(status)}`);
        
        return {
          type: 'fixed',
          creator: creator,
          linkId: link,
          amount: formatEther(amount),
          status: getStatusText(status),
          statusCode: Number(status)
        };
      } else {
        console.log('❌ Fixed payment link not found (creator is zero address)');
      }
    } catch (error) {
      console.log('❌ Error checking fixed payment link:', error.message);
    }

    // Try to fetch as global payment link
    console.log('\n🔍 Checking if it\'s a global payment link...');
    try {
      const globalLinkData = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: PAYMENT_LINK_ABI,
        functionName: 'globalPaymentLink',
        args: [linkId],
      });

      console.log('📊 Raw global link data:', globalLinkData);

      // Handle array return format
      const [creator, link, totalContributions] = globalLinkData;

      if (creator && creator !== '0x0000000000000000000000000000000000000000') {
        console.log('✅ Found as Global Payment Link!');
        console.log('📋 Details:');
        console.log(`  Creator: ${creator}`);
        console.log(`  Link ID: ${link}`);
        console.log(`  Total Contributions: ${formatEther(totalContributions)} XFI`);
        
        return {
          type: 'global',
          creator: creator,
          linkId: link,
          totalContributions: formatEther(totalContributions)
        };
      } else {
        console.log('❌ Global payment link not found (creator is zero address)');
      }
    } catch (error) {
      console.log('❌ Error checking global payment link:', error.message);
    }

    console.log('\n❌ Payment link not found on mainnet');
    return null;

  } catch (error) {
    console.error('❌ Error fetching payment link details:', error);
    return null;
  }
}

function getStatusText(status) {
  switch (Number(status)) {
    case 0:
      return 'Pending';
    case 1:
      return 'Paid';
    case 2:
      return 'Cancelled';
    default:
      return 'Unknown';
  }
}

// Test the specific payment link
async function testPaymentLink() {
  const linkId = 'FYWvch8ypl';
  
  console.log('🧪 Testing Payment Link Contract Reading on Mainnet\n');
  console.log(`🎯 Target Link ID: ${linkId}\n`);
  
  const result = await fetchPaymentLinkDetails(linkId);
  
  if (result) {
    console.log('\n📊 Final Result:');
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('\n❌ No payment link found with that ID on mainnet');
    console.log('💡 Possible reasons:');
    console.log('   - Link ID is incorrect');
    console.log('   - Link was created on testnet instead of mainnet');
    console.log('   - Link was deleted or expired');
    console.log('   - Link is on a different contract address');
  }
}

testPaymentLink(); 