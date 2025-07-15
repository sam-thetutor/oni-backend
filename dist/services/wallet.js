import { ethers } from 'ethers';
import { User } from '../models/User.js';
export class WalletService {
    static CHAIN_ID = parseInt(process.env.CHAIN_ID || '4157');
    static generateWallet() {
        const wallet = ethers.Wallet.createRandom();
        return {
            address: wallet.address,
            privateKey: wallet.privateKey,
            chainId: this.CHAIN_ID,
        };
    }
    static async getUserWallet(privyId, frontendWalletAddress, email) {
        try {
            let user = await User.findOne({ frontendWalletAddress });
            if (user) {
                return user;
            }
            const walletInfo = this.generateWallet();
            user = new User({
                privyId,
                email,
                frontendWalletAddress: frontendWalletAddress,
                walletAddress: walletInfo.address,
                encryptedPrivateKey: walletInfo.privateKey,
                chainId: walletInfo.chainId,
            });
            await user.save();
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
                chainId: user.chainId,
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
            user.chainId = newWalletInfo.chainId;
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