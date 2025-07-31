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

      // Check balance
      let balance: bigint;
      if (fromTokenMeta.isNative) {
        // Check native token balance
        balance = await publicClient.getBalance({ address: userAddress });
      } else {
        // Check ERC20 token balance
        balance = await publicClient.readContract({
          address: fromTokenMeta.address as Address,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [userAddress],
        }) as bigint;
      }

      const requiredAmount = parseUnits(fromAmount, fromTokenMeta.decimals);
      const balanceFormatted = formatUnits(balance, fromTokenMeta.decimals);

      if (balance < requiredAmount) {
        return {
          valid: false,
          error: `Insufficient ${fromToken} balance. Required: ${fromAmount}, Available: ${balanceFormatted}`,
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
      console.log(`🔄 Executing swap: ${params.fromAmount} ${params.fromToken} -> ${params.toToken}`);

      // Validate swap first
      const validation = await this.validateSwap(user, params);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          errorCode: SwapErrorCode.INVALID_TOKEN_PAIR,
          fromAmount: params.fromAmount,
          fromToken: params.fromToken,
          toToken: params.toToken,
        };
      }

      // Get swap quote
      const quote = await this.getSwapQuote(params);
      if (!quote) {
        return {
          success: false,
          error: 'Failed to get swap quote',
          errorCode: SwapErrorCode.UNKNOWN_ERROR,
          fromAmount: params.fromAmount,
          fromToken: params.fromToken,
          toToken: params.toToken,
        };
      }

      // Check if approval is needed
      if (validation.needsApproval) {
        const approvalResult = await this.approveToken(user, params.fromToken, params.fromAmount);
        if (!approvalResult.success) {
          return {
            success: false,
            error: `Token approval failed: ${approvalResult.error}`,
            errorCode: SwapErrorCode.INSUFFICIENT_ALLOWANCE,
            fromAmount: params.fromAmount,
            fromToken: params.fromToken,
            toToken: params.toToken,
          };
        }
      }

      // Execute the swap
      const swapResult = await this.executeSwapTransaction(user, quote, params);
      return swapResult;
    } catch (error) {
      console.error('Error executing swap:', error);
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

      // For now, we'll use the funding wallet for testing
      // In production, you'd need to handle user wallet signing
      const fundingPrivateKey = process.env.FUNDING_PRIVATE_KEY;
      if (!fundingPrivateKey) {
        return { success: false, error: 'Funding wallet not configured' };
      }

      const walletClient = createWalletClientFromPrivateKey(fundingPrivateKey);
      if (!walletClient) {
        return { success: false, error: 'Failed to create wallet client' };
      }

      const amountWei = parseUnits(amount, tokenMeta.decimals);

      // Approve router to spend tokens
      const hash = await walletClient.writeContract({
        address: tokenMeta.address as Address,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [SWAP_ROUTER_ADDRESS as Address, amountWei],
        chain: undefined,
        account: walletClient.account,
      });

      console.log(`✅ Token approval successful: ${hash}`);
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
      // Use the user's wallet for the transaction
      if (!user.encryptedPrivateKey) {
        return {
          success: false,
          error: 'User wallet not configured',
          errorCode: SwapErrorCode.UNKNOWN_ERROR,
          fromAmount: params.fromAmount,
          fromToken: params.fromToken,
          toToken: params.toToken,
        };
      }

      const walletClient = createWalletClientFromPrivateKey(user.encryptedPrivateKey);
      if (!walletClient) {
        return {
          success: false,
          error: 'Failed to create wallet client',
          errorCode: SwapErrorCode.UNKNOWN_ERROR,
          fromAmount: params.fromAmount,
          fromToken: params.fromToken,
          toToken: params.toToken,
        };
      }

      const fromTokenMeta = getTokenBySymbol(params.fromToken);
      const toTokenMeta = getTokenBySymbol(params.toToken);

      if (!fromTokenMeta || !toTokenMeta) {
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

      return {
        success: true,
        transactionHash: hash,
        fromAmount: params.fromAmount,
        toAmount: quote.toAmount,
        fromToken: params.fromToken,
        toToken: params.toToken,
        gasUsed: receipt.gasUsed?.toString(),
        gasPrice: receipt.effectiveGasPrice?.toString(),
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