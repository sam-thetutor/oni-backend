import { ethers } from 'ethers';
import crypto from 'crypto';
import { User, IUser } from '../models/User.js';
import { PrivyService } from './privy.js';

export interface WalletInfo {
  address: string;
  privateKey: string;
  chainId: number;
}

export class WalletService {
  private static readonly CHAIN_ID = parseInt(process.env.CHAIN_ID || '4157');

  /**
   * Generate a random wallet for a user
   */
  static generateWallet(): WalletInfo {
    // Create a completely random wallet
    const wallet = ethers.Wallet.createRandom();
    
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      chainId: this.CHAIN_ID,
    };
  }

  /**
   * Get or create user wallet
   */
  static async getUserWallet(privyId: string, frontendWalletAddress: string, email?: string): Promise<IUser> {
    try {
      // Check if user already exists
      let user = await User.findOne({ frontendWalletAddress });
      
      if (user) {
        return user;
      }

      // Generate new random wallet for user
      const walletInfo = this.generateWallet();
      
      // Create new user with encrypted private key
      user = new User({
        privyId,
        email,
        frontendWalletAddress: frontendWalletAddress,
        walletAddress: walletInfo.address,
        encryptedPrivateKey: walletInfo.privateKey, // Will be encrypted by pre-save middleware
        chainId: walletInfo.chainId,
      });

      await user.save();
      
      return user;
    } catch (error) {
      console.error('❌ Error getting user wallet:', error);
      throw new Error('Failed to get or create user wallet');
    }
  }

  /**
   * Get user wallet by privyId
   */
  static async getWalletByPrivyId(privyId: string): Promise<IUser | null> {
    try {
      return await User.findOne({ privyId });
    } catch (error) {
      console.error('❌ Error getting wallet by privyId:', error);
      throw new Error('Failed to get user wallet');
    }
  }

  /**
   * Get user wallet by wallet address
   */
  static async getWalletByAddress(address: string): Promise<IUser | null> {
    try {
      return await User.findOne({ walletAddress: address });
    } catch (error) {
      console.error('❌ Error getting wallet by address:', error);
      throw new Error('Failed to get user wallet');
    }
  }

  /**
   * Validate wallet ownership
   */
  static async validateWalletOwnership(privyId: string, walletAddress: string): Promise<boolean> {
    try {
      const user = await User.findOne({ privyId, walletAddress: walletAddress.toLowerCase() });
      return !!user;
    } catch (error) {
      console.error('❌ Error validating wallet ownership:', error);
      return false;
    }
  }

  /**
   * Get wallet info for blockchain operations
   */
  static async getWalletForOperations(privyId: string): Promise<{
    address: string;
    privateKey: string;
    chainId: number;
  } | null> {
    try {
      const user = await User.findOne({ privyId });
      if (!user) {
        return null;
      }

      // For now, we'll return the encrypted private key
      // In production, you'd want to decrypt it securely
      return {
        address: user.walletAddress,
        privateKey: user.encryptedPrivateKey, // This is encrypted
        chainId: user.chainId,
      };
    } catch (error) {
      console.error('❌ Error getting wallet for operations:', error);
      return null;
    }
  }

  /**
   * Generate a new wallet for an existing user (wallet rotation)
   */
  static async rotateUserWallet(privyId: string): Promise<IUser> {
    try {
      const user = await User.findOne({ privyId });
      
      if (!user) {
        throw new Error('User not found');
      }

      // Generate new random wallet
      const newWalletInfo = this.generateWallet();
      
      // Update user with new wallet
      user.walletAddress = newWalletInfo.address;
      user.encryptedPrivateKey = newWalletInfo.privateKey; // Will be encrypted by pre-save middleware
      user.chainId = newWalletInfo.chainId;
      
      await user.save();
      
      return user;
    } catch (error) {
      console.error('❌ Error rotating user wallet:', error);
      throw new Error('Failed to rotate user wallet');
    }
  }
} 