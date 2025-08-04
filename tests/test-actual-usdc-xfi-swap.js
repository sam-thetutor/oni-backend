import { config } from 'dotenv';
import { createPublicClient, http, createWalletClient, parseUnits, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// Load environment variables
config();

const isProduction = process.env.ENVIRONMENT === 'production';

// Private key for testing
const PRIVATE_KEY = '0xd0e9117cf353f4895f7a0280b5dab7fd88c19202c43e03be8aefca0c89f7c9d5';

// Create public client
const publicClient = createPublicClient({
  chain: {
    id: isProduction ? 4158 : 4158, // CrossFi Mainnet
    name: 'CrossFi',
    nativeCurrency: { name: 'XFI', symbol: 'XFI', decimals: 18 },
    rpcUrls: {
      default: {
        http: [isProduction ? 'https://rpc.mainnet.ms' : 'https://rpc.mainnet.ms'],
      },
    },
  },
  transport: http(),
});

// Create wallet client
const walletClient = createWalletClient({
  chain: {
    id: isProduction ? 4158 : 4158,
    name: 'CrossFi',
    nativeCurrency: { name: 'XFI', symbol: 'XFI', decimals: 18 },
    rpcUrls: {
      default: {
        http: [isProduction ? 'https://rpc.mainnet.ms' : 'https://rpc.mainnet.ms'],
      },
    },
  },
  transport: http(),
});

// Token addresses
const TOKEN_ADDRESSES = {
  USDC: "0x7bBcE15166bBc008EC1aDF9b3D6bbA0602FCE7Ba",
  WXFI: "0xC537D12bd626B135B251cCa43283EFF69eC109c4",
  XFI: "0x0000000000000000000000000000000000000000" // Native token
};

// Router address
const ROUTER_ADDRESS = "0x841a503b62d25f778344a5aeaf6fab07df3e2e73";

// Router ABI for swaps
const ROUTER_ABI = [
  {"inputs":[{"internalType":"uint256","name":"amountIn","type":"uint256"},{"internalType":"address[]","name":"path","type":"address[]"}],"name":"getAmountsOut","outputs":[{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"amountIn","type":"uint256"},{"internalType":"uint256","name":"amountOutMin","type":"uint256"},{"internalType":"address[]","name":"path","type":"address[]"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"}],"name":"swapExactTokensForTokens","outputs":[{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"stateMutability":"nonpayable","type":"function"}
];

// ERC20 ABI for balance, allowance, and approve
const ERC20_ABI = [
  {"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"}
];

async function checkBalances(account) {
  console.log('🔍 CHECKING BALANCES');
  console.log('=' .repeat(50));
  
  try {
    // Check native XFI balance
    const xfiBalance = await publicClient.getBalance({ address: account.address });
    console.log(`Native XFI Balance: ${formatUnits(xfiBalance, 18)} XFI`);
    
    // Check USDC balance
    const usdcBalance = await publicClient.readContract({
      address: TOKEN_ADDRESSES.USDC,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account.address],
    });
    console.log(`USDC Balance: ${formatUnits(usdcBalance, 6)} USDC`);
    
    // Check WXFI balance
    const wxfiBalance = await publicClient.readContract({
      address: TOKEN_ADDRESSES.WXFI,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account.address],
    });
    console.log(`WXFI Balance: ${formatUnits(wxfiBalance, 18)} WXFI`);
    
    return { xfiBalance, usdcBalance, wxfiBalance };
    
  } catch (error) {
    console.log(`❌ Error checking balances: ${error.message}`);
    return null;
  }
}

async function checkAllowance(account) {
  console.log('\n🔐 CHECKING USDC ALLOWANCE');
  console.log('=' .repeat(50));
  
  try {
    const allowance = await publicClient.readContract({
      address: TOKEN_ADDRESSES.USDC,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [account.address, ROUTER_ADDRESS],
    });
    
    console.log(`USDC Allowance for Router: ${formatUnits(allowance, 6)} USDC`);
    return allowance;
    
  } catch (error) {
    console.log(`❌ Error checking allowance: ${error.message}`);
    return BigInt(0);
  }
}

async function approveUSDC(account, amount) {
  console.log('\n✅ APPROVING USDC');
  console.log('=' .repeat(50));
  
  try {
    const amountWei = parseUnits(amount, 6); // USDC has 6 decimals
    
    console.log(`Approving ${amount} USDC for router...`);
    
    const hash = await walletClient.writeContract({
      address: TOKEN_ADDRESSES.USDC,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [ROUTER_ADDRESS, amountWei],
      account: account,
    });
    
    console.log(`✅ Approval transaction sent: ${hash}`);
    
    // Wait for transaction to be mined
    console.log('⏳ Waiting for approval transaction to be mined...');
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`✅ Approval transaction confirmed in block ${receipt.blockNumber}`);
    
    return true;
    
  } catch (error) {
    console.log(`❌ Error approving USDC: ${error.message}`);
    return false;
  }
}

async function getSwapQuote(usdcAmount) {
  console.log('\n💰 GETTING SWAP QUOTE');
  console.log('=' .repeat(50));
  
  try {
    const usdcAmountWei = parseUnits(usdcAmount, 6);
    const path = [TOKEN_ADDRESSES.USDC, TOKEN_ADDRESSES.WXFI];
    
    console.log(`Getting quote for ${usdcAmount} USDC -> XFI`);
    
    const amountsOut = await publicClient.readContract({
      address: ROUTER_ADDRESS,
      abi: ROUTER_ABI,
      functionName: 'getAmountsOut',
      args: [usdcAmountWei, path],
    });
    
    const wxfiAmount = amountsOut[1];
    const wxfiAmountFormatted = Number(wxfiAmount) / Math.pow(10, 18);
    
    console.log(`✅ Quote received:`);
    console.log(`   Input: ${usdcAmount} USDC`);
    console.log(`   Output: ${wxfiAmountFormatted.toFixed(6)} WXFI`);
    console.log(`   Rate: 1 USDC = ${(wxfiAmountFormatted / parseFloat(usdcAmount)).toFixed(6)} XFI`);
    
    return {
      success: true,
      input: usdcAmount,
      output: wxfiAmountFormatted,
      rawOutput: wxfiAmount,
      path: path
    };
    
  } catch (error) {
    console.log(`❌ Error getting quote: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function executeSwap(account, usdcAmount, slippage = 5) {
  console.log('\n🚀 EXECUTING USDC TO XFI SWAP');
  console.log('=' .repeat(50));
  
  try {
    // Get quote first
    const quote = await getSwapQuote(usdcAmount);
    if (!quote.success) {
      console.log('❌ Cannot execute swap - quote failed');
      return false;
    }
    
    const usdcAmountWei = parseUnits(usdcAmount, 6);
    
    // Calculate minimum received with slippage
    const slippageMultiplier = (100 - slippage) / 100;
    const minimumReceivedWei = quote.rawOutput * BigInt(Math.floor(slippageMultiplier * 1000)) / 1000n;
    
    // Set deadline (20 minutes from now)
    const deadline = Math.floor(Date.now() / 1000) + (20 * 60);
    
    console.log(`Executing swap:`);
    console.log(`   Input: ${usdcAmount} USDC`);
    console.log(`   Expected Output: ${quote.output.toFixed(6)} WXFI`);
    console.log(`   Minimum Output: ${formatUnits(minimumReceivedWei, 18)} WXFI`);
    console.log(`   Slippage: ${slippage}%`);
    console.log(`   Deadline: ${new Date(deadline * 1000).toISOString()}`);
    
    const hash = await walletClient.writeContract({
      address: ROUTER_ADDRESS,
      abi: ROUTER_ABI,
      functionName: 'swapExactTokensForTokens',
      args: [
        usdcAmountWei,
        minimumReceivedWei,
        quote.path,
        account.address,
        BigInt(deadline)
      ],
      account: account,
    });
    
    console.log(`✅ Swap transaction sent: ${hash}`);
    
    // Wait for transaction to be mined
    console.log('⏳ Waiting for swap transaction to be mined...');
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`✅ Swap transaction confirmed in block ${receipt.blockNumber}`);
    
    return true;
    
  } catch (error) {
    console.log(`❌ Error executing swap: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🔧 TESTING ACTUAL USDC TO XFI SWAP');
  console.log('=' .repeat(50));
  console.log(`Environment: ${isProduction ? 'Production' : 'Testnet'}`);
  console.log(`Test Date: ${new Date().toISOString()}`);
  
  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log(`Wallet Address: ${account.address}`);
  
  // Step 1: Check initial balances
  const initialBalances = await checkBalances(account);
  if (!initialBalances) {
    console.log('❌ Cannot proceed - balance check failed');
    return;
  }
  
  // Step 2: Check allowance
  const initialAllowance = await checkAllowance(account);
  
  // Step 3: Set swap amount (small amount for testing)
  const swapAmount = '0.05'; // 0.05 USDC
  
  // Step 4: Check if approval is needed
  const requiredAmount = parseUnits(swapAmount, 6);
  if (initialAllowance < requiredAmount) {
    console.log(`\n⚠️  Need to approve USDC first`);
    const approvalSuccess = await approveUSDC(account, swapAmount);
    if (!approvalSuccess) {
      console.log('❌ Cannot proceed - approval failed');
      return;
    }
  } else {
    console.log(`\n✅ USDC already approved`);
  }
  
  // Step 5: Execute the swap
  console.log(`\n🎯 Ready to swap ${swapAmount} USDC to XFI`);
  const swapSuccess = await executeSwap(account, swapAmount, 5);
  
  if (swapSuccess) {
    // Step 6: Check final balances
    console.log('\n📊 CHECKING FINAL BALANCES');
    console.log('=' .repeat(50));
    const finalBalances = await checkBalances(account);
    
    if (finalBalances) {
      console.log('\n📈 BALANCE CHANGES:');
      console.log(`USDC: ${formatUnits(initialBalances.usdcBalance, 6)} → ${formatUnits(finalBalances.usdcBalance, 6)}`);
      console.log(`WXFI: ${formatUnits(initialBalances.wxfiBalance, 18)} → ${formatUnits(finalBalances.wxfiBalance, 18)}`);
      console.log(`XFI: ${formatUnits(initialBalances.xfiBalance, 18)} → ${formatUnits(finalBalances.xfiBalance, 18)}`);
      
      const usdcChange = initialBalances.usdcBalance - finalBalances.usdcBalance;
      const wxfiChange = finalBalances.wxfiBalance - initialBalances.wxfiBalance;
      
      console.log(`\n💰 SWAP RESULTS:`);
      console.log(`USDC spent: ${formatUnits(usdcChange, 6)} USDC`);
      console.log(`WXFI received: ${formatUnits(wxfiChange, 18)} WXFI`);
      console.log(`Rate achieved: ${formatUnits(wxfiChange, 18) / formatUnits(usdcChange, 6)} XFI per USDC`);
    }
  }
  
  console.log('\n✅ Test complete');
}

main().catch(console.error); 