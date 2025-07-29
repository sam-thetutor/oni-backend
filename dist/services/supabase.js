import { supabaseAdmin } from '../config/supabase.js';
import { EncryptionService } from '../utils/encryption.js';
import { config } from 'dotenv';
config();
export class SupabaseService {
    static async getUserWallet(privyId, frontendWalletAddress, email) {
        try {
            const { data: existingUser, error: findError } = await supabaseAdmin
                .from('users')
                .select('*')
                .eq('privy_id', privyId)
                .single();
            if (findError && findError.code !== 'PGRST116') {
                throw new Error(`Database error: ${findError.message}`);
            }
            if (existingUser) {
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
                    return updatedUser;
                }
                return existingUser;
            }
            const { data: userByWallet, error: walletError } = await supabaseAdmin
                .from('users')
                .select('*')
                .eq('frontend_wallet_address', frontendWalletAddress)
                .single();
            if (walletError && walletError.code !== 'PGRST116') {
                throw new Error(`Database error: ${walletError.message}`);
            }
            if (userByWallet) {
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
                    return updatedUser;
                }
                return userByWallet;
            }
            const { ethers } = await import('ethers');
            const wallet = ethers.Wallet.createRandom();
            const encryptionKey = process.env.ENCRYPTION_KEY;
            if (!encryptionKey) {
                throw new Error('ENCRYPTION_KEY environment variable is required');
            }
            const encryptedPrivateKey = EncryptionService.encryptPrivateKey(wallet.privateKey, encryptionKey);
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
            return newUser;
        }
        catch (error) {
            console.error('❌ Error getting user wallet:', error);
            throw new Error('Failed to get or create user wallet');
        }
    }
    static async getWalletByPrivyId(privyId) {
        try {
            const { data: user, error } = await supabaseAdmin
                .from('users')
                .select('*')
                .eq('privy_id', privyId)
                .single();
            if (error) {
                if (error.code === 'PGRST116') {
                    return null;
                }
                throw new Error(`Database error: ${error.message}`);
            }
            return user;
        }
        catch (error) {
            console.error('❌ Error getting wallet by privy_id:', error);
            throw new Error('Failed to get user wallet');
        }
    }
    static async getWalletByAddress(address) {
        try {
            const { data: user, error } = await supabaseAdmin
                .from('users')
                .select('*')
                .eq('wallet_address', address)
                .single();
            if (error) {
                if (error.code === 'PGRST116') {
                    return null;
                }
                throw new Error(`Database error: ${error.message}`);
            }
            return user;
        }
        catch (error) {
            console.error('❌ Error getting wallet by address:', error);
            throw new Error('Failed to get user wallet');
        }
    }
    static async validateWalletOwnership(privyId, walletAddress) {
        try {
            const { data: user, error } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('privy_id', privyId)
                .eq('wallet_address', walletAddress.toLowerCase())
                .single();
            if (error) {
                if (error.code === 'PGRST116') {
                    return false;
                }
                throw new Error(`Database error: ${error.message}`);
            }
            return !!user;
        }
        catch (error) {
            console.error('❌ Error validating wallet ownership:', error);
            return false;
        }
    }
    static async getWalletForOperations(privyId) {
        try {
            const user = await this.getWalletByPrivyId(privyId);
            if (!user) {
                return null;
            }
            const encryptionKey = process.env.ENCRYPTION_KEY;
            if (!encryptionKey) {
                throw new Error('ENCRYPTION_KEY environment variable is required');
            }
            const decryptedPrivateKey = EncryptionService.decryptPrivateKey(user.encrypted_private_key, encryptionKey);
            const isProduction = process.env.ENVIRONMENT === 'production';
            const chainId = isProduction
                ? parseInt(process.env.CHAIN_ID || '4158')
                : parseInt(process.env.CHAIN_ID_TESTNET || '4157');
            return {
                address: user.wallet_address,
                privateKey: decryptedPrivateKey,
                chainId,
            };
        }
        catch (error) {
            console.error('❌ Error getting wallet for operations:', error);
            return null;
        }
    }
    static async updateUserPoints(privyId, points) {
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
        }
        catch (error) {
            console.error('❌ Error updating user points:', error);
            throw error;
        }
    }
    static async updateUserVolume(privyId, volume) {
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
        }
        catch (error) {
            console.error('❌ Error updating user volume:', error);
            throw error;
        }
    }
}
//# sourceMappingURL=supabase.js.map