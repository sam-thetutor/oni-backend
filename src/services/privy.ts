import { PrivyClient } from '@privy-io/server-auth';
import { config } from 'dotenv';

config();

// Initialize Privy client
const privy = new PrivyClient(
  process.env.PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

export interface PrivyUser {
  id: string;
  email?: string;
  wallet?: {
    address: string;
    chainId: number;
  };
}

export class PrivyService {
  /**
   * Verify a Privy access token and return user information
   */
  static async verifyToken(token: string): Promise<PrivyUser> {
    try {
      console.log('🔐 Verifying Privy token...');
      
      // Verify the token with Privy
      const verifiedClaims = await privy.verifyAuthToken(token);
      console.log('✅ Token verified, userId:', verifiedClaims.userId);
      
      // Extract user information
      const user: PrivyUser = {
        id: verifiedClaims.userId,
      };

      // Get additional user information if needed
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
        } else {
          console.log('⚠️ No wallet found for user');
        }
      } catch (userError) {
        console.warn('Could not fetch additional user details:', userError);
        // Continue with basic user info from token
        console.log('ℹ️ Continuing with basic user info from token');
      }

      return user;
    } catch (error) {
      console.error('❌ Privy token verification failed:', error);
      
      // Provide more specific error messages
      if (error && typeof error === 'object' && 'type' in error) {
        if (error.type === 'api_error') {
          console.error('🔍 API Error details:', {
            status: (error as any).status,
            message: (error as any).message
          });
          
          if ((error as any).status === 499) {
            throw new Error('Token expired or invalid. Please reconnect your wallet.');
          }
        }
      }
      
      throw new Error('Invalid or expired access token. Please reconnect your wallet.');
    }
  }

  /**
   * Get user information by user ID
   */
  static async getUser(userId: string): Promise<PrivyUser> {
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
    } catch (error) {
      console.error('❌ Failed to get user from Privy:', error);
      
      // Provide more specific error messages
      if (error && typeof error === 'object' && 'type' in error) {
        if (error.type === 'api_error') {
          console.error('🔍 API Error details:', {
            status: (error as any).status,
            message: (error as any).message
          });
        }
      }
      
      throw new Error('Failed to retrieve user information. Please try again.');
    }
  }

  /**
   * Validate that a user has a connected wallet
   */
  static async validateWalletConnection(userId: string): Promise<string> {
    try {
      console.log('🔍 Validating wallet connection for user:', userId);
      const user = await this.getUser(userId);
      
      if (!user.wallet) {
        console.log('❌ User does not have a connected wallet');
        throw new Error('User does not have a connected wallet');
      }

      console.log('✅ Wallet validated:', user.wallet.address);
      return user.wallet.address;
    } catch (error) {
      console.error('❌ Wallet validation failed:', error);
      throw error;
    }
  }
} 