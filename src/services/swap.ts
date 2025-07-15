import { parseUnits, formatUnits, type Address } from 'viem';
import { publicClient, createWalletClientFromPrivateKey, getWalletClientFromUser } from '../config/viem.js';
import { TokenService } from './tokens.js';
import { PriceAnalyticsService } from './price-analytics.js';
import { IUser } from '../models/User.js';
import { TOKEN_ADDRESSES, TOKEN_METADATA, SWAP_CONFIG } from '../constants/tokens.js';
import { ERC20_ABI } from '../constants/abi.js';
import { SWAP_CONTRACT_ADDRESS, SWAP_CONTRACT_ABI } from '../constants/contract.js';

export interface SwapQuote {
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  fromAmountFormatted: string;
  toAmountFormatted: string;
  price: number;
  slippage: number;
  minimumReceived: string;
  minimumReceivedFormatted: string;
  gasFee: string;
  gasFeeFormatted: string;
}

export interface SwapResult {
  success: boolean;
  transactionHash?: string;
  fromAmount?: string;
  toAmount?: string;
  actualPrice?: number;
  error?: string;
}

export interface SwapValidation {
  valid: boolean;
  error?: string;
  balanceCheck?: {
    sufficient: boolean;
    balance: string;
    required: string;
    shortfall?: string;
  };
}

export class SwapService {
  /**
   * Get current XFI price in USD from the contract
   */
  private static async getXFIPrice(): Promise<number> {
    try {
      // Get XFI price from our deployed contract
      const priceResult = await publicClient.readContract({
        address: SWAP_CONTRACT_ADDRESS as Address,
        abi: SWAP_CONTRACT_ABI,
        functionName: 'getCurrentXFIPrice',
        args: [],
      });
      
      // Convert from wei to USD (price is returned in wei per XFI)
      const priceInUSD = formatUnits(priceResult as bigint, 6); // tUSDC has 6 decimals
      return parseFloat(priceInUSD);
    } catch (error) {
      console.error('Error getting XFI price from contract:', error);
      // Fallback to external API if contract fails
      try {
        const marketData = await PriceAnalyticsService.getMarketData();
        return marketData.current_price;
      } catch (fallbackError) {
        console.error('Fallback price API also failed:', fallbackError);
        return 0.082; // Ultimate fallback price
      }
    }
  }

  /**
   * Check if the contract has sufficient liquidity for a swap
   */
  private static async checkLiquidity(): Promise<{ hasLiquidity: boolean; xfiReserve: string; tUSDCReserve: string }> {
    try {
      // Get reserves using the getReserves function
      const reserves = await publicClient.readContract({
        address: SWAP_CONTRACT_ADDRESS as Address,
        abi: SWAP_CONTRACT_ABI,
        functionName: 'getReserves',
        args: [],
      }) as readonly [bigint, bigint];
      
      const xfiReserve = reserves[0];
      const tUSDCReserve = reserves[1];
      
      const xfiReserveFormatted = formatUnits(xfiReserve, 18);
      const tUSDCReserveFormatted = formatUnits(tUSDCReserve, 6);
      
      const hasLiquidity = parseFloat(xfiReserveFormatted) > 0 && parseFloat(tUSDCReserveFormatted) > 0;
      
      return {
        hasLiquidity,
        xfiReserve: xfiReserveFormatted,
        tUSDCReserve: tUSDCReserveFormatted,
      };
    } catch (error) {
      console.error('Error checking liquidity:', error);
      return {
        hasLiquidity: false,
        xfiReserve: '0',
        tUSDCReserve: '0',
      };
    }
  }

  /**
   * Calculate swap amounts and create quote using real contract
   */
  static async getSwapQuote(
    fromToken: string,
    toToken: string,
    fromAmount: string,
    slippage: number = 5
  ): Promise<SwapQuote> {
    try {
      const fromTokenMeta = Object.values(TOKEN_METADATA).find(
        t => t.symbol === fromToken || t.address.toLowerCase() === fromToken.toLowerCase()
      );
      const toTokenMeta = Object.values(TOKEN_METADATA).find(
        t => t.symbol === toToken || t.address.toLowerCase() === toToken.toLowerCase()
      );

      if (!fromTokenMeta || !toTokenMeta) {
        throw new Error('Token not found');
      }

      // Check if contract has liquidity and get reserves
      const liquidityCheck = await this.checkLiquidity();
      if (!liquidityCheck.hasLiquidity) {
        throw new Error('No liquidity available in the pool. Please add liquidity first.');
      }

      // Parse amount with correct decimals
      const fromAmountParsed = parseUnits(fromAmount, fromTokenMeta.decimals);
      
      let toAmountBigInt: bigint;
      let price: number;

      // Get reserves for pricing calculations
      const xfiReserve = parseUnits(liquidityCheck.xfiReserve, 18);
      const tUSDCReserve = parseUnits(liquidityCheck.tUSDCReserve, 6);
      
      // Get quote from the actual swap contract using correct 3-parameter signature
      if (fromToken === 'tUSDC' && toToken === 'XFI') {
        // Buy XFI with tUSDC - getAmountOut(tUSDCIn, tUSDCReserve, XFIReserve)
        const result = await publicClient.readContract({
          address: SWAP_CONTRACT_ADDRESS as Address,
          abi: SWAP_CONTRACT_ABI,
          functionName: 'getAmountOut',
          args: [fromAmountParsed, tUSDCReserve, xfiReserve],
        });
        toAmountBigInt = result as bigint;
        
        // Calculate price (tUSDC per XFI)
        const xfiAmount = formatUnits(toAmountBigInt, 18);
        price = parseFloat(fromAmount) / parseFloat(xfiAmount);
      } else if (fromToken === 'XFI' && toToken === 'tUSDC') {
        // Sell XFI for tUSDC - getAmountOut(XFIIn, XFIReserve, tUSDCReserve)
        const result = await publicClient.readContract({
          address: SWAP_CONTRACT_ADDRESS as Address,
          abi: SWAP_CONTRACT_ABI,
          functionName: 'getAmountOut',
          args: [fromAmountParsed, xfiReserve, tUSDCReserve],
        });
        toAmountBigInt = result as bigint;
        
        // Calculate price (tUSDC per XFI)
        const tUSDCAmount = formatUnits(toAmountBigInt, 6);
        price = parseFloat(tUSDCAmount) / parseFloat(fromAmount);
      } else {
        throw new Error('Unsupported swap pair');
      }

      // Format output amount
      const toAmount = formatUnits(toAmountBigInt, toTokenMeta.decimals);
      
      // Apply slippage to minimum received
      const slippageMultiplier = (100 - slippage) / 100;
      const minimumReceived = (parseFloat(toAmount) * slippageMultiplier).toString();

      // Estimate gas fee (realistic for CrossFI)
      const gasFee = '0.002'; // 0.002 XFI estimated gas for swap

      return {
        fromToken: fromTokenMeta.symbol,
        toToken: toTokenMeta.symbol,
        fromAmount,
        toAmount,
        fromAmountFormatted: fromAmount,
        toAmountFormatted: parseFloat(toAmount).toFixed(6),
        price,
        slippage,
        minimumReceived,
        minimumReceivedFormatted: parseFloat(minimumReceived).toFixed(6),
        gasFee,
        gasFeeFormatted: gasFee,
      };
    } catch (error) {
      console.error('Error getting swap quote:', error);
      throw new Error('Failed to get swap quote');
    }
  }

  /**
   * Validate swap parameters and user balance
   */
  static async validateSwap(
    user: IUser,
    fromToken: string,
    fromAmount: string,
    slippage: number
  ): Promise<SwapValidation> {
    try {
      // Validate slippage
      if (slippage < 0.1 || slippage > 50) {
        return {
          valid: false,
          error: 'Slippage must be between 0.1% and 50%',
        };
      }

      // Validate amount
      const amount = parseFloat(fromAmount);
      if (amount <= 0) {
        return {
          valid: false,
          error: 'Amount must be greater than 0',
        };
      }

      // Get token metadata
      const fromTokenMeta = Object.values(TOKEN_METADATA).find(
        t => t.symbol === fromToken || t.address.toLowerCase() === fromToken.toLowerCase()
      );

      if (!fromTokenMeta) {
        return {
          valid: false,
          error: 'Token not found',
        };
      }

      // Check balance
      const balanceCheck = await TokenService.validateSufficientBalance(
        fromTokenMeta.address,
        user.walletAddress,
        fromAmount,
        true // Include gas
      );

      if (!balanceCheck.sufficient) {
        return {
          valid: false,
          error: `Insufficient balance. Required: ${balanceCheck.required}, Available: ${balanceCheck.balance}`,
          balanceCheck,
        };
      }

      return { valid: true, balanceCheck };
    } catch (error) {
      console.error('Error validating swap:', error);
      return {
        valid: false,
        error: 'Failed to validate swap',
      };
    }
  }

  /**
   * Execute token swap
   */
  static async executeSwap(
    user: IUser,
    fromToken: string,
    toToken: string,
    fromAmount: string,
    slippage: number = 5,
    maxSlippage: number = 10
  ): Promise<SwapResult> {
    try {
      // Validate swap first
      const validation = await this.validateSwap(user, fromToken, fromAmount, slippage);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
        };
      }

      // Get quote
      const quote = await this.getSwapQuote(fromToken, toToken, fromAmount, slippage);
      
      // Get current price to check for significant changes
      const currentPrice = await this.getXFIPrice();
      const priceChangePercentage = Math.abs((currentPrice - quote.price) / quote.price) * 100;
      
      if (priceChangePercentage > maxSlippage) {
        return {
          success: false,
          error: `Price changed by ${priceChangePercentage.toFixed(2)}% since quote. Please try again.`,
        };
      }

      const fromTokenMeta = Object.values(TOKEN_METADATA).find(t => t.symbol === fromToken);
      const toTokenMeta = Object.values(TOKEN_METADATA).find(t => t.symbol === toToken);

      if (!fromTokenMeta || !toTokenMeta) {
        return {
          success: false,
          error: 'Token metadata not found',
        };
      }

      // For this simplified implementation, we'll execute two separate transactions:
      // 1. Send fromToken to a "swap contract" address (using a dummy address for now)
      // 2. Send toToken from the "swap contract" to user
      // In production, this would be replaced with actual DEX/swap contract interactions

      let result: SwapResult;

      if (fromToken === 'tUSDC' && toToken === 'XFI') {
        // Buy XFI with tUSDC
        result = await this.executeTUSDCToXFISwap(user, fromAmount, quote);
      } else if (fromToken === 'XFI' && toToken === 'tUSDC') {
        // Sell XFI for tUSDC
        result = await this.executeXFIToTUSDCSwap(user, fromAmount, quote);
      } else {
        return {
          success: false,
          error: 'Unsupported swap pair',
        };
      }

      return result;
    } catch (error: any) {
      console.error('Error executing swap:', error);
      return {
        success: false,
        error: error.message || 'Failed to execute swap',
      };
    }
  }

  /**
   * Execute tUSDC to XFI swap using real contract
   */
  private static async executeTUSDCToXFISwap(
    user: IUser,
    tUSDCAmount: string,
    quote: SwapQuote
  ): Promise<SwapResult> {
    try {
      console.log(`Executing tUSDC to XFI swap: ${tUSDCAmount} tUSDC -> ${quote.toAmount} XFI`);
      
      // Create wallet client for this user
      const walletClient = createWalletClientFromPrivateKey(user.encryptedPrivateKey);
      
      // Get token metadata
      const tUSDCMeta = TOKEN_METADATA.tUSDC;
      const tUSDCAmount_BigInt = parseUnits(tUSDCAmount, tUSDCMeta.decimals);
      
      // Calculate minimum XFI to receive (with slippage)
      const minXFIAmount = parseUnits(quote.minimumReceived, 18);
      
      // Step 1: Approve tUSDC spending by swap contract
      console.log('Step 1: Approving tUSDC spending...');
      const approvalHash = await walletClient.writeContract({
        address: TOKEN_ADDRESSES.tUSDC as Address,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [SWAP_CONTRACT_ADDRESS, tUSDCAmount_BigInt],
      } as any);
      
      // Wait for approval confirmation
      const approvalReceipt = await publicClient.waitForTransactionReceipt({ hash: approvalHash });
      if (approvalReceipt.status !== 'success') {
        throw new Error('Approval transaction failed');
      }
      
      // Step 2: Execute swap tUSDC for XFI
      console.log('Step 2: Executing tUSDC to XFI swap...');
      const swapHash = await walletClient.writeContract({
        address: SWAP_CONTRACT_ADDRESS as Address,
        abi: SWAP_CONTRACT_ABI,
        functionName: 'swapTUSDCForXFI',
        args: [tUSDCAmount_BigInt, minXFIAmount], // tusdcIn, minXFIOut
      } as any);

      // Wait for swap transaction confirmation
      const swapReceipt = await publicClient.waitForTransactionReceipt({ hash: swapHash });
      
      if (swapReceipt.status === 'success') {
        console.log(`✅ tUSDC to XFI swap successful. Transaction: ${swapReceipt.transactionHash}`);
        return {
          success: true,
          transactionHash: swapReceipt.transactionHash,
          fromAmount: tUSDCAmount,
          toAmount: quote.toAmount,
          actualPrice: quote.price,
        };
      } else {
        throw new Error('Swap transaction failed');
      }
    } catch (error: any) {
      console.error('Error executing tUSDC to XFI swap:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Execute XFI to tUSDC swap using real contract
   */
  private static async executeXFIToTUSDCSwap(
    user: IUser,
    xfiAmount: string,
    quote: SwapQuote
  ): Promise<SwapResult> {
    try {
      console.log(`Executing XFI to tUSDC swap: ${xfiAmount} XFI -> ${quote.toAmount} tUSDC`);
      
      // Create wallet client for this user
      const walletClient = createWalletClientFromPrivateKey(user.encryptedPrivateKey);
      
      // Convert XFI amount to wei
      const xfiAmount_BigInt = parseUnits(xfiAmount, 18);
      
      // Calculate minimum tUSDC to receive (with slippage)
      const minTUSDCAmount = parseUnits(quote.minimumReceived, 6);
      
      // Execute XFI to tUSDC swap (XFI is sent as value in transaction)
      console.log('Executing XFI to tUSDC swap...');
      const swapHash = await walletClient.writeContract({
        address: SWAP_CONTRACT_ADDRESS as Address,
        abi: SWAP_CONTRACT_ABI,
        functionName: 'swapXFIForTUSDC',
        args: [minTUSDCAmount],
        value: xfiAmount_BigInt, // XFI amount sent as value
      } as any);

      // Wait for swap transaction confirmation
      const swapReceipt = await publicClient.waitForTransactionReceipt({ hash: swapHash });
      
      if (swapReceipt.status === 'success') {
        console.log(`✅ XFI to tUSDC swap successful. Transaction: ${swapReceipt.transactionHash}`);
        return {
          success: true,
          transactionHash: swapReceipt.transactionHash,
          fromAmount: xfiAmount,
          toAmount: quote.toAmount,
          actualPrice: quote.price,
        };
      } else {
        throw new Error('Swap transaction failed');
      }
    } catch (error: any) {
      console.error('Error executing XFI to tUSDC swap:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get swap history for a user (placeholder for future implementation)
   */
  static async getSwapHistory(
    userId: string,
    limit: number = 10
  ): Promise<any[]> {
    // This would query a database of swap transactions
    // For now, return empty array

    return [];
  }

  /**
   * Get best swap route (for future multi-hop swaps)
   */
  static async getBestSwapRoute(
    fromToken: string,
    toToken: string,
    amount: string
  ): Promise<SwapQuote> {
    // For now, we only support direct swaps
    // Future implementation could include multi-hop routing
    return await this.getSwapQuote(fromToken, toToken, amount);
  }

  /**
   * Calculate price impact of a swap
   */
  static async calculatePriceImpact(
    fromToken: string,
    toToken: string,
    amount: string
  ): Promise<number> {
    try {
      // For simple direct swaps, price impact is minimal
      // In DEX implementations, this would calculate based on liquidity pools
      const largeAmount = (parseFloat(amount) * 10).toString();
      
      const normalQuote = await this.getSwapQuote(fromToken, toToken, amount);
      const largeQuote = await this.getSwapQuote(fromToken, toToken, largeAmount);
      
      const normalPrice = parseFloat(normalQuote.toAmount) / parseFloat(normalQuote.fromAmount);
      const largePrice = parseFloat(largeQuote.toAmount) / parseFloat(largeQuote.fromAmount);
      
      const priceImpact = Math.abs((largePrice - normalPrice) / normalPrice) * 100;
      
      return Math.min(priceImpact, 0.1); // Cap at 0.1% for direct swaps
    } catch (error) {
      console.error('Error calculating price impact:', error);
      return 0;
    }
  }

  /**
   * Get estimated gas fee for swap
   */
  static async getSwapGasFee(
    fromToken: string,
    toToken: string
  ): Promise<{ gasFee: string; gasFeeFormatted: string }> {
    try {
      // Simplified gas estimation
      // ERC20 to native: higher gas (approval + swap)
      // Native to ERC20: lower gas (just swap)
      
      const baseGas = fromToken === 'tUSDC' ? '0.002' : '0.001'; // XFI
      
      return {
        gasFee: baseGas,
        gasFeeFormatted: baseGas,
      };
    } catch (error) {
      console.error('Error estimating gas fee:', error);
      return {
        gasFee: '0.001',
        gasFeeFormatted: '0.001',
      };
    }
  }

  /**
   * Add liquidity to the swap contract
   */
  static async addLiquidity(
    user: IUser,
    xfiAmount: string,
    tUSDCAmount: string,
    slippage: number = 5
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
      console.log(`Adding liquidity: ${xfiAmount} XFI + ${tUSDCAmount} tUSDC`);
      
      // Create wallet client for this user
      const walletClient = createWalletClientFromPrivateKey(user.encryptedPrivateKey);
      
      // Parse amounts
      const xfiAmountParsed = parseUnits(xfiAmount, 18);
      const tUSDCAmountParsed = parseUnits(tUSDCAmount, 6);
      
      // Calculate minimum amounts with slippage
      const slippageMultiplier = (100 - slippage) / 100;
      const minXFIAmount = parseUnits((parseFloat(xfiAmount) * slippageMultiplier).toString(), 18);
      const minTUSDCAmount = parseUnits((parseFloat(tUSDCAmount) * slippageMultiplier).toString(), 6);
      
      // Step 1: Approve tUSDC spending
      console.log('Step 1: Approving tUSDC spending for liquidity...');
      const approvalHash = await walletClient.writeContract({
        address: TOKEN_ADDRESSES.tUSDC as Address,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [SWAP_CONTRACT_ADDRESS, tUSDCAmountParsed],
      } as any);
      
      // Wait for approval
      const approvalReceipt = await publicClient.waitForTransactionReceipt({ hash: approvalHash });
      if (approvalReceipt.status !== 'success') {
        throw new Error('Approval transaction failed');
      }
      
      // Step 2: Add liquidity
      console.log('Step 2: Adding liquidity...');
      const liquidityHash = await walletClient.writeContract({
        address: SWAP_CONTRACT_ADDRESS as Address,
        abi: SWAP_CONTRACT_ABI,
        functionName: 'addLiquidity',
        args: [tUSDCAmountParsed, minXFIAmount, minTUSDCAmount],
        value: xfiAmountParsed, // XFI amount sent as value
      } as any);

      // Wait for liquidity transaction
      const liquidityReceipt = await publicClient.waitForTransactionReceipt({ hash: liquidityHash });
      
      if (liquidityReceipt.status === 'success') {
        console.log(`✅ Liquidity added successfully. Transaction: ${liquidityReceipt.transactionHash}`);
        return {
          success: true,
          transactionHash: liquidityReceipt.transactionHash,
        };
      } else {
        throw new Error('Liquidity transaction failed');
      }
    } catch (error: any) {
      console.error('Error adding liquidity:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
} 