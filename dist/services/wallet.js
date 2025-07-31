import { ethers } from 'ethers';
import { config } from 'dotenv';
import { User } from '../models/User.js';
import { WalletFundingService } from './wallet-funding.js';
config();
export class WalletService {
    static CHAIN_ID = (() => {
        const isProduction = process.env.ENVIRONMENT === 'production';
        return isProduction
            ? parseInt(process.env.CHAIN_ID || '4158')
            : parseInt(process.env.CHAIN_ID_TESTNET || '4157');
    })();
    static generateWallet() {
        const wallet = ethers.Wallet.createRandom();
        return {
            address: wallet.address,
            privateKey: wallet.privateKey,
        };
    }
    static async getUserWallet(privyId, frontendWalletAddress, email) {
        try {
            let user = await User.findOne({ privyId });
            if (user) {
                if (user.frontendWalletAddress !== frontendWalletAddress) {
                    user.frontendWalletAddress = frontendWalletAddress;
                    await user.save();
                }
                return user;
            }
            user = await User.findOne({ frontendWalletAddress });
            if (user) {
                if (user.privyId !== privyId) {
                    user.privyId = privyId;
                    if (email) {
                        user.email = email;
                    }
                    await user.save();
                }
                return user;
            }
            const walletInfo = this.generateWallet();
            user = new User({
                privyId,
                email,
                frontendWalletAddress: frontendWalletAddress,
                walletAddress: walletInfo.address,
                encryptedPrivateKey: walletInfo.privateKey,
            });
            await user.save();
            console.log(`🎉 New user created, funding wallet: ${walletInfo.address}`);
            const fundingResult = await WalletFundingService.fundNewWallet(walletInfo.address);
            if (fundingResult.success) {
                console.log(`✅ Wallet funded successfully! Transaction: ${fundingResult.transactionHash}`);
            }
            else {
                console.error(`❌ Failed to fund wallet: ${fundingResult.error}`);
            }
            return user;
        }
        catch (error) {
            console.error('❌ Error getting user wallet:', error);
            throw new Error('Failed to get or create user wallet');
        }
    }
    static async getWalletByPrivyId(privyId) {
        try {
            return await User.findOne({ privyId });
        }
        catch (error) {
            console.error('❌ Error getting wallet by privyId:', error);
            throw new Error('Failed to get user wallet');
        }
    }
    static async getWalletByAddress(address) {
        try {
            return await User.findOne({ walletAddress: address });
        }
        catch (error) {
            console.error('❌ Error getting wallet by address:', error);
            throw new Error('Failed to get user wallet');
        }
    }
    static async validateWalletOwnership(privyId, walletAddress) {
        try {
            const user = await User.findOne({ privyId, walletAddress: walletAddress.toLowerCase() });
            return !!user;
        }
        catch (error) {
            console.error('❌ Error validating wallet ownership:', error);
            return false;
        }
    }
    static async getWalletForOperations(privyId) {
        try {
            const user = await User.findOne({ privyId });
            if (!user) {
                return null;
            }
            return {
                address: user.walletAddress,
                privateKey: user.encryptedPrivateKey,
                chainId: this.CHAIN_ID,
            };
        }
        catch (error) {
            console.error('❌ Error getting wallet for operations:', error);
            return null;
        }
    }
    static async rotateUserWallet(privyId) {
        try {
            const user = await User.findOne({ privyId });
            if (!user) {
                throw new Error('User not found');
            }
            const newWalletInfo = this.generateWallet();
            user.walletAddress = newWalletInfo.address;
            user.encryptedPrivateKey = newWalletInfo.privateKey;
            await user.save();
            return user;
        }
        catch (error) {
            console.error('❌ Error rotating user wallet:', error);
            throw new Error('Failed to rotate user wallet');
        }
    }
}
//# sourceMappingURL=wallet.js.map