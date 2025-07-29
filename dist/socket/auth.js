import { PrivyService } from '../services/privy.js';
import { WalletService } from '../services/wallet.js';
export const authenticateSocket = async (socket, next) => {
    try {
        console.log('🔌 Attempting WebSocket authentication...');
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            console.log('🔌 No authentication token provided');
            return next(new Error('Authentication token required'));
        }
        console.log('🔌 Token found, verifying with Privy...');
        const privyUser = await PrivyService.verifyToken(token);
        if (!privyUser.wallet) {
            console.log('🔌 User has no connected wallet');
            return next(new Error('Wallet connection required'));
        }
        console.log('🔌 Getting user wallet from database...');
        const user = await WalletService.getUserWallet(privyUser.id, privyUser.wallet.address, privyUser.email);
        if (!user) {
            console.log('🔌 User wallet not found in database');
            return next(new Error('User wallet not found'));
        }
        socket.userId = user.id;
        socket.walletAddress = user.walletAddress;
        console.log(`🔌 WebSocket authenticated successfully: ${user.walletAddress}`);
        next();
    }
    catch (error) {
        console.error('❌ WebSocket authentication error:', error);
        next(new Error('Authentication failed'));
    }
};
//# sourceMappingURL=auth.js.map