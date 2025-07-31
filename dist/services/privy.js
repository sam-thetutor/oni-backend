import { PrivyClient } from '@privy-io/server-auth';
import { config } from 'dotenv';
config();
const privy = new PrivyClient(process.env.PRIVY_APP_ID, process.env.PRIVY_APP_SECRET);
export class PrivyService {
    static async verifyToken(token) {
        try {
            console.log('🔐 Verifying Privy token...');
            const verifiedClaims = await privy.verifyAuthToken(token);
            console.log('✅ Token verified, userId:', verifiedClaims.userId);
            const user = {
                id: verifiedClaims.userId,
            };
            try {
                console.log('🔍 Fetching additional user details...');
                const userDetails = await privy.getUser(verifiedClaims.userId);
                if (userDetails.email?.address) {
                    user.email = userDetails.email.address;
                    console.log('📧 User email found:', user.email);
                }
                if (userDetails.wallet) {
                    user.wallet = {
                        address: userDetails.wallet.address,
                        chainId: parseInt(userDetails.wallet.chainId || '1'),
                    };
                    console.log('👛 User wallet found:', user.wallet.address);
                }
                else {
                    console.log('⚠️ No wallet found for user');
                }
            }
            catch (userError) {
                console.warn('Could not fetch additional user details:', userError);
                console.log('ℹ️ Continuing with basic user info from token');
            }
            return user;
        }
        catch (error) {
            console.error('❌ Privy token verification failed:', error);
            if (error && typeof error === 'object' && 'type' in error) {
                if (error.type === 'api_error') {
                    console.error('🔍 API Error details:', {
                        status: error.status,
                        message: error.message
                    });
                    if (error.status === 499) {
                        throw new Error('Token expired or invalid. Please reconnect your wallet.');
                    }
                }
            }
            throw new Error('Invalid or expired access token. Please reconnect your wallet.');
        }
    }
    static async getUser(userId) {
        try {
            console.log('🔍 Getting user details for ID:', userId);
            const user = await privy.getUser(userId);
            const result = {
                id: user.id,
                email: user.email?.address,
                wallet: user.wallet ? {
                    address: user.wallet.address,
                    chainId: parseInt(user.wallet.chainId || '1'),
                } : undefined,
            };
            console.log('✅ User details retrieved:', {
                id: result.id,
                hasEmail: !!result.email,
                hasWallet: !!result.wallet
            });
            return result;
        }
        catch (error) {
            console.error('❌ Failed to get user from Privy:', error);
            if (error && typeof error === 'object' && 'type' in error) {
                if (error.type === 'api_error') {
                    console.error('🔍 API Error details:', {
                        status: error.status,
                        message: error.message
                    });
                }
            }
            throw new Error('Failed to retrieve user information. Please try again.');
        }
    }
    static async validateWalletConnection(userId) {
        try {
            console.log('🔍 Validating wallet connection for user:', userId);
            const user = await this.getUser(userId);
            if (!user.wallet) {
                console.log('❌ User does not have a connected wallet');
                throw new Error('User does not have a connected wallet');
            }
            console.log('✅ Wallet validated:', user.wallet.address);
            return user.wallet.address;
        }
        catch (error) {
            console.error('❌ Wallet validation failed:', error);
            throw error;
        }
    }
}
//# sourceMappingURL=privy.js.map