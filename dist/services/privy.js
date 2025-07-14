import { PrivyClient } from '@privy-io/server-auth';
import { config } from 'dotenv';
config();
const privy = new PrivyClient(process.env.PRIVY_APP_ID, process.env.PRIVY_APP_SECRET);
export class PrivyService {
    static async verifyToken(token) {
        try {
            const verifiedClaims = await privy.verifyAuthToken(token);
            const user = {
                id: verifiedClaims.userId,
            };
            try {
                const userDetails = await privy.getUser(verifiedClaims.userId);
                if (userDetails.email?.address) {
                    user.email = userDetails.email.address;
                }
                if (userDetails.wallet) {
                    user.wallet = {
                        address: userDetails.wallet.address,
                        chainId: parseInt(userDetails.wallet.chainId || '1'),
                    };
                }
            }
            catch (userError) {
                console.warn('Could not fetch additional user details:', userError);
            }
            return user;
        }
        catch (error) {
            console.error('Privy token verification failed:', error);
            throw new Error('Invalid or expired access token');
        }
    }
    static async getUser(userId) {
        try {
            const user = await privy.getUser(userId);
            return {
                id: user.id,
                email: user.email?.address,
                wallet: user.wallet ? {
                    address: user.wallet.address,
                    chainId: parseInt(user.wallet.chainId || '1'),
                } : undefined,
            };
        }
        catch (error) {
            console.error('Failed to get user from Privy:', error);
            throw new Error('Failed to retrieve user information');
        }
    }
    static async validateWalletConnection(userId) {
        try {
            const user = await this.getUser(userId);
            if (!user.wallet) {
                throw new Error('User does not have a connected wallet');
            }
            return user.wallet.address;
        }
        catch (error) {
            console.error('Wallet validation failed:', error);
            throw error;
        }
    }
}
//# sourceMappingURL=privy.js.map