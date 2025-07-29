import { ethers } from 'ethers';
import crypto from 'crypto';
import { config } from 'dotenv';
import { User, IUser } from '../models/User.js';
import { PrivyService } from './privy.js';

// Load environment variables
config();

export interface WalletInfo {
  address: string;
  privateKey: string;
}

export class WalletService {
  private static readonly CHAIN_ID = (() => {
    const isProduction = process.env.ENVIRONMENT === 'production';
    return isProduction 
      ? parseInt(process.env.CHAIN_ID || '4158')
      : parseInt(process.env.CHAIN_ID_TESTNET || '4157');
  })();

  /**
   * Generate a random wallet for a user
   */
  static generateWallet(): WalletInfo {
    // Create a completely random wallet
    const wallet = ethers.Wallet.createRandom();
    
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
    };
  }

  /**
   * Get or create user wallet
   */
  static async getUserWallet(privyId: string, frontendWalletAddress: string, email?: string): Promise<IUser> {
    try {
      // First, check if user already exists by privyId
      let user = await User.findOne({ privyId });
      
      if (user) {
        // User exists, check if frontendWalletAddress needs to be updated
        if (user.frontendWalletAddress !== frontendWalletAddress) {
          // Update the frontend wallet address
          user.frontendWalletAddress = frontendWalletAddress;
          await user.save();
        }
        return user;
      }

      // Check if a user with this frontendWalletAddress already exists
      user = await User.findOne({ frontendWalletAddress });
      
      if (user) {
        // This shouldn't happen in normal flow, but handle it gracefully
        // Update the privyId if it's different
        if (user.privyId !== privyId) {
          user.privyId = privyId;
          if (email) {
            user.email = email;
          }
          await user.save();
        }
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
        chainId: this.CHAIN_ID, // Use environment chain ID instead of stored chainId
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
      
      await user.save();
      
      return user;
    } catch (error) {
      console.error('❌ Error rotating user wallet:', error);
      throw new Error('Failed to rotate user wallet');
    }
  }
} 