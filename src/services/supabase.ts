import { supabaseAdmin } from '../config/supabase.js';
import { EncryptionService } from '../utils/encryption.js';
import { config } from 'dotenv';

config();

export interface IUser {
  id: string;
  privy_id: string;
  email?: string;
  wallet_address: string;
  frontend_wallet_address: string;
  encrypted_private_key: string;
  points: number;
  total_volume: number;
  weekly_points?: number;
  weekly_volume?: number;
  username?: string;
  created_at: string;
  updated_at: string;
}

export class SupabaseService {
  /**
   * Get or create user wallet
   */
  static async getUserWallet(privyId: string, frontendWalletAddress: string, email?: string): Promise<IUser> {
    try {
      // First, check if user already exists by privy_id
      const { data: existingUser, error: findError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('privy_id', privyId)
        .single();

      if (findError && findError.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw new Error(`Database error: ${findError.message}`);
      }

      if (existingUser) {
        // User exists, check if frontend_wallet_address needs to be updated
        if (existingUser.frontend_wallet_address !== frontendWalletAddress) {
          const { data: updatedUser, error: updateError } = await supabaseAdmin
            .from('users')
            .update({ 
              frontend_wallet_address: frontendWalletAddress,
              updated_at: new Date().toISOString()
            })
            .eq('privy_id', privyId)
            .select()
            .single();

          if (updateError) {
            throw new Error(`Failed to update user: ${updateError.message}`);
          }

          return updatedUser as IUser;
        }
        return existingUser as IUser;
      }

      // Check if a user with this frontend_wallet_address already exists
      const { data: userByWallet, error: walletError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('frontend_wallet_address', frontendWalletAddress)
        .single();

      if (walletError && walletError.code !== 'PGRST116') {
        throw new Error(`Database error: ${walletError.message}`);
      }

      if (userByWallet) {
        // Update the privy_id if it's different
        if (userByWallet.privy_id !== privyId) {
          const { data: updatedUser, error: updateError } = await supabaseAdmin
            .from('users')
            .update({ 
              privy_id: privyId,
              email: email || userByWallet.email,
              updated_at: new Date().toISOString()
            })
            .eq('id', userByWallet.id)
            .select()
            .single();

          if (updateError) {
            throw new Error(`Failed to update user: ${updateError.message}`);
          }

          return updatedUser as IUser;
        }
        return userByWallet as IUser;
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
      const { data: newUser, error: insertError } = await supabaseAdmin
        .from('users')
        .insert({
          privy_id: privyId,
          email,
          wallet_address: wallet.address,
          frontend_wallet_address: frontendWalletAddress,
          encrypted_private_key: encryptedPrivateKey,
          points: 0,
          total_volume: 0,
          weekly_points: 0,
          weekly_volume: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Failed to create user: ${insertError.message}`);
      }

      return newUser as IUser;
    } catch (error) {
      console.error('❌ Error getting user wallet:', error);
      throw new Error('Failed to get or create user wallet');
    }
  }

  /**
   * Get user wallet by privy_id
   */
  static async getWalletByPrivyId(privyId: string): Promise<IUser | null> {
    try {
      const { data: user, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('privy_id', privyId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // No rows returned
          return null;
        }
        throw new Error(`Database error: ${error.message}`);
      }

      return user as IUser;
    } catch (error) {
      console.error('❌ Error getting wallet by privy_id:', error);
      throw new Error('Failed to get user wallet');
    }
  }

  /**
   * Get user wallet by wallet address
   */
  static async getWalletByAddress(address: string): Promise<IUser | null> {
    try {
      const { data: user, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('wallet_address', address)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // No rows returned
          return null;
        }
        throw new Error(`Database error: ${error.message}`);
      }

      return user as IUser;
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
      const { data: user, error } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('privy_id', privyId)
        .eq('wallet_address', walletAddress.toLowerCase())
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // No rows returned
          return false;
        }
        throw new Error(`Database error: ${error.message}`);
      }

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
      const user = await this.getWalletByPrivyId(privyId);
      if (!user) {
        return null;
      }

      // Decrypt private key
      const encryptionKey = process.env.ENCRYPTION_KEY;
      if (!encryptionKey) {
        throw new Error('ENCRYPTION_KEY environment variable is required');
      }

      const decryptedPrivateKey = EncryptionService.decryptPrivateKey(user.encrypted_private_key, encryptionKey);

      // Get chain ID from environment
      const isProduction = process.env.ENVIRONMENT === 'production';
      const chainId = isProduction 
        ? parseInt(process.env.CHAIN_ID || '4158')
        : parseInt(process.env.CHAIN_ID_TESTNET || '4157');

      return {
        address: user.wallet_address,
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
  static async updateUserPoints(privyId: string, points: number): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('users')
        .update({ 
          points: points,
          updated_at: new Date().toISOString()
        })
        .eq('privy_id', privyId);

      if (error) {
        throw new Error(`Failed to update points: ${error.message}`);
      }
    } catch (error) {
      console.error('❌ Error updating user points:', error);
      throw error;
    }
  }

  /**
   * Update user volume
   */
  static async updateUserVolume(privyId: string, volume: number): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('users')
        .update({ 
          total_volume: volume,
          updated_at: new Date().toISOString()
        })
        .eq('privy_id', privyId);

      if (error) {
        throw new Error(`Failed to update volume: ${error.message}`);
      }
    } catch (error) {
      console.error('❌ Error updating user volume:', error);
      throw error;
    }
  }
} 