import { User } from '../models/User.js';
import { EncryptionService } from '../utils/encryption.js';
import { WalletFundingService } from './wallet-funding.js';
import { config } from 'dotenv';
config();
export class MongoDBService {
    static async getUserWallet(frontendWalletAddress, email) {
        try {
            let existingUser = await User.findOne({ frontendWalletAddress });
            if (existingUser) {
                if (email && existingUser.email !== email) {
                    existingUser.email = email;
                    await existingUser.save();
                }
                return existingUser.toObject();
            }
            const { ethers } = await import('ethers');
            const wallet = ethers.Wallet.createRandom();
            const encryptionKey = process.env.ENCRYPTION_KEY;
            if (!encryptionKey) {
                throw new Error('ENCRYPTION_KEY environment variable is required');
            }
            const encryptedPrivateKey = EncryptionService.encryptPrivateKey(wallet.privateKey, encryptionKey);
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
            console.log(`🎉 New user created, funding wallet: ${wallet.address}`);
            const fundingResult = await WalletFundingService.fundNewWallet(wallet.address);
            if (fundingResult.success) {
                console.log(`✅ Wallet funded successfully! Transaction: ${fundingResult.transactionHash}`);
            }
            else {
                console.error(`❌ Failed to fund wallet: ${fundingResult.error}`);
            }
            return newUser.toObject();
        }
        catch (error) {
            console.error('❌ Error getting user wallet:', error);
            throw new Error('Failed to get or create user wallet');
        }
    }
    static async getWalletByFrontendAddress(frontendWalletAddress) {
        try {
            const user = await User.findOne({ frontendWalletAddress });
            return user ? user.toObject() : null;
        }
        catch (error) {
            console.error('❌ Error getting wallet by frontend address:', error);
            throw new Error('Failed to get user wallet');
        }
    }
    static async getWalletByAddress(address) {
        try {
            const user = await User.findOne({ walletAddress: address });
            return user ? user.toObject() : null;
        }
        catch (error) {
            console.error('❌ Error getting wallet by address:', error);
            throw new Error('Failed to get user wallet');
        }
    }
    static async validateWalletOwnership(frontendWalletAddress, walletAddress) {
        try {
            const user = await User.findOne({
                frontendWalletAddress,
                walletAddress: { $regex: new RegExp(`^${walletAddress}$`, 'i') }
            });
            return !!user;
        }
        catch (error) {
            console.error('❌ Error validating wallet ownership:', error);
            return false;
        }
    }
    static async getWalletForOperations(frontendWalletAddress) {
        try {
            const user = await this.getWalletByFrontendAddress(frontendWalletAddress);
            if (!user) {
                return null;
            }
            const encryptionKey = process.env.ENCRYPTION_KEY;
            if (!encryptionKey) {
                throw new Error('ENCRYPTION_KEY environment variable is required');
            }
            const decryptedPrivateKey = EncryptionService.decryptPrivateKey(user.encryptedPrivateKey, encryptionKey);
            const isProduction = process.env.ENVIRONMENT === 'production';
            const chainId = isProduction
                ? parseInt(process.env.CHAIN_ID || '4158')
                : parseInt(process.env.CHAIN_ID_TESTNET || '4157');
            return {
                address: user.walletAddress,
                privateKey: decryptedPrivateKey,
                chainId,
            };
        }
        catch (error) {
            console.error('❌ Error getting wallet for operations:', error);
            return null;
        }
    }
    static async updateUserPoints(frontendWalletAddress, points) {
        try {
            await User.findOneAndUpdate({ frontendWalletAddress }, { points }, { new: true });
        }
        catch (error) {
            console.error('❌ Error updating user points:', error);
            throw error;
        }
    }
    static async updateUserVolume(frontendWalletAddress, volume) {
        try {
            await User.findOneAndUpdate({ frontendWalletAddress }, { totalVolume: volume }, { new: true });
        }
        catch (error) {
            console.error('❌ Error updating user volume:', error);
            throw error;
        }
    }
}
//# sourceMappingURL=mongodb.js.map