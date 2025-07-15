import { parseUnits, formatUnits, type Address, type Hex } from 'viem';
import { publicClient, createWalletClientFromPrivateKey } from '../config/viem.js';
import { ERC20_ABI } from '../constants/abi.js';
import { TOKEN_ADDRESSES, TOKEN_METADATA, getTokenBySymbol } from '../constants/tokens.js';
import { IUser } from '../models/User.js';

export interface TokenBalance {
  address: string;
  balance: string;
  formatted: string;
  symbol: string;
  decimals: number;
}

export interface TokenTransferResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

export interface TokenApprovalResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

export class TokenService {
  /**
   * Verify if a contract exists and implements basic ERC20 functions
   */
  static async verifyERC20Contract(tokenAddress: string): Promise<{ exists: boolean; isERC20: boolean; details?: any }> {
    try {
      console.log(`Verifying contract at ${tokenAddress}`);
      
      // First check if there's code at the address
      const code = await publicClient.getBytecode({ address: tokenAddress as Address });
      
      if (!code || code === '0x') {
        console.log(`No contract code found at ${tokenAddress}`);
        return { exists: false, isERC20: false, details: { reason: 'No contract code' } };
      }

      // Try to call basic ERC20 functions
      try {
        const [name, symbol, decimals] = await Promise.all([
          publicClient.readContract({
            address: tokenAddress as Address,
            abi: ERC20_ABI,
            functionName: 'name',
            args: [],
          }),
          publicClient.readContract({
            address: tokenAddress as Address,
            abi: ERC20_ABI,
            functionName: 'symbol',
            args: [],
          }),
          publicClient.readContract({
            address: tokenAddress as Address,
            abi: ERC20_ABI,
            functionName: 'decimals',
            args: [],
          }),
        ]);

        console.log(`Contract verification successful for ${tokenAddress}:`, { name, symbol, decimals });
        return { 
          exists: true, 
          isERC20: true, 
          details: { name, symbol, decimals } 
        };
      } catch (erc20Error) {
        console.log(`Contract exists at ${tokenAddress} but doesn't implement ERC20:`, erc20Error);
        return { 
          exists: true, 
          isERC20: false, 
          details: { reason: 'Not ERC20 compatible', error: erc20Error } 
        };
      }
    } catch (error) {
      console.error(`Error verifying contract at ${tokenAddress}:`, error);
      return { 
        exists: false, 
        isERC20: false, 
        details: { reason: 'Verification failed', error } 
      };
    }
  }
  /**
   * Get ERC20 token balance for an address
   */
  static async getTokenBalance(tokenAddress: string, walletAddress: string): Promise<TokenBalance> {
    try {
      // Handle native XFI token
      if (tokenAddress === TOKEN_ADDRESSES.XFI || tokenAddress === '0x0000000000000000000000000000000000000000') {
        const balance = await publicClient.getBalance({ address: walletAddress as Address });
        return {
          address: walletAddress,
          balance: balance.toString(),
          formatted: formatUnits(balance, 18),
          symbol: 'XFI',
          decimals: 18,
        };
      }

      // Try to get token metadata from our constants first
      const knownToken = Object.values(TOKEN_METADATA).find(
        t => t.address.toLowerCase() === tokenAddress.toLowerCase()
      );

      if (knownToken) {
        try {
  
          
          // For known tokens, only get the balance and use our metadata
          const balance = await publicClient.readContract({
            address: tokenAddress as Address,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [walletAddress as Address],
          }) as bigint;

          

          return {
            address: walletAddress,
            balance: balance.toString(),
            formatted: formatUnits(balance, knownToken.decimals),
            symbol: knownToken.symbol,
            decimals: knownToken.decimals,
          };
        } catch (balanceError) {
          console.error(`Error getting balance for known token ${knownToken.symbol} at ${tokenAddress}:`, balanceError);
          console.error('Balance error details:', {
            tokenAddress,
            walletAddress,
            knownTokenDecimals: knownToken.decimals,
            errorMessage: balanceError instanceof Error ? balanceError.message : 'Unknown error'
          });
          
          // Return zero balance if contract call fails
          return {
            address: walletAddress,
            balance: '0',
            formatted: '0',
            symbol: knownToken.symbol,
            decimals: knownToken.decimals,
          };
        }
      }

      // For unknown tokens, try to get all info from contract
      try {
        const [balance, decimals, symbol] = await Promise.all([
          publicClient.readContract({
            address: tokenAddress as Address,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [walletAddress as Address],
          }) as Promise<bigint>,
          publicClient.readContract({
            address: tokenAddress as Address,
            abi: ERC20_ABI,
            functionName: 'decimals',
            args: [],
          }) as Promise<number>,
          publicClient.readContract({
            address: tokenAddress as Address,
            abi: ERC20_ABI,
            functionName: 'symbol',
            args: [],
          }) as Promise<string>,
        ]);

        return {
          address: walletAddress,
          balance: balance.toString(),
          formatted: formatUnits(balance, decimals),
          symbol,
          decimals,
        };
      } catch (contractError) {
        console.error(`Error reading contract ${tokenAddress}:`, contractError);
        throw new Error(`Failed to read token contract at ${tokenAddress}`);
      }
    } catch (error) {
      console.error('Error getting token balance:', error);
      throw new Error('Failed to get token balance');
    }
  }

  /**
   * Get multiple token balances for an address
   */
  static async getMultipleTokenBalances(
    tokenAddresses: string[],
    walletAddress: string
  ): Promise<TokenBalance[]> {
    const results: TokenBalance[] = [];
    
    for (const address of tokenAddresses) {
      try {
        const balance = await this.getTokenBalance(address, walletAddress);
        results.push(balance);
      } catch (error) {
        console.error(`Failed to get balance for token ${address}:`, error);
        
        // Try to get token metadata for fallback
        const knownToken = Object.values(TOKEN_METADATA).find(
          t => t.address.toLowerCase() === address.toLowerCase()
        );
        
        if (knownToken) {
          // Add zero balance for known tokens that failed
          results.push({
            address: walletAddress,
            balance: '0',
            formatted: '0',
            symbol: knownToken.symbol,
            decimals: knownToken.decimals,
          });
        }
        // Skip unknown tokens that fail
      }
    }
    
    return results;
  }

  /**
   * Get balances for all supported DCA tokens
   */
  static async getDCATokenBalances(walletAddress: string): Promise<TokenBalance[]> {
    
    
    // Always include XFI (native token)
    const results: TokenBalance[] = [];
    
    try {
      const xfiBalance = await this.getTokenBalance(TOKEN_ADDRESSES.XFI, walletAddress);
      results.push(xfiBalance);
      
    } catch (error) {
      console.error('❌ Failed to get XFI balance:', error);
      // Add zero XFI balance as fallback
      results.push({
        address: walletAddress,
        balance: '0',
        formatted: '0',
        symbol: 'XFI',
        decimals: 18,
      });
    }

    // Try to get tUSDC balance directly (skip verification for known tokens)
    try {
      
      
      // Directly get the balance using our known token metadata
      const tUSDCBalance = await this.getTokenBalance(TOKEN_ADDRESSES.tUSDC, walletAddress);
      results.push(tUSDCBalance);
      
    } catch (error) {
      console.error('❌ Failed to get tUSDC balance:', error);
      // Add zero tUSDC balance as fallback with correct decimals
      const tUSDCMetadata = TOKEN_METADATA.tUSDC;
      results.push({
        address: walletAddress,
        balance: '0',
        formatted: '0',
        symbol: tUSDCMetadata.symbol,
        decimals: tUSDCMetadata.decimals,
      });
    }

    
    return results;
  }

  /**
   * Check if user has sufficient token balance
   */
  static async hasSufficientBalance(
    tokenAddress: string,
    walletAddress: string,
    requiredAmount: string
  ): Promise<boolean> {
    try {
      const balance = await this.getTokenBalance(tokenAddress, walletAddress);
      const token = Object.values(TOKEN_METADATA).find(t => t.address.toLowerCase() === tokenAddress.toLowerCase());
      const decimals = token?.decimals || 18;
      
      const requiredAmountBigInt = parseUnits(requiredAmount, decimals);
      const balanceBigInt = BigInt(balance.balance);
      
      return balanceBigInt >= requiredAmountBigInt;
    } catch (error) {
      console.error('Error checking sufficient balance:', error);
      return false;
    }
  }

  /**
   * Approve token spending (for ERC20 tokens only)
   */
  static async approveToken(
    user: IUser,
    tokenAddress: string,
    spenderAddress: string,
    amount: string
  ): Promise<TokenApprovalResult> {
    try {
      // Skip approval for native XFI
      if (tokenAddress === TOKEN_ADDRESSES.XFI || tokenAddress === '0x0000000000000000000000000000000000000000') {
        return { success: true };
      }

      const walletClient = createWalletClientFromPrivateKey(user.encryptedPrivateKey);
      const token = getTokenBySymbol('tUSDC'); // Assuming tUSDC for now
      
      if (!token) {
        throw new Error('Token not found');
      }

      const amountBigInt = parseUnits(amount, token.decimals);
      
      const hash = await walletClient.writeContract({
        address: tokenAddress as Address,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spenderAddress as Address, amountBigInt],
      } as any);

      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      return {
        success: receipt.status === 'success',
        transactionHash: receipt.transactionHash,
      };
    } catch (error: any) {
      console.error('Error approving token:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Check token allowance
   */
  static async getTokenAllowance(
    tokenAddress: string,
    ownerAddress: string,
    spenderAddress: string
  ): Promise<string> {
    try {
      // Native XFI doesn't need allowance
      if (tokenAddress === TOKEN_ADDRESSES.XFI || tokenAddress === '0x0000000000000000000000000000000000000000') {
        return '0';
      }

      const allowance = await publicClient.readContract({
        address: tokenAddress as Address,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [ownerAddress as Address, spenderAddress as Address],
      }) as bigint;

      return allowance.toString();
    } catch (error) {
      console.error('Error getting token allowance:', error);
      throw new Error('Failed to get token allowance');
    }
  }

  /**
   * Transfer ERC20 tokens
   */
  static async transferToken(
    user: IUser,
    tokenAddress: string,
    toAddress: string,
    amount: string
  ): Promise<TokenTransferResult> {
    try {
      const walletClient = createWalletClientFromPrivateKey(user.encryptedPrivateKey);
      
      // Handle native XFI transfer
      if (tokenAddress === TOKEN_ADDRESSES.XFI || tokenAddress === '0x0000000000000000000000000000000000000000') {
        const hash = await walletClient.sendTransaction({
          to: toAddress as Address,
          value: parseUnits(amount, 18),
        } as any);

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        
        return {
          success: receipt.status === 'success',
          transactionHash: receipt.transactionHash,
        };
      }

      // Handle ERC20 token transfer
      const token = Object.values(TOKEN_METADATA).find(
        t => t.address.toLowerCase() === tokenAddress.toLowerCase()
      );
      
      if (!token) {
        throw new Error('Token not found');
      }

      const amountBigInt = parseUnits(amount, token.decimals);
      
      const hash = await walletClient.writeContract({
        address: tokenAddress as Address,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [toAddress as Address, amountBigInt],
      } as any);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      return {
        success: receipt.status === 'success',
        transactionHash: receipt.transactionHash,
      };
    } catch (error: any) {
      console.error('Error transferring token:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get token information by address
   */
  static async getTokenInfo(tokenAddress: string) {
    try {
      // Handle native XFI
      if (tokenAddress === TOKEN_ADDRESSES.XFI || tokenAddress === '0x0000000000000000000000000000000000000000') {
        return TOKEN_METADATA.XFI;
      }

      // Handle ERC20 tokens
      const [name, symbol, decimals] = await Promise.all([
        publicClient.readContract({
          address: tokenAddress as Address,
          abi: ERC20_ABI,
          functionName: 'name',
          args: [],
        }) as Promise<string>,
        publicClient.readContract({
          address: tokenAddress as Address,
          abi: ERC20_ABI,
          functionName: 'symbol',
          args: [],
        }) as Promise<string>,
        publicClient.readContract({
          address: tokenAddress as Address,
          abi: ERC20_ABI,
          functionName: 'decimals',
          args: [],
        }) as Promise<number>,
      ]);

      return {
        name,
        symbol,
        decimals,
        address: tokenAddress,
        isNative: false,
      };
    } catch (error) {
      console.error('Error getting token info:', error);
      throw new Error('Failed to get token information');
    }
  }

  /**
   * Format token amount for display
   */
  static formatTokenAmount(amount: string, decimals: number, precision: number = 6): string {
    try {
      const formatted = formatUnits(BigInt(amount), decimals);
      const num = parseFloat(formatted);
      
      if (num === 0) return '0';
      if (num < 0.000001) return '<0.000001';
      
      return num.toFixed(precision).replace(/\.?0+$/, '');
    } catch (error) {
      console.error('Error formatting token amount:', error);
      return '0';
    }
  }

  /**
   * Parse token amount from user input
   */
  static parseTokenAmount(amount: string, decimals: number): string {
    try {
      return parseUnits(amount, decimals).toString();
    } catch (error) {
      console.error('Error parsing token amount:', error);
      throw new Error('Invalid token amount format');
    }
  }

  /**
   * Validate if address has sufficient balance for a transaction
   */
  static async validateSufficientBalance(
    tokenAddress: string,
    walletAddress: string,
    amount: string,
    includeGas: boolean = true
  ): Promise<{ sufficient: boolean; balance: string; required: string; shortfall?: string }> {
    try {
      const balance = await this.getTokenBalance(tokenAddress, walletAddress);
      const token = Object.values(TOKEN_METADATA).find(
        t => t.address.toLowerCase() === tokenAddress.toLowerCase()
      );
      
      if (!token) {
        throw new Error('Token not found');
      }

      const requiredAmount = parseUnits(amount, token.decimals);
      let totalRequired = requiredAmount;

      // Add gas estimation for native token transactions
      if (includeGas && (tokenAddress === TOKEN_ADDRESSES.XFI || tokenAddress === '0x0000000000000000000000000000000000000000')) {
        const gasEstimate = parseUnits('0.001', 18); // Estimate 0.001 XFI for gas
        totalRequired += gasEstimate;
      }

      const balanceBigInt = BigInt(balance.balance);
      const sufficient = balanceBigInt >= totalRequired;
      
      return {
        sufficient,
        balance: balance.formatted,
        required: formatUnits(totalRequired, token.decimals),
        shortfall: sufficient ? undefined : formatUnits(totalRequired - balanceBigInt, token.decimals),
      };
    } catch (error) {
      console.error('Error validating sufficient balance:', error);
      throw new Error('Failed to validate balance');
    }
  }
} 