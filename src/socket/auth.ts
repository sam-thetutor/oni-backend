import { Socket } from 'socket.io';
import { PrivyService, PrivyUser } from '../services/privy.js';
import { MongoDBService } from '../services/mongodb.js';

export interface AuthenticatedSocket extends Socket {
  frontendWalletAddress?: string;
  walletAddress?: string;
}

export const authenticateSocket = async (socket: AuthenticatedSocket, next: (err?: Error) => void) => {
  try {
    console.log('🔌 Attempting WebSocket authentication...');
    
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      console.log('🔌 No authentication token provided');
      return next(new Error('Authentication token required'));
    }

    console.log('🔌 Token found, verifying with Privy...');

    // Verify the Privy token and get user information
    const privyUser: PrivyUser = await PrivyService.verifyToken(token);
    
    // Validate that user has a connected wallet
    if (!privyUser.wallet) {
      console.log('🔌 User has no connected wallet');
      return next(new Error('Wallet connection required'));
    }

    console.log('🔌 Getting user wallet from database...');

    // Get user wallet from database
    const user = await MongoDBService.getUserWallet(privyUser.wallet.address, privyUser.email);
    if (!user) {
      console.log('🔌 User wallet not found in database');
      return next(new Error('User wallet not found'));
    }

    // Attach user info to socket
    socket.frontendWalletAddress = privyUser.wallet.address;
    socket.walletAddress = user.walletAddress;

    console.log(`🔌 WebSocket authenticated successfully: ${user.walletAddress} (frontend: ${privyUser.wallet.address})`);
    next();
  } catch (error: any) {
    console.error('❌ WebSocket authentication error:', error);
    next(new Error('Authentication failed'));
  }
}; 