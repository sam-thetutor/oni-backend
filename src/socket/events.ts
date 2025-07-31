import { Server } from 'socket.io';
import { AuthenticatedSocket } from './auth.js';
import { BlockchainService } from '../services/blockchain.js';
import { GamificationService } from '../services/gamification.js';

export const setupSocketEvents = (io: Server) => {
  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`🔌 Client connected: ${socket.walletAddress}`);

    // Join user to their wallet-specific room
    if (socket.walletAddress) {
      socket.join(socket.walletAddress);
      console.log(`👥 User joined room: ${socket.walletAddress}`);
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
      } catch (error: any) {
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
      } catch (error: any) {
        console.error('Error refreshing transactions:', error);
        socket.emit('error', { message: 'Failed to refresh transactions' });
      }
    });

    // Handle user stats refresh request
    socket.on('wallet:refresh:stats', async () => {
      try {
        if (!socket.frontendWalletAddress) {
          socket.emit('error', { message: 'Frontend wallet address not found' });
          return;
        }

        const stats = await GamificationService.getUserStats(socket.frontendWalletAddress);
        socket.emit('wallet:stats:updated', {
          stats,
          timestamp: new Date().toISOString()
        });
      } catch (error: any) {
        console.error('Error refreshing stats:', error);
        socket.emit('error', { message: 'Failed to refresh stats' });
      }
    });
  });
};

// Utility function to emit events to specific wallet
export const emitToWallet = (io: Server, walletAddress: string, event: string, data: any) => {
  io.to(walletAddress).emit(event, {
    ...data,
    timestamp: new Date().toISOString()
  });
  console.log(`📡 Emitted ${event} to ${walletAddress}`);
};

// Specific event emitters
export const emitBalanceUpdate = (io: Server, walletAddress: string, balanceData: any) => {
  emitToWallet(io, walletAddress, 'wallet:balance:updated', balanceData);
};

export const emitNewTransaction = (io: Server, walletAddress: string, transactionData: any) => {
  emitToWallet(io, walletAddress, 'wallet:transaction:new', transactionData);
};

export const emitPointsEarned = (io: Server, walletAddress: string, pointsData: any) => {
  emitToWallet(io, walletAddress, 'wallet:points:earned', pointsData);
};

export const emitTransactionSuccess = (io: Server, walletAddress: string, transactionData: any) => {
  emitToWallet(io, walletAddress, 'wallet:transaction:success', transactionData);
};

export const emitTransactionError = (io: Server, walletAddress: string, errorData: any) => {
  emitToWallet(io, walletAddress, 'wallet:transaction:error', errorData);
}; 