import { BlockchainService } from '../services/blockchain.js';
import { GamificationService } from '../services/gamification.js';
export const setupSocketEvents = (io) => {
    io.on('connection', (socket) => {
        // Get wallet address from query parameters
        const walletAddress = socket.handshake.query.walletAddress;
        if (walletAddress) {
            socket.walletAddress = walletAddress;
            console.log(`🔌 Client connected with wallet: ${walletAddress}`);
            // Join user to their wallet-specific room
            socket.join(walletAddress);
            console.log(`👥 User joined room: ${walletAddress}`);
        } else {
            console.log('🔌 Client connected (no wallet address)');
        }
        // Handle disconnect
        socket.on('disconnect', () => {
            console.log(`🔌 Client disconnected: ${socket.walletAddress}`);
        });
        // Handle balance refresh request
        socket.on('wallet:refresh:balance', async () => {
            try {
                if (!socket.walletAddress) {
                    socket.emit('error', { message: 'Wallet address not found' });
                    return;
                }
                const balance = await BlockchainService.getBalance(socket.walletAddress);
                socket.emit('wallet:balance:updated', {
                    address: balance.address,
                    balance: balance.balance,
                    formatted: balance.formatted,
                    symbol: 'XFI',
                    timestamp: new Date().toISOString()
                });
            }
            catch (error) {
                console.error('Error refreshing balance:', error);
                socket.emit('error', { message: 'Failed to refresh balance' });
            }
        });
        // Handle transaction history refresh request
        socket.on('wallet:refresh:transactions', async () => {
            try {
                if (!socket.walletAddress) {
                    socket.emit('error', { message: 'Wallet address not found' });
                    return;
                }
                const transactions = await BlockchainService.getTransactionHistory(socket.walletAddress);
                socket.emit('wallet:transactions:updated', {
                    transactions,
                    timestamp: new Date().toISOString()
                });
            }
            catch (error) {
                console.error('Error refreshing transactions:', error);
                socket.emit('error', { message: 'Failed to refresh transactions' });
            }
        });
        // Handle user stats refresh request
        socket.on('wallet:refresh:stats', async () => {
            try {
                if (!socket.userId) {
                    socket.emit('error', { message: 'User ID not found' });
                    return;
                }
                const stats = await GamificationService.getUserStats(socket.userId);
                socket.emit('wallet:stats:updated', {
                    stats,
                    timestamp: new Date().toISOString()
                });
            }
            catch (error) {
                console.error('Error refreshing stats:', error);
                socket.emit('error', { message: 'Failed to refresh stats' });
            }
        });
    });
};
// Utility function to emit events to specific wallet
export const emitToWallet = (io, walletAddress, event, data) => {
    io.to(walletAddress).emit(event, {
        ...data,
        timestamp: new Date().toISOString()
    });
    console.log(`📡 Emitted ${event} to ${walletAddress}`);
};
// Specific event emitters
export const emitBalanceUpdate = (io, walletAddress, balanceData) => {
    emitToWallet(io, walletAddress, 'wallet:balance:updated', balanceData);
};
export const emitNewTransaction = (io, walletAddress, transactionData) => {
    emitToWallet(io, walletAddress, 'wallet:transaction:new', transactionData);
};
export const emitPointsEarned = (io, walletAddress, pointsData) => {
    emitToWallet(io, walletAddress, 'wallet:points:earned', pointsData);
};
export const emitTransactionSuccess = (io, walletAddress, transactionData) => {
    emitToWallet(io, walletAddress, 'wallet:transaction:success', transactionData);
};
export const emitTransactionError = (io, walletAddress, errorData) => {
    emitToWallet(io, walletAddress, 'wallet:transaction:error', errorData);
};
