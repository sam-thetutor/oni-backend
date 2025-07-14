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
      // Verify the token with Privy
      const verifiedClaims = await privy.verifyAuthToken(token);
      
      // Extract user information
      const user: PrivyUser = {
        id: verifiedClaims.userId,
      };

      // Get additional user information if needed
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
      } catch (userError) {
        console.warn('Could not fetch additional user details:', userError);
        // Continue with basic user info from token
      }

      return user;
    } catch (error) {
      console.error('Privy token verification failed:', error);
      throw new Error('Invalid or expired access token');
    }
  }

  /**
   * Get user information by user ID
   */
  static async getUser(userId: string): Promise<PrivyUser> {
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
    } catch (error) {
      console.error('Failed to get user from Privy:', error);
      throw new Error('Failed to retrieve user information');
    }
  }

  /**
   * Validate that a user has a connected wallet
   */
  static async validateWalletConnection(userId: string): Promise<string> {
    try {
      const user = await this.getUser(userId);
      
      if (!user.wallet) {
        throw new Error('User does not have a connected wallet');
      }

      return user.wallet.address;
    } catch (error) {
      console.error('Wallet validation failed:', error);
      throw error;
    }
  }
} 