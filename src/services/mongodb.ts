import { User } from '../models/User.js';
import { EncryptionService } from '../utils/encryption.js';
import { WalletFundingService } from './wallet-funding.js';
import { config } from 'dotenv';

config();

export interface IUser {
  id: string;
  frontendWalletAddress: string;
  email?: string;
  walletAddress: string;
  encryptedPrivateKey: string;
  points: number;
  totalVolume: number;
  weeklyPoints?: number;
  weeklyVolume?: number;
  username?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class MongoDBService {
  /**
   * Get or create user wallet
   */
  static async getUserWallet(frontendWalletAddress: string, email?: string): Promise<IUser> {
    try {
      // Check if user already exists by frontendWalletAddress
      let existingUser = await User.findOne({ frontendWalletAddress });

      if (existingUser) {
        // User exists, update email if provided and different
        if (email && existingUser.email !== email) {
          existingUser.email = email;
          await existingUser.save();
        }
        return existingUser.toObject() as IUser;
      }

      // Generate new random wallet for user
      const { ethers } = await import('ethers');
      const wallet = ethers.Wallet.createRandom();
      
      // Encrypt private key
      const encryptionKey = process.env.ENCRYPTION_KEY;
      if (!encryptionKey) {
        throw new Error('ENCRYPTION_KEY environment variable is required');
      }
      
      const encryptedPrivateKey = EncryptionService.encryptPrivateKey(wallet.privateKey, encryptionKey);

      // Create new user
      const newUser = new User({
        email,
        walletAddress: wallet.address,
        frontendWalletAddress,
        encryptedPrivateKey,
        points: 0,
        totalVolume: 0,
        weeklyPoints: 0,
        weeklyVolume: 0,
      });

      await newUser.save();
      
      // Automatically fund the new wallet
      console.log(`🎉 New user created, funding wallet: ${wallet.address}`);
      const fundingResult = await WalletFundingService.fundNewWallet(wallet.address);
      
      if (fundingResult.success) {
        console.log(`✅ Wallet funded successfully! Transaction: ${fundingResult.transactionHash}`);
      } else {
        console.error(`❌ Failed to fund wallet: ${fundingResult.error}`);
        // Don't throw error here - user can still use the app, just won't have initial funding
      }
      
      return newUser.toObject() as IUser;
    } catch (error) {
      console.error('❌ Error getting user wallet:', error);
      throw new Error('Failed to get or create user wallet');
    }
  }

  /**
   * Get user wallet by frontend wallet address
   */
  static async getWalletByFrontendAddress(frontendWalletAddress: string): Promise<IUser | null> {
    try {
      const user = await User.findOne({ frontendWalletAddress });
      return user ? user.toObject() as IUser : null;
    } catch (error) {
      console.error('❌ Error getting wallet by frontend address:', error);
      throw new Error('Failed to get user wallet');
    }
  }

  /**
   * Get user wallet by wallet address
   */
  static async getWalletByAddress(address: string): Promise<IUser | null> {
    try {
      const user = await User.findOne({ walletAddress: address });
      return user ? user.toObject() as IUser : null;
    } catch (error) {
      console.error('❌ Error getting wallet by address:', error);
      throw new Error('Failed to get user wallet');
    }
  }

  /**
   * Validate wallet ownership
   */
  static async validateWalletOwnership(frontendWalletAddress: string, walletAddress: string): Promise<boolean> {
    try {
      const user = await User.findOne({ 
        frontendWalletAddress, 
        walletAddress: { $regex: new RegExp(`^${walletAddress}$`, 'i') }
      });
      return !!user;
    } catch (error) {
      console.error('❌ Error validating wallet ownership:', error);
      return false;
    }
  }

  /**
   * Get wallet info for blockchain operations
   */
  static async getWalletForOperations(frontendWalletAddress: string): Promise<{
    address: string;
    privateKey: string;
    chainId: number;
  } | null> {
    try {
      const user = await this.getWalletByFrontendAddress(frontendWalletAddress);
      if (!user) {
        return null;
      }

      // Decrypt private key
      const encryptionKey = process.env.ENCRYPTION_KEY;
      if (!encryptionKey) {
        throw new Error('ENCRYPTION_KEY environment variable is required');
      }

      const decryptedPrivateKey = EncryptionService.decryptPrivateKey(user.encryptedPrivateKey, encryptionKey);

      // Get chain ID from environment
      const isProduction = process.env.ENVIRONMENT === 'production';
      const chainId = isProduction 
        ? parseInt(process.env.CHAIN_ID || '4158')
        : parseInt(process.env.CHAIN_ID_TESTNET || '4157');

      return {
        address: user.walletAddress,
        privateKey: decryptedPrivateKey,
        chainId,
      };
    } catch (error) {
      console.error('❌ Error getting wallet for operations:', error);
      return null;
    }
  }

  /**
   * Update user points
   */
  static async updateUserPoints(frontendWalletAddress: string, points: number): Promise<void> {
    try {
      await User.findOneAndUpdate(
        { frontendWalletAddress },
        { points },
        { new: true }
      );
    } catch (error) {
      console.error('❌ Error updating user points:', error);
      throw error;
    }
  }

  /**
   * Update user volume
   */
  static async updateUserVolume(frontendWalletAddress: string, volume: number): Promise<void> {
    try {
      await User.findOneAndUpdate(
        { frontendWalletAddress },
        { totalVolume: volume },
        { new: true }
      );
    } catch (error) {
      console.error('❌ Error updating user volume:', error);
      throw error;
    }
  }
} 