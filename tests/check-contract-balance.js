import { ethers } from 'ethers';

// Payment Link Contract ABI (only the getBalance function)
const PAYLINK_ABI = [
  {
    "inputs": [],
    "name": "getBalance",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// Contract address - CrossFi Mainnet Payment Link Contract
const PAYLINK_CONTRACT_ADDRESS = "0x8Ceb24694b8d3965Bd7224652B15B2A4f65Bd130";

// CrossFI RPC URL
const RPC_URL = "https://rpc.crossfi.com";

async function checkContractBalance() {
  try {
    console.log('🔍 Checking Payment Link Contract Balance...');
    console.log('Contract Address:', PAYLINK_CONTRACT_ADDRESS);
    console.log('RPC URL:', RPC_URL);
    console.log('');

    // Create provider
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    // Create contract instance
    const contract = new ethers.Contract(PAYLINK_CONTRACT_ADDRESS, PAYLINK_ABI, provider);
    
    // Get contract balance
    console.log('📞 Calling getBalance() method...');
    const balanceWei = await contract.getBalance();
    
    // Convert to XFI (18 decimals)
    const balanceXFI = ethers.formatEther(balanceWei);
    
    console.log('✅ Contract Balance:');
    console.log(`   Raw (Wei): ${balanceWei.toString()}`);
    console.log(`   XFI: ${balanceXFI} XFI`);
    
    // Also get the contract's native balance
    console.log('');
    console.log('📞 Getting native contract balance...');
    const nativeBalanceWei = await provider.getBalance(PAYLINK_CONTRACT_ADDRESS);
    const nativeBalanceXFI = ethers.formatEther(nativeBalanceWei);
    
    console.log('✅ Native Contract Balance:');
    console.log(`   Raw (Wei): ${nativeBalanceWei.toString()}`);
    console.log(`   XFI: ${nativeBalanceXFI} XFI`);
    
    // Compare the two balances
    console.log('');
    console.log('🔍 Balance Comparison:');
    console.log(`   getBalance() method: ${balanceXFI} XFI`);
    console.log(`   Native balance: ${nativeBalanceXFI} XFI`);
    
    if (balanceWei.toString() === nativeBalanceWei.toString()) {
      console.log('✅ Balances match - contract is working correctly');
    } else {
      console.log('⚠️  Balances differ - there might be an issue');
    }
    
  } catch (error) {
    console.error('❌ Error checking contract balance:', error.message);
    
    if (error.message.includes('contract address')) {
      console.log('');
      console.log('💡 Make sure to set the correct PAYLINK_CONTRACT_ADDRESS in the script');
    }
  }
}

// Run the script
checkContractBalance(); 