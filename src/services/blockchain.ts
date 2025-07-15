import { parseEther, formatEther, type Address, type Hex } from 'viem';
import { publicClient, createWalletClientFromPrivateKey, getWalletClientFromUser } from '../config/viem.js';
import { IUser } from '../models/User.js';
import { GamificationService } from './gamification.js';

const EXPLORER_BASE_URL = 'https://test.xfiscan.com/tx/';

export interface BalanceInfo {
  address: string;
  balance: string;
  formatted: string;
}

export interface TransactionInfo {
  hash: string;
  from: string;
  to: string;
  value: string;
  status: 'pending' | 'success' | 'failed';
  reward?: {
    basePoints: number;
    bonusPoints: number;
    totalPoints: number;
    reason: string;
  } | null;
  transactionUrl?: string;
}

export class BlockchainService {
  /**
   * Get balance for an address
   */
  static async getBalance(address: string): Promise<BalanceInfo> {
    try {
      const balance = await publicClient.getBalance({ address: address as Address });
      
      return {
        address,
        balance: balance.toString(),
        formatted: formatEther(balance),
      };
    } catch (error) {
      console.error('Error getting balance:', error);
      throw new Error('Failed to get balance');
    }
  }

  /**
   * Get multiple balances
   */
  static async getBalances(addresses: string[]): Promise<BalanceInfo[]> {
    try {
      const balancePromises = addresses.map(address => this.getBalance(address));
      return await Promise.all(balancePromises);
    } catch (error) {
      console.error('Error getting balances:', error);
      throw new Error('Failed to get balances');
    }
  }

  /**
   * Send transaction
   */
  static async sendTransaction(
    user: IUser,
    to: string,
    amount: string,
    data?: string
  ): Promise<TransactionInfo> {
    try {
      const walletClient = await getWalletClientFromUser(user);
      
      if (!walletClient) {
        throw new Error('Failed to create wallet client');
      }

      const account = walletClient.account;
      if (!account) {
        throw new Error('No account found in wallet client');
      }

      // Send transaction using the wallet client (account is already set in the client)
      const hash = await walletClient.sendTransaction({
        to: to as Address,
        value: parseEther(amount),
        ...(data && { data: data as Hex }),
      } as any);
      
      // Wait for transaction receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      // Award points if transaction is successful
      let reward = null;
      if (receipt.status === 'success') {
        try {
          reward = await GamificationService.awardTransactionPoints(user, amount);

        } catch (error) {
          console.error('Failed to award points:', error);
          // Don't fail the transaction if points awarding fails
        }
      }
      
      return {
        hash: receipt.transactionHash,
        from: receipt.from,
        to: receipt.to || '',
        value: amount,
        status: receipt.status === 'success' ? 'success' : 'failed',
        reward: reward,
        transactionUrl: `${EXPLORER_BASE_URL}${receipt.transactionHash}`,
      };
    } catch (error) {
      console.error('Error sending transaction:', error);
      throw new Error('Failed to send transaction');
    }
  }

  /**
   * Get transaction history for an address
   */
  static async getTransactionHistory(address: string, limit: number = 10): Promise<TransactionInfo[]> {
    try {
      // Get block number
      const blockNumber = await publicClient.getBlockNumber();
      
      // Get recent blocks to find transactions
      const transactions: TransactionInfo[] = [];
      const blocksToCheck = Math.min(limit * 2, 100); // Check more blocks to find enough transactions
      
      for (let i = 0; i < blocksToCheck && transactions.length < limit; i++) {
        const block = await publicClient.getBlock({
          blockNumber: blockNumber - BigInt(i),
          includeTransactions: true,
        });
        
        if (block.transactions) {
          for (const tx of block.transactions) {
            if (typeof tx === 'object' && tx.from?.toLowerCase() === address.toLowerCase()) {
              transactions.push({
                hash: tx.hash,
                from: tx.from,
                to: tx.to || '',
                value: formatEther(tx.value),
                status: 'success', // Assuming confirmed transactions are successful
              });
              
              if (transactions.length >= limit) break;
            }
          }
        }
      }
      
      return transactions;
    } catch (error) {
      console.error('Error getting transaction history:', error);
      throw new Error('Failed to get transaction history');
    }
  }

  /**
   * Get gas estimate for a transaction
   */
  static async estimateGas(
    from: string,
    to: string,
    amount: string,
    data?: string
  ): Promise<bigint> {
    try {
      const gasEstimate = await publicClient.estimateGas({
        account: from as Address,
        to: to as Address,
        value: parseEther(amount),
        ...(data && { data: data as Hex }),
      });
      
      return gasEstimate;
    } catch (error) {
      console.error('Error estimating gas:', error);
      throw new Error('Failed to estimate gas');
    }
  }

  /**
   * Get current gas price
   */
  static async getGasPrice(): Promise<bigint> {
    try {
      return await publicClient.getGasPrice();
    } catch (error) {
      console.error('Error getting gas price:', error);
      throw new Error('Failed to get gas price');
    }
  }

  /**
   * Get block information
   */
  static async getBlockInfo(blockNumber?: bigint) {
    try {
      const block = await publicClient.getBlock({
        blockNumber: blockNumber || await publicClient.getBlockNumber(),
      });
      
      return {
        number: block.number,
        hash: block.hash,
        timestamp: block.timestamp,
        transactions: block.transactions.length,
      };
    } catch (error) {
      console.error('Error getting block info:', error);
      throw new Error('Failed to get block information');
    }
  }

  /**
   * Validate address format
   */
  static isValidAddress(address: string): boolean {
    try {
      // Basic Ethereum address validation
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    } catch {
      return false;
    }
  }

  /**
   * Format address for display
   */
  static formatAddress(address: string): string {
    if (!this.isValidAddress(address)) {
      return address;
    }
    
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
} 