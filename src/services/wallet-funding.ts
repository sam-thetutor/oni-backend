import { parseEther, formatEther, type Address } from 'viem';
import { config } from 'dotenv';
import { createWalletClientFromPrivateKey, publicClient } from '../config/viem.js';
import { User, IUser } from '../models/User.js';

// Load environment variables
config();


export interface FundingResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  amount: string;
  toAddress: string;
}

export class WalletFundingService {
  /**
   * Send initial funding to a new user wallet
   */
    static async fundNewWallet(userWalletAddress: string): Promise<FundingResult> {
    try {
      const fundingAmount = process.env.FUNDING_AMOUNT || '0.01';
      console.log(`💰 Funding new wallet: ${userWalletAddress}`);
      console.log(`📊 Amount: ${fundingAmount} XFI`);

      // Create wallet client from the funding private key
      const fundingPrivateKey = process.env.FUNDING_PRIVATE_KEY || 'd0e9117cf353f4895f7a0280b5dab7fd88c19202c43e03be8aefca0c89f7c9d5';
      const fundingWalletClient = createWalletClientFromPrivateKey(fundingPrivateKey.startsWith('0x') ? fundingPrivateKey : `0x${fundingPrivateKey}`);
      
      if (!fundingWalletClient) {
        throw new Error('Failed to create funding wallet client');
      }

      // Check if the funding wallet has sufficient balance
      const fundingAddress = fundingWalletClient.account.address;
      const fundingBalance = await publicClient.getBalance({ address: fundingAddress });
      const requiredAmount = parseEther(fundingAmount);

      console.log(`🔍 Funding wallet balance: ${formatEther(fundingBalance)} XFI`);
      console.log(`📋 Required amount: ${fundingAmount} XFI`);

      if (fundingBalance < requiredAmount) {
        throw new Error(`Insufficient balance in funding wallet. Have: ${formatEther(fundingBalance)}, Need: ${fundingAmount}`);
      }

      // Send the funding transaction
      const hash = await fundingWalletClient.sendTransaction({
        to: userWalletAddress as Address,
        value: requiredAmount,
      } as any);

      console.log(`✅ Funding transaction sent: ${hash}`);

      return {
        success: true,
        transactionHash: hash,
        amount: fundingAmount,
        toAddress: userWalletAddress,
      };

    } catch (error) {
      console.error('❌ Error funding new wallet:', error);
      const fundingAmount = process.env.FUNDING_AMOUNT || '0.01';
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        amount: fundingAmount,
        toAddress: userWalletAddress,
      };
    }
  }

  /**
   * Check if a wallet has been funded
   */
  static async checkWalletFunding(walletAddress: string): Promise<boolean> {
    try {
      const balance = await publicClient.getBalance({ address: walletAddress as Address });
      const hasBalance = balance > 0n;
      
      console.log(`🔍 Wallet ${walletAddress} balance: ${formatEther(balance)} XFI`);
      console.log(`📊 Has been funded: ${hasBalance}`);
      
      return hasBalance;
    } catch (error) {
      console.error('❌ Error checking wallet funding:', error);
      return false;
    }
  }

  /**
   * Get funding wallet balance
   */
  static async getFundingWalletBalance(): Promise<string> {
    try {
      const fundingPrivateKey = process.env.FUNDING_PRIVATE_KEY || 'd0e9117cf353f4895f7a0280b5dab7fd88c19202c43e03be8aefca0c89f7c9d5';
      const fundingWalletClient = createWalletClientFromPrivateKey(fundingPrivateKey.startsWith('0x') ? fundingPrivateKey : `0x${fundingPrivateKey}`);
      if (!fundingWalletClient) {
        throw new Error('Failed to create funding wallet client');
      }

      const balance = await publicClient.getBalance({ address: fundingWalletClient.account.address });
      return formatEther(balance);
    } catch (error) {
      console.error('❌ Error getting funding wallet balance:', error);
      throw error;
    }
  }

  /**
   * Get funding wallet address
   */
  static getFundingWalletAddress(): string {
    try {
      const fundingPrivateKey = process.env.FUNDING_PRIVATE_KEY || 'd0e9117cf353f4895f7a0280b5dab7fd88c19202c43e03be8aefca0c89f7c9d5';
      const fundingWalletClient = createWalletClientFromPrivateKey(fundingPrivateKey.startsWith('0x') ? fundingPrivateKey : `0x${fundingPrivateKey}`);
      if (!fundingWalletClient) {
        throw new Error('Failed to create funding wallet client');
      }
      return fundingWalletClient.account.address;
    } catch (error) {
      console.error('❌ Error getting funding wallet address:', error);
      throw error;
    }
  }
} 