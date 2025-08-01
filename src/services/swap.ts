import { 
  Address, 
  parseEther, 
  formatEther, 
  parseUnits, 
  formatUnits,
  createPublicClient,
  createWalletClient,
  http,
  getContract,
  parseAbiItem,
  encodeFunctionData,
  decodeFunctionData,
  getAddress,
  zeroAddress
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from 'dotenv';
import { 
  SWAP_ROUTER_ADDRESS, 
  SWAP_ROUTER_ABI 
} from '../constants/contract.js';
import { 
  TOKEN_ADDRESSES, 
  TOKEN_METADATA, 
  SWAP_CONFIG,
  validateSwapSlippage,
  isSupportedSwapToken,
  getTokenBySymbol
} from '../constants/tokens.js';
import { 
  SwapQuote, 
  SwapParams, 
  SwapResult, 
  SwapValidation,
  SwapErrorCode,
  TokenApproval
} from '../types/swap.js';
import { publicClient, createWalletClientFromPrivateKey } from '../config/viem.js';
import { IUser } from '../models/User.js';

// Load environment variables
config();

// ERC20 ABI for token interactions
const ERC20_ABI = [
  {
    "constant": true,
    "inputs": [{"name": "_owner", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "balance", "type": "uint256"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {"name": "_owner", "type": "address"},
      {"name": "_spender", "type": "address"}
    ],
    "name": "allowance",
    "outputs": [{"name": "", "type": "uint256"}],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {"name": "_spender", "type": "address"},
      {"name": "_value", "type": "uint256"}
    ],
    "name": "approve",
    "outputs": [{"name": "", "type": "bool"}],
    "type": "function"
  }
] as const;

export class SwapService {

  /**
   * Get a swap quote
   */
  static async getSwapQuote(params: SwapParams): Promise<SwapQuote> {
    try {
      const { fromToken, toToken, fromAmount, slippage = SWAP_CONFIG.DEFAULT_SLIPPAGE } = params;

      // Validate inputs
      if (!isSupportedSwapToken(fromToken) || !isSupportedSwapToken(toToken)) {
        throw new Error(`Unsupported token pair: ${fromToken} to ${toToken}`);
      }

      if (!validateSwapSlippage(slippage)) {
        throw new Error(`Invalid slippage: ${slippage}%. Must be between ${SWAP_CONFIG.MIN_SLIPPAGE}% and ${SWAP_CONFIG.MAX_SLIPPAGE}%`);
      }

      // Get token addresses
      const fromTokenMeta = getTokenBySymbol(fromToken);
      const toTokenMeta = getTokenBySymbol(toToken);

      if (!fromTokenMeta || !toTokenMeta) {
        throw new Error('Invalid token symbols');
      }

      const fromTokenAddress = fromTokenMeta.address as Address;
      const toTokenAddress = toTokenMeta.address as Address;

      // Parse amount
      const fromAmountWei = parseUnits(fromAmount, fromTokenMeta.decimals);

      // Determine if this is a native XFI swap
      const isNativeXFI = fromToken === 'CFI' || fromToken === 'XFI';
      const isToNativeXFI = toToken === 'CFI' || toToken === 'XFI';
      
      // Block USDT swaps (temporarily disabled due to incorrect pricing)
      if (fromToken === 'USDT' || toToken === 'USDT') {
        throw new Error('USDT swaps are temporarily disabled. Please use USDC instead.');
      }

      // Create swap path - for native XFI swaps, we need to use WXFI as intermediary
      let path: Address[];
      if (isNativeXFI && !isToNativeXFI) {
        // XFI to Token: Use WXFI as intermediary (XFI -> WXFI -> Token)
        // For native XFI swaps, we use WXFI as the starting point in the path
        path = [TOKEN_ADDRESSES.WXFI as Address, toTokenAddress];
      } else if (!isNativeXFI && isToNativeXFI) {
        // Token to XFI: Use WXFI as intermediary (Token -> WXFI -> XFI)
        // For swaps to native XFI, we end with WXFI in the path
        path = [fromTokenAddress, TOKEN_ADDRESSES.WXFI as Address];
      } else if (isNativeXFI && isToNativeXFI) {
        // XFI to XFI: This shouldn't happen, but handle gracefully
        throw new Error('Cannot swap XFI to XFI');
      } else {
        // Token to Token: direct path
        path = [fromTokenAddress, toTokenAddress];
      }

      // Get amounts out from router
      const amountsOut = await publicClient.readContract({
        address: SWAP_ROUTER_ADDRESS as Address,
        abi: SWAP_ROUTER_ABI,
        functionName: 'getAmountsOut',
        args: [fromAmountWei, path],
      });

      if (!amountsOut || amountsOut.length < 2) {
        throw new Error('Failed to get swap quote');
      }

      const toAmountWei = amountsOut[amountsOut.length - 1]; // Last amount in path
      const toAmount = formatUnits(toAmountWei, toTokenMeta.decimals);

      // Calculate price impact (simplified - in production you'd get this from reserves)
      const priceImpact = 0.1; // Placeholder - would calculate from reserves

      // Calculate minimum received with slippage
      const slippageMultiplier = (100 - slippage) / 100;
      const minimumReceivedWei = toAmountWei * BigInt(Math.floor(slippageMultiplier * 1000)) / 1000n;
      const minimumReceived = formatUnits(minimumReceivedWei, toTokenMeta.decimals);

      // Estimate gas (simplified)
      const gasEstimate = path.length > 2 ? '200000' : '150000'; // Higher gas for multi-hop

      // Calculate deadline
      const deadline = Math.floor(Date.now() / 1000) + (SWAP_CONFIG.DEADLINE_MINUTES * 60);

      // Calculate price
      const price = parseFloat(toAmount) / parseFloat(fromAmount);

      return {
        fromToken,
        toToken,
        fromAmount,
        toAmount,
        fromAmountFormatted: `${fromAmount} ${fromToken}`,
        toAmountFormatted: `${toAmount} ${toToken}`,
        price,
        priceImpact,
        minimumReceived,
        minimumReceivedFormatted: `${minimumReceived} ${toToken}`,
        gasEstimate,
        gasEstimateFormatted: `${gasEstimate} gas`,
        slippage,
        path,
        deadline,
      };
    } catch (error) {
      console.error('Error getting swap quote:', error);
      throw new Error(`Failed to get swap quote: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate swap parameters and user balance
   */
  static async validateSwap(user: IUser, params: SwapParams): Promise<SwapValidation> {
    try {
      const { fromToken, toToken, fromAmount, slippage = SWAP_CONFIG.DEFAULT_SLIPPAGE } = params;

      // Basic validation
      if (!isSupportedSwapToken(fromToken) || !isSupportedSwapToken(toToken)) {
        return {
          valid: false,
          error: `Unsupported token pair: ${fromToken} to ${toToken}`,
        };
      }
      
      // Block USDT swaps (temporarily disabled due to incorrect pricing)
      if (fromToken === 'USDT' || toToken === 'USDT') {
        return {
          valid: false,
          error: 'USDT swaps are temporarily disabled. Please use USDC instead.',
        };
      }

      if (!validateSwapSlippage(slippage)) {
        return {
          valid: false,
          error: `Invalid slippage: ${slippage}%. Must be between ${SWAP_CONFIG.MIN_SLIPPAGE}% and ${SWAP_CONFIG.MAX_SLIPPAGE}%`,
        };
      }

      // Get token metadata
      const fromTokenMeta = getTokenBySymbol(fromToken);
      if (!fromTokenMeta) {
        return {
          valid: false,
          error: `Invalid from token: ${fromToken}`,
        };
      }

      // Check if user has a wallet
      if (!user.walletAddress) {
        return {
          valid: false,
          error: 'User has no wallet address',
        };
      }

      const userAddress = user.walletAddress as Address;

      // Handle token mapping for validation
      let actualFromToken = fromToken;
      let actualFromTokenMeta = fromTokenMeta;
      
      // For XFI to USDC swaps, we need to check native XFI balance, not WXFI
      if (fromToken === 'WXFI' && toToken === 'USDC') {
        console.log(`🔍 SwapService.validateSwap: XFI to USDC swap detected, checking native XFI balance`);
        actualFromToken = 'XFI';
        actualFromTokenMeta = getTokenBySymbol('XFI')!;
      }

      // Check balance
      let balance: bigint;
      if (actualFromTokenMeta.isNative) {
        // Check native token balance
        balance = await publicClient.getBalance({ address: userAddress });
        console.log(`🔍 SwapService.validateSwap: Native ${actualFromToken} balance: ${formatUnits(balance, actualFromTokenMeta.decimals)}`);
      } else {
        // Check ERC20 token balance
        balance = await publicClient.readContract({
          address: actualFromTokenMeta.address as Address,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [userAddress],
        }) as bigint;
        console.log(`🔍 SwapService.validateSwap: ERC20 ${actualFromToken} balance: ${formatUnits(balance, actualFromTokenMeta.decimals)}`);
      }

      const requiredAmount = parseUnits(fromAmount, fromTokenMeta.decimals);
      const balanceFormatted = formatUnits(balance, fromTokenMeta.decimals);

      if (balance < requiredAmount) {
        return {
          valid: false,
          error: `Insufficient ${actualFromToken} balance. Required: ${fromAmount}, Available: ${balanceFormatted}`,
          balance: balanceFormatted,
        };
      }

      // Check allowance for non-native tokens
      let allowance: bigint = 0n;
      let needsApproval = false;

      if (!fromTokenMeta.isNative) {
        allowance = await publicClient.readContract({
          address: fromTokenMeta.address as Address,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [userAddress, SWAP_ROUTER_ADDRESS as Address],
        }) as bigint;
        needsApproval = allowance < requiredAmount;
      }

      const warnings: string[] = [];
      if (needsApproval) {
        warnings.push(`Token approval required for ${fromToken}`);
      }

      return {
        valid: true,
        balance: balanceFormatted,
        allowance: formatUnits(allowance, fromTokenMeta.decimals),
        needsApproval,
        warnings,
      };
    } catch (error) {
      console.error('Error validating swap:', error);
      return {
        valid: false,
        error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Execute a token swap
   */
  static async executeSwap(user: IUser, params: SwapParams): Promise<SwapResult> {
    try {
      console.log(`🔄 SwapService.executeSwap: Starting swap execution`);
      console.log(`   User wallet: ${user.walletAddress}`);
      console.log(`   From: ${params.fromAmount} ${params.fromToken}`);
      console.log(`   To: ${params.toToken}`);
      console.log(`   Slippage: ${params.slippage}%`);

      console.log(`🔍 SwapService.executeSwap: Validating swap...`);
      // Validate swap first
      const validation = await this.validateSwap(user, params);
      console.log(`   Validation result: ${validation.valid ? '✅ Valid' : '❌ Invalid'}`);
      if (!validation.valid) {
        console.log(`   Validation error: ${validation.error}`);
        return {
          success: false,
          error: validation.error,
          errorCode: SwapErrorCode.INVALID_TOKEN_PAIR,
          fromAmount: params.fromAmount,
          fromToken: params.fromToken,
          toToken: params.toToken,
        };
      }

      console.log(`💰 SwapService.executeSwap: Getting swap quote...`);
      // Get swap quote
      const quote = await this.getSwapQuote(params);
      if (!quote) {
        console.log(`   ❌ Failed to get swap quote`);
        return {
          success: false,
          error: 'Failed to get swap quote',
          errorCode: SwapErrorCode.UNKNOWN_ERROR,
          fromAmount: params.fromAmount,
          fromToken: params.fromToken,
          toToken: params.toToken,
        };
      }
      console.log(`   ✅ Quote received: ${quote.fromAmountFormatted} → ${quote.toAmountFormatted}`);

      console.log(`🔐 SwapService.executeSwap: Checking approval...`);
      console.log(`   Needs approval: ${validation.needsApproval ? 'Yes' : 'No'}`);
      // Check if approval is needed
      if (validation.needsApproval) {
        console.log(`   🔐 Approving token: ${params.fromToken}`);
        const approvalResult = await this.approveToken(user, params.fromToken, params.fromAmount);
        console.log(`   Approval result: ${approvalResult.success ? '✅ Success' : '❌ Failed'}`);
        if (!approvalResult.success) {
          console.log(`   Approval error: ${approvalResult.error}`);
          return {
            success: false,
            error: `Token approval failed: ${approvalResult.error}`,
            errorCode: SwapErrorCode.INSUFFICIENT_ALLOWANCE,
            fromAmount: params.fromAmount,
            fromToken: params.fromToken,
            toToken: params.toToken,
          };
        }
        
        // Wait for the approval transaction to be processed with retries
        console.log(`   ⏳ Waiting for approval transaction to be processed...`);
        
        // Try multiple times with increasing delays
        let allowance: bigint = 0n;
        let retryCount = 0;
        const maxRetries = 5;
        
        while (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds each time
          retryCount++;
          
          try {
            const { getTokenBySymbol } = await import('../constants/tokens.js');
            const tokenMeta = getTokenBySymbol(params.fromToken);
            const requiredAmount = parseUnits(params.fromAmount, tokenMeta.decimals);
            allowance = await publicClient.readContract({
              address: tokenMeta.address as Address,
              abi: ERC20_ABI,
              functionName: 'allowance',
              args: [user.walletAddress as Address, SWAP_ROUTER_ADDRESS as Address],
            }) as bigint;
            
            console.log(`   🔍 Attempt ${retryCount}: Current allowance: ${formatUnits(allowance, tokenMeta.decimals)} ${params.fromToken}`);
            console.log(`   🔍 Required amount: ${formatUnits(requiredAmount, tokenMeta.decimals)} ${params.fromToken}`);
            
            if (allowance >= requiredAmount) {
              console.log(`   ✅ Sufficient allowance confirmed after ${retryCount} attempts`);
              break;
            } else if (retryCount === maxRetries) {
              console.log(`   ❌ Insufficient allowance after ${maxRetries} attempts`);
              return {
                success: false,
                error: `Insufficient allowance after approval. Required: ${formatUnits(requiredAmount, tokenMeta.decimals)}, Allowed: ${formatUnits(allowance, tokenMeta.decimals)}`,
                errorCode: SwapErrorCode.INSUFFICIENT_ALLOWANCE,
                fromAmount: params.fromAmount,
                fromToken: params.fromToken,
                toToken: params.toToken,
              };
            } else {
              console.log(`   ⏳ Retrying allowance check (${retryCount}/${maxRetries})...`);
            }
          } catch (error) {
            console.log(`   ⚠️ Error checking allowance (attempt ${retryCount}): ${error}`);
            if (retryCount === maxRetries) {
              console.log(`   ⚠️ Could not verify allowance after ${maxRetries} attempts, proceeding anyway`);
              break;
            }
          }
        }
      }

      // Check if we need to wrap native XFI to WXFI BEFORE the swap
      let wrapHash: string | undefined;
      let wrapGasUsed: string | undefined;
      let wrapGasPrice: string | undefined;
      
      // Check if this is an XFI to USDC swap (which needs XFI wrapped to WXFI first)
      const isXFIToUSDC = params.fromToken === 'WXFI' && params.toToken === 'USDC';
      const isWXFIInPath = quote.path.includes(TOKEN_ADDRESSES.WXFI as Address);
      
      console.log(`🔍 SwapService.executeSwap: Checking XFI wrapping...`);
      console.log(`   Is XFI to USDC swap: ${isXFIToUSDC}`);
      console.log(`   WXFI in path: ${isWXFIInPath}`);
      
      if (isXFIToUSDC && isWXFIInPath) {
        console.log(`🔄 Checking if we need to wrap native XFI to WXFI...`);
        
        try {
          // Check native XFI balance
          const nativeXfiBalance = await publicClient.getBalance({ address: user.walletAddress as Address });
          const requiredAmount = parseUnits(params.fromAmount, 18); // XFI has 18 decimals
          
          console.log(`   🔍 Native XFI balance: ${formatUnits(nativeXfiBalance, 18)} XFI`);
          console.log(`   🔍 Required amount: ${params.fromAmount} XFI`);
          
          if (nativeXfiBalance >= requiredAmount) {
            console.log(`🔄 Wrapping ${params.fromAmount} native XFI to WXFI...`);
            
            // Create wallet client for wrapping
            const walletClient = createWalletClientFromPrivateKey(user.encryptedPrivateKey);
            
            // Wrap native XFI to WXFI using deposit function
            wrapHash = await walletClient.writeContract({
              address: TOKEN_ADDRESSES.WXFI as Address,
              abi: [
                {"inputs":[],"name":"deposit","outputs":[],"stateMutability":"payable","type":"function"}
              ],
              functionName: 'deposit',
              value: requiredAmount,
              chain: undefined,
              account: walletClient.account,
            });
            
            console.log(`✅ XFI to WXFI wrapping submitted: ${wrapHash}`);
            
            // Wait for wrap transaction confirmation
            const wrapReceipt = await publicClient.waitForTransactionReceipt({ hash: wrapHash as `0x${string}` });
            wrapGasUsed = wrapReceipt.gasUsed?.toString();
            wrapGasPrice = wrapReceipt.effectiveGasPrice?.toString();
            
            console.log(`✅ XFI to WXFI wrapping confirmed: ${wrapHash}`);
          } else {
            console.log(`❌ Insufficient native XFI balance for wrapping`);
            return {
              success: false,
              error: `Insufficient native XFI balance. Required: ${params.fromAmount}, Available: ${formatUnits(nativeXfiBalance, 18)}`,
              errorCode: SwapErrorCode.INSUFFICIENT_BALANCE,
              fromAmount: params.fromAmount,
              fromToken: params.fromToken,
              toToken: params.toToken,
            };
          }
        } catch (error) {
          console.error('❌ Error wrapping XFI to WXFI:', error);
          return {
            success: false,
            error: `Failed to wrap XFI to WXFI: ${error instanceof Error ? error.message : 'Unknown error'}`,
            errorCode: SwapErrorCode.TRANSACTION_FAILED,
            fromAmount: params.fromAmount,
            fromToken: params.fromToken,
            toToken: params.toToken,
          };
        }
      }

      console.log(`🚀 SwapService.executeSwap: Executing swap transaction...`);
      // Execute the swap
      const swapResult = await this.executeSwapTransaction(user, quote, params);
      console.log(`   Swap result: ${swapResult.success ? '✅ Success' : '❌ Failed'}`);
      if (swapResult.success) {
        console.log(`   Transaction hash: ${swapResult.transactionHash}`);
        console.log(`   Wrap hash: ${wrapHash || 'None'}`);
        console.log(`   Unwrap hash: ${swapResult.unwrapTransactionHash || 'None'}`);
        
        // Add wrap transaction info to the result
        if (wrapHash) {
          swapResult.wrapTransactionHash = wrapHash;
          swapResult.wrapGasUsed = wrapGasUsed;
          swapResult.wrapGasPrice = wrapGasPrice;
        }
      } else {
        console.log(`   Error: ${swapResult.error}`);
        console.log(`   Error code: ${swapResult.errorCode}`);
      }
      return swapResult;
    } catch (error) {
      console.error('❌ SwapService.executeSwap: Error executing swap:', error);
      console.error('   Error message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('   Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: SwapErrorCode.UNKNOWN_ERROR,
        fromAmount: params.fromAmount,
        fromToken: params.fromToken,
        toToken: params.toToken,
      };
    }
  }

  /**
   * Approve token spending
   */
  private static async approveToken(user: IUser, tokenSymbol: string, amount: string): Promise<{ success: boolean; error?: string }> {
    try {
      const tokenMeta = getTokenBySymbol(tokenSymbol);
      if (!tokenMeta || tokenMeta.isNative) {
        return { success: true }; // No approval needed for native tokens
      }

      // Use the user's wallet for approval
      if (!user.encryptedPrivateKey) {
        return { success: false, error: 'User wallet not configured' };
      }

      const walletClient = createWalletClientFromPrivateKey(user.encryptedPrivateKey);
      if (!walletClient) {
        return { success: false, error: 'Failed to create wallet client' };
      }

      const amountWei = parseUnits(amount, tokenMeta.decimals);
      
      // Add 10% buffer to approval amount to account for fees and slippage
      const approvalAmount = amountWei * 110n / 100n;
      console.log(`🔐 SwapService.approveToken: Approving ${formatUnits(approvalAmount, tokenMeta.decimals)} ${tokenSymbol} (with 10% buffer)`);

      // Approve router to spend tokens from user's wallet
      const hash = await walletClient.writeContract({
        address: tokenMeta.address as Address,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [SWAP_ROUTER_ADDRESS as Address, approvalAmount],
        chain: undefined,
        account: walletClient.account,
      });

      console.log(`✅ Token approval successful for user ${user.walletAddress}: ${hash}`);
      return { success: true };
    } catch (error) {
      console.error('Error approving token:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute the actual swap transaction
   */
  private static async executeSwapTransaction(
    user: IUser, 
    quote: SwapQuote, 
    params: SwapParams
  ): Promise<SwapResult> {
    try {
      console.log(`🔄 SwapService.executeSwapTransaction: Starting transaction execution`);
      console.log(`   User wallet: ${user.walletAddress}`);
      console.log(`   Quote path: ${quote.path.join(' -> ')}`);
      console.log(`   Expected output: ${quote.toAmountFormatted} ${params.toToken}`);
      
      // Use the user's wallet for the transaction
      if (!user.encryptedPrivateKey) {
        console.log(`❌ SwapService.executeSwapTransaction: User wallet not configured`);
        return {
          success: false,
          error: 'User wallet not configured',
          errorCode: SwapErrorCode.UNKNOWN_ERROR,
          fromAmount: params.fromAmount,
          fromToken: params.fromToken,
          toToken: params.toToken,
        };
      }

      console.log(`🔑 SwapService.executeSwapTransaction: Creating wallet client...`);
      const walletClient = createWalletClientFromPrivateKey(user.encryptedPrivateKey);
      if (!walletClient) {
        console.log(`❌ SwapService.executeSwapTransaction: Failed to create wallet client`);
        return {
          success: false,
          error: 'Failed to create wallet client',
          errorCode: SwapErrorCode.UNKNOWN_ERROR,
          fromAmount: params.fromAmount,
          fromToken: params.fromToken,
          toToken: params.toToken,
        };
      }
      console.log(`✅ SwapService.executeSwapTransaction: Wallet client created successfully`);

      console.log(`🔍 SwapService.executeSwapTransaction: Getting token metadata...`);
      const fromTokenMeta = getTokenBySymbol(params.fromToken);
      const toTokenMeta = getTokenBySymbol(params.toToken);
      console.log(`   From token: ${params.fromToken} (${fromTokenMeta ? 'Found' : 'Not found'})`);
      console.log(`   To token: ${params.toToken} (${toTokenMeta ? 'Found' : 'Not found'})`);

      if (!fromTokenMeta || !toTokenMeta) {
        console.log(`❌ SwapService.executeSwapTransaction: Invalid token metadata`);
        return {
          success: false,
          error: 'Invalid token metadata',
          errorCode: SwapErrorCode.INVALID_TOKEN_PAIR,
          fromAmount: params.fromAmount,
          fromToken: params.fromToken,
          toToken: params.toToken,
        };
      }

      const fromAmountWei = parseUnits(params.fromAmount, fromTokenMeta.decimals);
      const minimumReceivedWei = parseUnits(quote.minimumReceived, toTokenMeta.decimals);
      const recipient = (params.recipient || user.walletAddress) as Address;

      let hash: string;

      if (fromTokenMeta.isNative) {
        // Swap ETH for tokens
        hash = await walletClient.writeContract({
          address: SWAP_ROUTER_ADDRESS as Address,
          abi: SWAP_ROUTER_ABI,
          functionName: 'swapExactETHForTokens',
          args: [
            minimumReceivedWei,
            quote.path,
            recipient,
            BigInt(quote.deadline)
          ],
          value: fromAmountWei,
        } as any);
      } else if (toTokenMeta.isNative) {
        // Swap tokens for ETH
        hash = await walletClient.writeContract({
          address: SWAP_ROUTER_ADDRESS as Address,
          abi: SWAP_ROUTER_ABI,
          functionName: 'swapExactTokensForETH',
          args: [
            fromAmountWei,
            minimumReceivedWei,
            quote.path,
            recipient,
            BigInt(quote.deadline)
          ],
        } as any);
      } else {
        // Swap tokens for tokens
        hash = await walletClient.writeContract({
          address: SWAP_ROUTER_ADDRESS as Address,
          abi: SWAP_ROUTER_ABI,
          functionName: 'swapExactTokensForTokens',
          args: [
            fromAmountWei,
            minimumReceivedWei,
            quote.path,
            recipient,
            BigInt(quote.deadline)
          ],
        } as any);
      }



      console.log(`✅ Swap transaction submitted: ${hash}`);

      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });

      // Check if we need to convert WXFI to native XFI
      let unwrapHash: string | undefined;
      let unwrapGasUsed: string | undefined;
      let unwrapGasPrice: string | undefined;
      
      // Check if this was originally a USDC to XFI swap (which maps to WXFI)
      const isUSDCToXFI = params.fromToken === 'USDC' && params.toToken === 'WXFI';
      const isWXFIInPath = quote.path.includes(TOKEN_ADDRESSES.WXFI as Address);
      
      console.log(`🔍 SwapService.executeSwapTransaction: Checking WXFI conversion...`);
      console.log(`   Is USDC to XFI swap: ${isUSDCToXFI}`);
      console.log(`   WXFI in path: ${isWXFIInPath}`);
      
      if (isUSDCToXFI && isWXFIInPath) {
        console.log(`🔄 Converting WXFI to native XFI...`);
        
        try {
          // Get the actual WXFI amount received from the swap
          const wxfiBalance = await publicClient.readContract({
            address: TOKEN_ADDRESSES.WXFI as Address,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [user.walletAddress as Address],
          }) as bigint;
          
          if (wxfiBalance > 0n) {
            // Convert WXFI to native XFI using withdraw function
            unwrapHash = await walletClient.writeContract({
              address: TOKEN_ADDRESSES.WXFI as Address,
              abi: [
                {"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"}
              ],
              functionName: 'withdraw',
              args: [wxfiBalance],
              chain: undefined,
              account: walletClient.account,
            });
            
            console.log(`✅ WXFI to XFI conversion submitted: ${unwrapHash}`);
            
            // Wait for unwrap transaction confirmation
            const unwrapReceipt = await publicClient.waitForTransactionReceipt({ hash: unwrapHash as `0x${string}` });
            unwrapGasUsed = unwrapReceipt.gasUsed?.toString();
            unwrapGasPrice = unwrapReceipt.effectiveGasPrice?.toString();
            
            console.log(`✅ WXFI to XFI conversion confirmed: ${unwrapHash}`);
          }
        } catch (error) {
          console.error('❌ Error converting WXFI to XFI:', error);
          // Don't fail the entire swap if unwrap fails - user still has WXFI
        }
      } else {
        console.log(`⏭️ Skipping WXFI conversion - not a USDC to XFI swap or WXFI not in path`);
      }

      return {
        success: true,
        transactionHash: hash,
        unwrapTransactionHash: unwrapHash,
        fromAmount: params.fromAmount,
        toAmount: quote.toAmount,
        fromToken: params.fromToken,
        toToken: params.toToken,
        gasUsed: receipt.gasUsed?.toString(),
        gasPrice: receipt.effectiveGasPrice?.toString(),
        unwrapGasUsed,
        unwrapGasPrice,
        finalToken: unwrapHash ? 'XFI (native)' : params.toToken,
      };
    } catch (error) {
      console.error('Error executing swap transaction:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: SwapErrorCode.TRANSACTION_FAILED,
        fromAmount: params.fromAmount,
        fromToken: params.fromToken,
        toToken: params.toToken,
      };
    }
  }

  /**
   * Get supported token pairs
   */
  static getSupportedPairs(): Array<{ from: string; to: string; description: string }> {
    const pairs: Array<{ from: string; to: string; description: string }> = [];
    const tokens = SWAP_CONFIG.SUPPORTED_TOKENS;

    for (let i = 0; i < tokens.length; i++) {
      for (let j = 0; j < tokens.length; j++) {
        if (i !== j) {
          pairs.push({
            from: tokens[i],
            to: tokens[j],
            description: `Swap ${tokens[i]} for ${tokens[j]}`,
          });
        }
      }
    }

    return pairs;
  }

  /**
   * Get swap configuration
   */
  static getSwapConfig() {
    return SWAP_CONFIG;
  }
} 