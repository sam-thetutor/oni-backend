import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { WalletService } from "./services/wallet.js";
import { MongoDBService } from "./services/mongodb.js";
import { BlockchainService } from "./services/blockchain.js";
import { GamificationService } from "./services/gamification.js";
import { User } from "./models/User.js";
import { ContractService } from "./services/contract.js";
import { PaymentLink } from "./models/PaymentLink.js";
import { nanoid } from "nanoid";
import { PaymentLinkService } from "./services/paymentlinks.js";
import { ContractReadService } from "./services/contractread.js";
import { CRYPTO_ASSISTANT_TOOLS } from "./tools/crypto-assistant.js";
import { SwapService } from "./services/swap.js";
import { TokenService } from "./services/tokens.js";
import { TOKEN_ADDRESSES } from "./constants/tokens.js";
import { getIO } from "./socket/index.js";
import { emitBalanceUpdate, emitNewTransaction, emitPointsEarned, emitTransactionSuccess } from "./socket/events.js";
import dotenv from 'dotenv';
import { IntelligentTool } from "./tools/intelligentTool.js";
dotenv.config();

// Import new price analysis tools
import { 
  XFIPriceChartTool,
  XFIMarketDataTool,
  XFITradingSignalsTool,
  XFIPricePredictionTool,
  XFIMarketComparisonTool
} from './tools/price-analysis.js';

// Import DCA tools
import {
  createDCAOrder,
  getUserDCAOrders,
  cancelDCAOrder,
  getDCAOrderStatus,
  getSwapQuote,
  getDCASystemStatus,
  getUserTokenBalances
} from './tools/dca.js';

// Global variable to store current user frontend wallet address (set by the graph)
let currentUserFrontendWalletAddress: string | null = null;

// Function to set current user frontend wallet address (called by the graph)
export const setCurrentUserFrontendWalletAddress = (frontendWalletAddress: string) => {
  currentUserFrontendWalletAddress = frontendWalletAddress;
};

// Wallet Info Tool
class GetWalletInfoTool extends StructuredTool {
  name = "get_wallet_info";
  description = "Gets information about the user's wallet";
  schema = z.object({});

  async _call(input: z.infer<typeof this.schema>, runManager?: any) {
    try {
      // Get frontend wallet address from global variable
      const frontendWalletAddress = currentUserFrontendWalletAddress;
      
      if (!frontendWalletAddress) {
        return JSON.stringify({ 
          success: false, 
          error: 'User wallet address not found. Please try again.' 
        });
      }

      // Get user from database using frontend wallet address
      const user = await MongoDBService.getWalletByFrontendAddress(frontendWalletAddress);
      
      if (!user) {
        return JSON.stringify({ 
          success: false, 
          error: 'User wallet not found in database' 
        });
      }

      return JSON.stringify({
        success: true,
        walletAddress: user.walletAddress,
        createdAt: user.createdAt,
      });
    } catch (error: any) {
      console.error('Error in get_wallet_info:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message 
      });
    }
  }
}

// Get Wallet for Operations Tool
class GetWalletForOperationsTool extends StructuredTool {
  name = "get_wallet_for_operations";
  description = "Gets the user's wallet information for blockchain operations (includes private key)";
  schema = z.object({});

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      // Get frontend wallet address from global variable
      const frontendWalletAddress = currentUserFrontendWalletAddress;
      
      if (!frontendWalletAddress) {
        return JSON.stringify({ 
          success: false, 
          error: 'User wallet address not found. Please try again.' 
        });
      }

      // Get user from database using frontend wallet address
      const user = await MongoDBService.getWalletByFrontendAddress(frontendWalletAddress);
      
      if (!user) {
        return JSON.stringify({ 
          success: false, 
          error: 'User wallet not found in database' 
        });
      }

      // Get wallet info for operations (includes private key)
      const walletForOps = await MongoDBService.getWalletForOperations(frontendWalletAddress);

      if (!walletForOps) {
        return JSON.stringify({ 
          success: false, 
          error: 'Failed to get wallet for operations' 
        });
      }

      return JSON.stringify({
        success: true,
        walletAddress: walletForOps.address,
        chainId: walletForOps.chainId,
        hasPrivateKey: !!walletForOps.privateKey,
        // Note: private key is encrypted in database
      });
    } catch (error: any) {
      console.error('Error in get_wallet_for_operations:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message 
      });
    }
  }
}

// Get Balance Tool
class GetBalanceTool extends StructuredTool {
  name = "get_balance";
  description = "Gets the balance of the user's wallet";
  schema = z.object({});

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      // Get frontend wallet address from global variable
      const frontendWalletAddress = currentUserFrontendWalletAddress;
      
      if (!frontendWalletAddress) {
        return JSON.stringify({ 
          success: false, 
          error: 'User wallet address not found. Please try again.' 
        });
      }

      // Get user from database using frontend wallet address
      const user = await MongoDBService.getWalletByFrontendAddress(frontendWalletAddress);
      
      if (!user) {
        return JSON.stringify({ 
          success: false, 
          error: 'User wallet not found in database' 
        });
      }

      if (!BlockchainService.isValidAddress(user.walletAddress)) {
        return JSON.stringify({ 
          success: false, 
          error: 'Invalid wallet address format' 
        });
      }

      // Add debugging information
      console.log(`🔍 GetBalanceTool Debug:`);
      console.log(`  - Environment: ${process.env.ENVIRONMENT}`);
      console.log(`  - RPC URL: ${process.env.RPC_URL}`);
      console.log(`  - Chain ID: ${process.env.CHAIN_ID}`);
      console.log(`  - User Address: ${user.walletAddress}`);

      const balance = await BlockchainService.getBalance(user.walletAddress);
      
      console.log(`  - Balance Result:`, balance);
      
      return JSON.stringify({
        success: true,
        address: balance.address,
        balance: balance.balance,
        formatted: balance.formatted,
        symbol: 'XFI',
        debug: {
          environment: process.env.ENVIRONMENT,
          rpcUrl: process.env.RPC_URL,
          chainId: process.env.CHAIN_ID
        }
      });
    } catch (error: any) {
      console.error('Error in get_balance:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message 
      });
    }
  }
}

// Send Transaction Tool
class SendTransactionTool extends StructuredTool {
  name = "send_transaction";
  description = "Sends a transaction from the user's wallet to another address";
  schema = z.object({
    to: z.string().describe("The recipient wallet address"),
    amount: z.string().describe("The amount to send in XFI (e.g., '0.1')"),
    data: z.string().optional().describe("Optional transaction data (hex string)")
  });

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      const { to, amount, data } = input;
      // Get frontend wallet address from global variable
      const frontendWalletAddress = currentUserFrontendWalletAddress;
      if (!frontendWalletAddress) {
        return JSON.stringify({ 
          success: false, 
          error: 'User wallet address not found. Please try again.' 
        });
      }
      // Validate addresses
      if (!BlockchainService.isValidAddress(to)) {
        return JSON.stringify({ 
          success: false, 
          error: 'Invalid recipient address format' 
        });
      }
      // Get user from database
      const user = await MongoDBService.getWalletByFrontendAddress(frontendWalletAddress);
      if (!user) {
        return JSON.stringify({ 
          success: false, 
          error: 'User wallet not found in database' 
        });
      }
      // Send transaction
      // Get user from User model for blockchain operations
      const userModel = await User.findOne({ frontendWalletAddress });
      if (!userModel) {
        return JSON.stringify({ 
          success: false, 
          error: 'User not found in database' 
        });
      }
      const transaction = await BlockchainService.sendTransaction(userModel, to, amount, data);
      
      // Build response object
      const response: any = {
        success: true,
        transactionHash: transaction.hash,
        from: transaction.from,
        to: transaction.to,
        value: transaction.value,
        status: transaction.status,
        reward: transaction.reward,
        explorerUrl: transaction.transactionUrl || null,
        message: 'Transaction sent successfully'
      };
      if ('points' in transaction) {
        response.points = (transaction as any).points;
      }

      // Emit real-time events
      try {
        const io = getIO();
        
        // Emit transaction success
        emitTransactionSuccess(io, user.walletAddress, {
          transactionHash: transaction.hash,
          from: transaction.from,
          to: transaction.to,
          value: transaction.value,
          status: transaction.status,
          explorerUrl: transaction.transactionUrl || null
        });

        // Emit new transaction
        emitNewTransaction(io, user.walletAddress, {
          hash: transaction.hash,
          from: transaction.from,
          to: transaction.to,
          value: transaction.value,
          status: transaction.status,
          timestamp: new Date().toISOString()
        });

        // Emit points earned if any
        if (transaction.reward) {
          emitPointsEarned(io, user.walletAddress, {
            points: transaction.reward.totalPoints,
            reason: transaction.reward.reason,
            transactionHash: transaction.hash
          });
        }

        // Get and emit updated balance
        setTimeout(async () => {
          try {
            const balance = await BlockchainService.getBalance(user.walletAddress);
            emitBalanceUpdate(io, user.walletAddress, {
              address: balance.address,
              balance: balance.balance,
              formatted: balance.formatted,
              symbol: 'XFI'
            });
          } catch (balanceError) {
            console.error('Error fetching updated balance:', balanceError);
          }
        }, 1000); // Wait 1 second for blockchain to update

      } catch (socketError) {
        console.error('Error emitting real-time events:', socketError);
        // Don't fail the transaction if real-time updates fail
      }

      return JSON.stringify(response);
    } catch (error: any) {
      console.error('Error in send_transaction:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message 
      });
    }
  }
}

class SendTokenTool extends StructuredTool {
  name = "send_token";
  description = "Sends USDT or USDC tokens from the user's wallet to another address. Use this when user says 'send USDT', 'transfer USDC', 'send 10 USDT to address', etc.";
  schema = z.object({
    token: z.enum(["USDT", "USDC"]).describe("The token to send (USDT or USDC)"),
    to: z.string().describe("The recipient wallet address"),
    amount: z.string().describe("The amount to send (e.g., '10.5')")
  });

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      const { token, to, amount } = input;
      
      // Get frontend wallet address from global variable
      const frontendWalletAddress = currentUserFrontendWalletAddress;
      if (!frontendWalletAddress) {
        return JSON.stringify({ 
          success: false, 
          error: 'User wallet address not found. Please try again.' 
        });
      }

      // Validate recipient address
      if (!BlockchainService.isValidAddress(to)) {
        return JSON.stringify({ 
          success: false, 
          error: 'Invalid recipient address format' 
        });
      }

      // Get user from database
      const user = await MongoDBService.getWalletByFrontendAddress(frontendWalletAddress);
      if (!user) {
        return JSON.stringify({ 
          success: false, 
          error: 'User wallet not found in database' 
        });
      }

      // Get user model for TokenService
      const userModel = await User.findOne({ frontendWalletAddress });
      if (!userModel) {
        return JSON.stringify({ 
          success: false, 
          error: 'User not found in database' 
        });
      }

      // Get token address
      const tokenAddress = TOKEN_ADDRESSES[token];
      if (!tokenAddress) {
        return JSON.stringify({ 
          success: false, 
          error: `Token ${token} not supported` 
        });
      }

      // Validate sufficient balance
      const validation = await TokenService.validateSufficientBalance(
        tokenAddress,
        user.walletAddress,
        amount
      );

      if (!validation.sufficient) {
        return JSON.stringify({
          success: false,
          error: `Insufficient ${token} balance. Required: ${amount}, Available: ${validation.balance}`,
          balance: validation.balance,
          required: validation.required
        });
      }

      // Transfer the token
      const result = await TokenService.transferToken(userModel, tokenAddress, to, amount);
      
      if (!result.success) {
        return JSON.stringify({
          success: false,
          error: result.error || 'Token transfer failed'
        });
      }

      // Build response object
      const response: any = {
        success: true,
        transactionHash: result.transactionHash,
        from: user.walletAddress,
        to: to,
        token: token,
        amount: amount,
        status: 'success',
        message: `${amount} ${token} sent successfully`,
        explorerUrl: `${process.env.ENVIRONMENT === 'production' ? 'https://xfiscan.com' : 'https://test.xfiscan.com'}/tx/${result.transactionHash}`
      };

      // Emit real-time events
      try {
        const io = getIO();
        
        // Emit transaction success
        emitTransactionSuccess(io, user.walletAddress, {
          transactionHash: result.transactionHash!,
          from: user.walletAddress,
          to: to,
          value: `${amount} ${token}`,
          status: 'success',
          explorerUrl: response.explorerUrl
        });

        // Emit new transaction
        emitNewTransaction(io, user.walletAddress, {
          hash: result.transactionHash!,
          from: user.walletAddress,
          to: to,
          value: `${amount} ${token}`,
          status: 'success',
          timestamp: new Date().toISOString()
        });

        // Get and emit updated balance
        setTimeout(async () => {
          try {
            const balances = await TokenService.getDCATokenBalances(user.walletAddress);
            const tokenBalance = balances.find(b => b.symbol === token);
            if (tokenBalance) {
              emitBalanceUpdate(io, user.walletAddress, {
                address: user.walletAddress,
                balance: tokenBalance.balance,
                formatted: tokenBalance.formatted,
                symbol: token
              });
            }
          } catch (balanceError) {
            console.error('Error fetching updated balance:', balanceError);
          }
        }, 1000); // Wait 1 second for blockchain to update

      } catch (socketError) {
        console.error('Error emitting real-time events:', socketError);
        // Don't fail the transaction if real-time updates fail
      }

      return JSON.stringify(response);
    } catch (error: any) {
      console.error('Error in send_token:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message 
      });
    }
  }
}

// Get Transaction History Tool
class GetTransactionHistoryTool extends StructuredTool {
  name = "get_transaction_history";
  description = "Gets transaction history for the user's wallet";
  schema = z.object({
    limit: z.number().optional().describe("Number of transactions to return (default: 10)")
  });

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      const { limit = 10 } = input;
      
      // Get privyId from global variable
      const frontendWalletAddress = currentUserFrontendWalletAddress;
      
      if (!frontendWalletAddress) {
        return JSON.stringify({ 
          success: false, 
          error: 'User ID not found. Please try again.' 
        });
      }

      // Get user from database
      const user = await MongoDBService.getWalletByFrontendAddress(frontendWalletAddress);
      
      if (!user) {
        return JSON.stringify({ 
          success: false, 
          error: 'User wallet not found in database' 
        });
      }

      if (!BlockchainService.isValidAddress(user.walletAddress)) {
        return JSON.stringify({ 
          success: false, 
          error: 'Invalid wallet address format' 
        });
      }

      const transactions = await BlockchainService.getTransactionHistory(user.walletAddress, limit);
      
      return JSON.stringify({
        success: true,
        address: user.walletAddress,
        transactions: transactions.map(tx => ({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: tx.value,
          status: tx.status
        }))
      });
    } catch (error: any) {
      console.error('Error in get_transaction_history:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message 
      });
    }
  }
}

// Get User Stats Tool
class GetUserStatsTool extends StructuredTool {
  name = "get_user_stats";
  description = "Gets the current user's gamification stats (points, rank, achievements)";
  schema = z.object({});

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      // Get privyId from global variable
      const frontendWalletAddress = currentUserFrontendWalletAddress;
      
      if (!frontendWalletAddress) {
        return JSON.stringify({ 
          success: false, 
          error: 'User ID not found. Please try again.' 
        });
      }

      // Get user from database
      const user = await MongoDBService.getWalletByFrontendAddress(frontendWalletAddress);
      
      if (!user) {
        return JSON.stringify({ 
          success: false, 
          error: 'User wallet not found in database' 
        });
      }

      // Get user stats
      const stats = await GamificationService.getUserStats(frontendWalletAddress);
      
      if (!stats) {
        return JSON.stringify({ 
          success: false, 
          error: 'Failed to get user stats' 
        });
      }

      // Get achievements
      const milestones = GamificationService.getAchievementMilestones();
      const userAchievements = milestones.map(milestone => ({
        name: milestone.name,
        description: milestone.description,
        achieved: stats.totalVolume >= milestone.volumeRequired,
        progress: Math.min((stats.totalVolume / milestone.volumeRequired) * 100, 100)
      }));

      return JSON.stringify({
        success: true,
        stats: {
          points: stats.points,
          totalVolume: stats.totalVolume,
          rank: stats.rank,
          nextMilestone: stats.nextMilestone,
          nextVolumeMilestone: stats.nextVolumeMilestone
        },
        achievements: userAchievements,
        totalAchievements: milestones.length,
        achievedCount: userAchievements.filter(a => a.achieved).length
      });
    } catch (error: any) {
      console.error('Error in get_user_stats:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message 
      });
    }
  }
}

// Get Leaderboard Tool
class GetLeaderboardTool extends StructuredTool {
  name = "get_leaderboard";
  description = "Gets the global leaderboard showing top users by points";
  schema = z.object({
    limit: z.number().optional().describe("Number of top users to return (default: 10)")
  });

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      const { limit = 10 } = input;
      
      // Get leaderboard
      const leaderboard = await GamificationService.getLeaderboard(limit);
      
      // Get current user's position if they're authenticated
      let userPosition = null;
      const frontendWalletAddress = currentUserFrontendWalletAddress;
      
      if (frontendWalletAddress) {
        const user = await MongoDBService.getWalletByFrontendAddress(frontendWalletAddress);
        if (user) {
          userPosition = await GamificationService.getUserLeaderboardPosition(frontendWalletAddress);
        }
      }

      return JSON.stringify({
        success: true,
        leaderboard: leaderboard.map(entry => ({
          rank: entry.rank,
          walletAddress: BlockchainService.formatAddress(entry.walletAddress),
          points: entry.points,
          totalVolume: entry.totalVolume
        })),
        userPosition: userPosition ? {
          rank: userPosition.rank,
          totalUsers: userPosition.totalUsers,
          percentile: userPosition.percentile
        } : null,
        totalUsers: leaderboard.length > 0 ? Math.max(...leaderboard.map(l => l.rank)) : 0
      });
    } catch (error: any) {
      console.error('Error in get_leaderboard:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message 
      });
    }
  }
}

// Set Username Tool
class SetUsernameTool extends StructuredTool {
  name = "set_username";
  description = "Set or update the user's public username (3-20 chars, alphanumeric or underscores, must be unique)";
  schema = z.object({
    username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/).describe("The new username to set")
  });

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      const { username } = input;
      const frontendWalletAddress = currentUserFrontendWalletAddress;
      if (!frontendWalletAddress) {
        return JSON.stringify({ success: false, error: 'User ID not found. Please try again.' });
      }
      const user = await MongoDBService.getWalletByFrontendAddress(frontendWalletAddress);
      if (!user) {
        return JSON.stringify({ success: false, error: 'User wallet not found in database' });
      }
      
      // Validate username format
      if (!username || typeof username !== 'string' || username.length < 3 || username.length > 20 || !/^[a-zA-Z0-9_]+$/.test(username)) {
        return JSON.stringify({ success: false, error: 'Invalid username. Must be 3-20 characters, alphanumeric or underscores.' });
      }
      
      // Check uniqueness
      const existing = await User.findOne({ username: username }) as any;
      if (existing && existing.frontendWalletAddress !== frontendWalletAddress) {
        return JSON.stringify({ success: false, error: 'Username already taken' });
      }
      
      // Update user using User model
      const userModel = await User.findOne({ frontendWalletAddress });
      if (userModel) {
        userModel.username = username;
        await userModel.save();
      }
      
      return JSON.stringify({ success: true, username });
    } catch (error: any) {
      console.error('Error in set_username:', error);
      return JSON.stringify({ success: false, error: error.message });
    }
  }
}

// Create Global Payment Link Tool (Explicit)
class CreateGlobalPaymentLinkTool extends StructuredTool {
  name = "create_global_payment_link";
  description = "Explicitly creates a global payment link that can accept any amount of contributions from multiple users. Note: The general create_payment_links tool automatically creates global links when no amount is specified.";
  schema = z.object({});

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      // Get privyId from global variable
      const frontendWalletAddress = currentUserFrontendWalletAddress;
      if (!frontendWalletAddress) {
        return JSON.stringify({ 
          success: false, 
          error: 'User ID not found. Please try again.' 
        });
      }
      // Get user from database
      const user = await MongoDBService.getWalletByFrontendAddress(frontendWalletAddress);
      if (!user) {
        return JSON.stringify({ 
          success: false, 
          error: 'User wallet not found in database' 
        });
      }
      // Generate a unique linkID
      const globalLinkID = nanoid(10);
      // Get wallet for operations (includes private key)
      const walletForOps = await MongoDBService.getWalletForOperations(frontendWalletAddress);
      if (!walletForOps) {
        return JSON.stringify({ 
          success: false, 
          error: 'Failed to get wallet for operations' 
        });
      }
      // Create global payment link on blockchain
      const transactionHash = await PaymentLinkService.createGlobalPaymentLinkOnChain(
        walletForOps.privateKey, 
        globalLinkID
      );
      // Create global payment link in database
      const paymentLink = await PaymentLinkService.createGlobalPaymentLink(
        frontendWalletAddress, 
        globalLinkID
      );
      // Return plain JSON (no markdown)
      return JSON.stringify({
        success: true,
        linkID: globalLinkID,
        type: 'global',
        status: paymentLink.status,
        transactionHash: transactionHash,
        paymentUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/global-paylink/${globalLinkID}`,
        shareableLink: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/global-paylink/${globalLinkID}`,
        description: 'Global payment link allows unlimited contributions from multiple users',
        createdAt: paymentLink.createdAt,
        updatedAt: paymentLink.updatedAt
      });
    } catch (error: any) {
      console.error('Error in create_global_payment_link:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message 
      });
    }
  }
}

// Create Payment Links Tool
class CreatePaymentLinksTool extends StructuredTool {
  name = "create_payment_links";
  description = "Creates a payment link. If amount is specified, creates a fixed payment link. If no amount is specified, creates a global payment link that accepts any contributions.";
  schema = z.object({
    amount: z.string().optional().describe("Optional: The amount for a fixed payment link in XFI (e.g., '0.1'). If not provided, creates a global payment link.")
  });

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      const { amount } = input;
      // Get privyId from global variable
      const frontendWalletAddress = currentUserFrontendWalletAddress;
      if (!frontendWalletAddress) {
        return JSON.stringify({ 
          success: false, 
          error: 'User ID not found. Please try again.' 
        });
      }
      // Get user from database
      const user = await MongoDBService.getWalletByFrontendAddress(frontendWalletAddress);
      if (!user) {
        return JSON.stringify({ 
          success: false, 
          error: 'User wallet not found in database' 
        });
      }
      // Generate a unique linkID
      const paymentLinkID = nanoid(10);
      // Get wallet for operations (includes private key)
      const walletForOps = await MongoDBService.getWalletForOperations(frontendWalletAddress);
      if (!walletForOps) {
        return JSON.stringify({ 
          success: false, 
          error: 'Failed to get wallet for operations' 
        });
      }
      // Determine if this should be a global or fixed payment link
      const isGlobal = !amount || amount.trim() === '';
      if (isGlobal) {
        // Create global payment link on blockchain
        const transactionHash = await PaymentLinkService.createGlobalPaymentLinkOnChain(
          walletForOps.privateKey, 
          paymentLinkID
        );
        // Create global payment link in database
        const paymentLink = await PaymentLinkService.createGlobalPaymentLink(
          frontendWalletAddress, 
          paymentLinkID
        );
        // Return plain JSON (no markdown)
        return JSON.stringify({
          success: true,
          linkID: paymentLinkID,
          type: 'global',
          status: paymentLink.status,
          transactionHash: transactionHash,
          paymentUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/global-paylink/${paymentLinkID}`,
          shareableLink: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/global-paylink/${paymentLinkID}`,
          description: 'Global payment link allows unlimited contributions from multiple users',
          createdAt: paymentLink.createdAt,
          updatedAt: paymentLink.updatedAt
        });
      } else {
        // Create fixed payment link on blockchain
        const transactionHash = await PaymentLinkService.createPaymentLinkOnChain(
          walletForOps.privateKey, 
          paymentLinkID, 
          amount
        );
        // Create fixed payment link in database
        const paymentLink = await PaymentLinkService.createPaymentLink(
          frontendWalletAddress, 
          Number(amount), 
          paymentLinkID
        );
        // Return plain JSON (no markdown)
        return JSON.stringify({
          success: true,
          linkID: paymentLinkID,
          type: 'fixed',
          amount: paymentLink.amount,
          status: paymentLink.status,
          transactionHash: transactionHash,
          paymentUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/paylink/${paymentLinkID}`,
          shareableLink: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/paylink/${paymentLinkID}`,
          description: `Fixed payment link for ${amount} XFI`,
          createdAt: paymentLink.createdAt,
          updatedAt: paymentLink.updatedAt
        });
      }
    } catch (error: any) {
      console.error('Error in create_payment_links:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message 
      });
    }
  }
}

// Pay Fixed Payment Link Tool
class PayFixedPaymentLinkTool extends StructuredTool {
  name = "pay_fixed_payment_link";
  description = "Pays a fixed payment link using the link ID";
  schema = z.object({
    linkId: z.string().describe("The ID of the payment link to pay")
  });

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      const { linkId } = input;
      
      // Get privyId from global variable
      const frontendWalletAddress = currentUserFrontendWalletAddress;
      
      if (!frontendWalletAddress) {
        return JSON.stringify({ 
          success: false, 
          error: 'User ID not found. Please try again.' 
        });
      }

      // Get user from database
      const user = await MongoDBService.getWalletByFrontendAddress(frontendWalletAddress);
      
      if (!user) {
        return JSON.stringify({ 
          success: false, 
          error: 'User wallet not found in database' 
        });
      }

      // Get payment link details
      const paymentLink = await PaymentLink.findOne({ linkId }) as any;
      
      if (!paymentLink) {
        return JSON.stringify({ 
          success: false, 
          error: 'Payment link not found' 
        });
      }

      if (paymentLink.status !== 'active') {
        return JSON.stringify({ 
          success: false, 
          error: 'Payment link is no longer active' 
        });
      }

      // Get wallet for operations (includes private key)
      const walletForOps = await MongoDBService.getWalletForOperations(frontendWalletAddress);

      if (!walletForOps) {
        return JSON.stringify({ 
          success: false, 
          error: 'Failed to get wallet for operations' 
        });
      }

      // Use blockchain service to pay the payment link
      const { ContractService } = await import('./services/contract.js');
      const contractService = new ContractService(walletForOps.privateKey);
      
      const result = await contractService.payFixedPaymentLink(linkId, paymentLink.amount.toString());
      
      if (result.success) {
        // Update payment link status to paid
        paymentLink.status = 'paid';
        await paymentLink.save();

        // Emit real-time events
        try {
          const io = getIO();
          
          // Emit transaction success
          emitTransactionSuccess(io, user.walletAddress, {
            transactionHash: result.data.transactionHash,
            from: user.walletAddress,
            to: linkId,
            value: paymentLink.amount.toString(),
            status: 'success',
            explorerUrl: `${process.env.ENVIRONMENT === 'production' ? 'https://xfiscan.com' : 'https://test.xfiscan.com'}/tx/${result.data.transactionHash}`
          });

          // Emit new transaction
          emitNewTransaction(io, user.walletAddress, {
            hash: result.data.transactionHash,
            from: user.walletAddress,
            to: linkId,
            value: paymentLink.amount.toString(),
            status: 'success',
            timestamp: new Date().toISOString()
          });

          // Get and emit updated balance
          setTimeout(async () => {
            try {
              const balance = await BlockchainService.getBalance(user.walletAddress);
              emitBalanceUpdate(io, user.walletAddress, {
                address: balance.address,
                balance: balance.balance,
                formatted: balance.formatted,
                symbol: 'XFI'
              });
            } catch (balanceError) {
              console.error('Error fetching updated balance:', balanceError);
            }
          }, 1000); // Wait 1 second for blockchain to update

        } catch (socketError) {
          console.error('Error emitting real-time events:', socketError);
          // Don't fail the transaction if real-time updates fail
        }

        return JSON.stringify({
          success: true,
          linkId: linkId,
          amount: paymentLink.amount,
          transactionHash: result.data.transactionHash,
          message: `Successfully paid ${paymentLink.amount} XFI for payment link ${linkId}`
        });
      } else {
        return JSON.stringify({ 
          success: false, 
          error: result.error || 'Failed to process payment' 
        });
      }

    } catch (error: any) {
      console.error('Error in pay_fixed_payment_link:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message 
      });
    }
  }
}

// Contribute to Global Payment Link Tool
class ContributeToGlobalPaymentLinkTool extends StructuredTool {
  name = "contribute_to_global_payment_link";
  description = "Allows users to contribute any amount to an existing global payment link";
  schema = z.object({
    linkId: z.string().describe("The ID of the global payment link to contribute to"),
    amount: z.string().describe("The amount to contribute in XFI (e.g., '0.1')")
  });

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      const { linkId, amount } = input;
      
      

      // Get privyId from global variable
      const frontendWalletAddress = currentUserFrontendWalletAddress;
      
      if (!frontendWalletAddress) {
        return JSON.stringify({ 
          success: false, 
          error: 'User ID not found. Please try again.' 
        });
      }

      // Get user from database
      const user = await MongoDBService.getWalletByFrontendAddress(frontendWalletAddress);
      
      if (!user) {
        return JSON.stringify({ 
          success: false, 
          error: 'User wallet not found in database' 
        });
      }

      // First, check if the global payment link exists
      const contractReadService = new ContractReadService();
      const linkStatus = await contractReadService.checkGlobalPaymentLinkStatus(linkId);
      
      if (!linkStatus.success) {
        return JSON.stringify({ 
          success: false, 
          error: `Global payment link '${linkId}' does not exist. Please verify the link ID.` 
        });
      }

      

      // Get wallet for operations (includes private key)
      const walletForOps = await MongoDBService.getWalletForOperations(frontendWalletAddress);

      if (!walletForOps) {
        return JSON.stringify({ 
          success: false, 
          error: 'Failed to get wallet for operations' 
        });
      }

      // Use contract service to contribute to the global payment link
      const { ContractService } = await import('./services/contract.js');
      const contractService = new ContractService(walletForOps.privateKey);
      
      const result = await contractService.contributeToGlobalPaymentLink(linkId, amount);
      
      if (result.success) {
        // Emit real-time events
        try {
          const io = getIO();
          
          // Emit transaction success
          emitTransactionSuccess(io, user.walletAddress, {
            transactionHash: result.data.transactionHash,
            from: user.walletAddress,
            to: linkId,
            value: amount,
            status: 'success',
            explorerUrl: `${process.env.ENVIRONMENT === 'production' ? 'https://xfiscan.com' : 'https://test.xfiscan.com'}/tx/${result.data.transactionHash}`
          });

          // Emit new transaction
          emitNewTransaction(io, user.walletAddress, {
            hash: result.data.transactionHash,
            from: user.walletAddress,
            to: linkId,
            value: amount,
            status: 'success',
            timestamp: new Date().toISOString()
          });

          // Get and emit updated balance
          setTimeout(async () => {
            try {
              const balance = await BlockchainService.getBalance(user.walletAddress);
              emitBalanceUpdate(io, user.walletAddress, {
                address: balance.address,
                balance: balance.balance,
                formatted: balance.formatted,
                symbol: 'XFI'
              });
            } catch (balanceError) {
              console.error('Error fetching updated balance:', balanceError);
            }
          }, 1000); // Wait 1 second for blockchain to update

        } catch (socketError) {
          console.error('Error emitting real-time events:', socketError);
          // Don't fail the transaction if real-time updates fail
        }

        return JSON.stringify({
          success: true,
          linkId: linkId,
          contributionAmount: amount,
          contributionAmountXFI: Number(amount),
          transactionHash: result.data.transactionHash,
          linkCreator: linkStatus.data.creator,
          previousTotal: linkStatus.data.totalContributionsInXFI,
          newEstimatedTotal: linkStatus.data.totalContributionsInXFI + Number(amount),
          explorerUrl: `${process.env.ENVIRONMENT === 'production' ? 'https://xfiscan.com' : 'https://test.xfiscan.com'}/tx/${result.data.transactionHash}`,
          message: `Successfully contributed ${amount} XFI to global payment link ${linkId}`
        });
      } else {
        return JSON.stringify({ 
          success: false, 
          error: result.error || 'Failed to contribute to global payment link' 
        });
      }

    } catch (error: any) {
      console.error('Error in contribute_to_global_payment_link:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message || 'An error occurred while contributing to the global payment link'
      });
    }
  }
}

// Check Payment Link Status Tool
class CheckPaymentLinkStatusTool extends StructuredTool {
  name = "check_payment_link_status";
  description = "Checks the status of a payment link directly from the smart contract. Defaults to checking fixed payment links first, then tries global if not found.";
  schema = z.object({
    linkId: z.string().describe("The ID of the payment link to check"),
    type: z.enum(["fixed", "global"]).optional().describe("Type of payment link (default: fixed - will try global as fallback)")
  });

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      const { linkId, type } = input;
      
      

      const contractReadService = new ContractReadService();
      
      let result;
      let detectedType = type;

      // If type is specified, try it first, otherwise start with fixed
      const firstType = type || "fixed";
      const secondType = firstType === "fixed" ? "global" : "fixed";

      
      
      if (firstType === "global") {

        result = await contractReadService.checkGlobalPaymentLinkStatus(linkId);
      } else {
        result = await contractReadService.checkPaymentLinkStatus(linkId);
      }

      

      // If first attempt fails, try the other type
      if (!result.success) {

        
        if (secondType === "global") {
          result = await contractReadService.checkGlobalPaymentLinkStatus(linkId);
        } else {
          result = await contractReadService.checkPaymentLinkStatus(linkId);
        }
        

        
        if (result.success) {
          detectedType = secondType;
          if (result.data) {
            result.data.type = secondType;
          }
        }
      } else {
        detectedType = firstType;
        if (result.data) {
          result.data.type = firstType;
        }
      }

      if (result.success) {
        return JSON.stringify({
          success: true,
          linkId: linkId,
          data: result.data,
          detectedType: detectedType,
          message: `${detectedType} payment link status retrieved successfully from blockchain`,
          source: 'smart_contract'
        });
      } else {
        return JSON.stringify({
          success: false,
          error: `Payment link '${linkId}' not found as either fixed or global payment link`,
          linkId: linkId
        });
      }

    } catch (error: any) {
      console.error('Error in check_payment_link_status:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message || 'An error occurred while checking payment link status'
      });
    }
  }
}

// DCA (Dollar Cost Averaging) Tools

// Create DCA Order Tool
class CreateDCAOrderTool extends StructuredTool {
  name = "create_dca_order";
  description = "Creates an automated DCA (Dollar Cost Averaging) order to buy or sell XFI when the price reaches a trigger condition. Users can say things like 'buy 10 USDC when XFI hits $0.05' or 'sell 5 XFI if price drops below $0.04'";
  schema = z.object({
    orderType: z.enum(["buy", "sell"]).describe("Order type: 'buy' or 'sell'"),
    amount: z.string().describe("Amount to buy or sell"),
    triggerPrice: z.number().describe("Trigger price for the order"),
    triggerCondition: z.enum(["above", "below"]).describe("Trigger condition: 'above' or 'below'"),
    slippage: z.number().optional().describe("Maximum slippage percentage (default: 5%)"),
    expirationDays: z.number().optional().describe("Order expiration in days (default: 30)")
  });

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      const frontendWalletAddress = currentUserFrontendWalletAddress;
      if (!frontendWalletAddress) {
        return JSON.stringify({ success: false, error: 'User not authenticated. Please try again.' });
      }
      // Validate required fields
      const { orderType, amount, triggerPrice, triggerCondition, slippage, expirationDays } = input;
      if (!orderType || !amount || triggerPrice === undefined || !triggerCondition) {
        return JSON.stringify({ success: false, error: 'Missing required DCA order fields.' });
      }
      const params = {
        userId: frontendWalletAddress,
        orderType,
        amount,
        triggerPrice,
        triggerCondition,
        slippage,
        expirationDays
      };
      const result = await createDCAOrder(params);
      return JSON.stringify(result);
    } catch (error: any) {
      console.error('Error in create_dca_order:', error);
      return JSON.stringify({ success: false, error: error.message });
    }
  }
}

// Get User DCA Orders Tool
class GetUserDCAOrdersTool extends StructuredTool {
  name = "get_user_dca_orders";
  description = "Lists the user's DCA orders with their current status. Can filter by status (active, executed, cancelled, failed, expired)";
  schema = z.object({
    status: z.enum(["active", "executed", "cancelled", "failed", "expired"]).optional().describe("Filter by order status"),
    limit: z.number().optional().describe("Maximum number of orders to return (default: 10)")
  });

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      const frontendWalletAddress = currentUserFrontendWalletAddress;
      if (!frontendWalletAddress) {
        return JSON.stringify({ 
          success: false, 
          error: 'User not authenticated. Please try again.' 
        });
      }

      const result = await getUserDCAOrders({
        userId: frontendWalletAddress,
        ...input
      });

      return JSON.stringify(result);
    } catch (error: any) {
      console.error('Error in get_user_dca_orders:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message 
      });
    }
  }
}

// Cancel DCA Order Tool
class CancelDCAOrderTool extends StructuredTool {
  name = "cancel_dca_order";
  description = "Cancels an active DCA order by order ID";
  schema = z.object({
    orderId: z.string().describe("The ID of the DCA order to cancel")
  });

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      const frontendWalletAddress = currentUserFrontendWalletAddress;
      if (!frontendWalletAddress) {
        return JSON.stringify({ success: false, error: 'User not authenticated. Please try again.' });
      }
      const { orderId } = input;
      if (!orderId) {
        return JSON.stringify({ success: false, error: 'Missing required orderId.' });
      }
      const params = { userId: frontendWalletAddress, orderId };
      const result = await cancelDCAOrder(params);
      return JSON.stringify(result);
    } catch (error: any) {
      console.error('Error in cancel_dca_order:', error);
      return JSON.stringify({ success: false, error: error.message });
    }
  }
}

// Get DCA Order Status Tool
class GetDCAOrderStatusTool extends StructuredTool {
  name = "get_dca_order_status";
  description = "Gets detailed status information for a specific DCA order";
  schema = z.object({
    orderId: z.string().describe("The ID of the DCA order to check")
  });

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      const frontendWalletAddress = currentUserFrontendWalletAddress;
      if (!frontendWalletAddress) {
        return JSON.stringify({ success: false, error: 'User not authenticated. Please try again.' });
      }
      const { orderId } = input;
      if (!orderId) {
        return JSON.stringify({ success: false, error: 'Missing required orderId.' });
      }
      const params = { userId: frontendWalletAddress, orderId };
      const result = await getDCAOrderStatus(params);
      return JSON.stringify(result);
    } catch (error: any) {
      console.error('Error in get_dca_order_status:', error);
      return JSON.stringify({ success: false, error: error.message });
    }
  }
}

// Get Swap Quote Tool
class GetSwapQuoteTool extends StructuredTool {
  name = "get_swap_quote";
  description = "Gets a quote/estimate for a token swap WITHOUT executing it. Use this when user asks for 'quote', 'estimate', 'how much will I get', or 'check price'. DO NOT use this when user says 'swap', 'execute', 'trade', or 'now swap'. Working pairs include: XFI↔USDT, XFI↔USDC, WXFI↔FOMO, WXFI↔WETH, WXFI↔USDC, WXFI↔WBTC, WXFI↔USDT, WXFI↔BNB, WXFI↔SOL, WXFI↔XUSD, USDC↔XUSD, USDT↔XUSD";
  schema = z.object({
          fromToken: z.enum(["XFI", "CFI", "WXFI", "FOMO", "WETH", "USDC", "WBTC", "USDT", "BNB", "SOL", "XUSD"]).describe("Token to swap from"),
      toToken: z.enum(["XFI", "CFI", "WXFI", "FOMO", "WETH", "USDC", "WBTC", "USDT", "BNB", "SOL", "XUSD"]).describe("Token to swap to"),
    amount: z.string().describe("Amount to swap"),
    slippage: z.union([z.number(), z.string()]).optional().describe("Maximum slippage percentage (default: 5%). Can be a number or string.")
  });

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      const { fromToken, toToken, amount, slippage } = input;
      if (!fromToken || !toToken || !amount) {
        return JSON.stringify({ success: false, error: 'Missing required swap quote fields.' });
      }
      
      // Convert slippage to number if it's a string
      let slippageNumber: number | undefined = undefined;
      if (slippage !== undefined) {
        slippageNumber = typeof slippage === 'string' ? parseFloat(slippage) : slippage;
        if (isNaN(slippageNumber)) {
          return JSON.stringify({ success: false, error: 'Invalid slippage value. Must be a number.' });
        }
      }
      
      // Map XFI to CFI since they point to the same address
      const mappedFromToken = fromToken === 'XFI' ? 'CFI' : fromToken;
      const mappedToToken = toToken === 'XFI' ? 'CFI' : toToken;
      
      const params: { fromToken: "XFI" | "CFI" | "WXFI" | "FOMO" | "WETH" | "USDC" | "WBTC" | "USDT" | "BNB" | "SOL" | "XUSD"; toToken: "XFI" | "CFI" | "WXFI" | "FOMO" | "WETH" | "USDC" | "WBTC" | "USDT" | "BNB" | "SOL" | "XUSD"; amount: string; slippage?: number } = {
        fromToken: mappedFromToken,
        toToken: mappedToToken,
        amount
      };
      if (slippageNumber !== undefined) {
        params.slippage = slippageNumber;
      }
      const result = await getSwapQuote(params);
      
      // If the swap fails due to no liquidity, provide helpful guidance
      if (!result.success && result.message.includes('getAmountsOut') && result.message.includes('reverted')) {
        const workingPairs = [
          'WXFI ↔ FOMO', 'WXFI ↔ WETH', 'WXFI ↔ USDC', 'WXFI ↔ WBTC', 
          'WXFI ↔ USDT', 'WXFI ↔ BNB', 'WXFI ↔ SOL', 'WXFI ↔ XUSD',
          'USDC ↔ XUSD', 'USDT ↔ XUSD'
        ];
        
        return JSON.stringify({
          success: false,
          message: `No liquidity pool found for ${params.fromToken} to ${params.toToken}. Most tokens need to be swapped through WXFI as an intermediary. Working pairs: ${workingPairs.join(', ')}. Try swapping ${params.fromToken} to WXFI first, then WXFI to ${params.toToken}.`
        });
      }
      
      return JSON.stringify(result);
    } catch (error: any) {
      console.error('Error in get_swap_quote:', error);
      return JSON.stringify({ success: false, error: error.message });
    }
  }
}

// Get DCA System Status Tool
class GetDCASystemStatusTool extends StructuredTool {
  name = "get_dca_system_status";
  description = "Gets the current status of the DCA monitoring and execution system";
  schema = z.object({});

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      const result = await getDCASystemStatus();
      return JSON.stringify(result);
    } catch (error: any) {
      console.error('Error in get_dca_system_status:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message 
      });
    }
  }
}

// Get User Token Balances Tool
class GetUserTokenBalancesTool extends StructuredTool {
  name = "get_user_token_balances";
  description = "Gets the user's current balances for DCA-supported tokens (XFI, USDC, and USDT)";
  schema = z.object({});

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      const frontendWalletAddress = currentUserFrontendWalletAddress;
      if (!frontendWalletAddress) {
        return JSON.stringify({ 
          success: false, 
          error: 'User not authenticated. Please try again.' 
        });
      }

      const result = await getUserTokenBalances({ userId: frontendWalletAddress });
      return JSON.stringify(result);
    } catch (error: any) {
      console.error('Error in get_user_token_balances:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message 
      });
    }
  }
}

// Add Liquidity Tool
class AddLiquidityTool extends StructuredTool {
  name = "add_liquidity";
  description = "Adds liquidity to the XFI/USDC swap pool. Both XFI and USDC amounts are required to maintain the pool balance.";
  schema = z.object({
    xfiAmount: z.string().describe("Amount of XFI to add to the pool"),
          usdcAmount: z.string().describe("Amount of USDC to add to the pool"),
    slippage: z.number().optional().describe("Maximum slippage percentage (default: 5%)")
  });

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      const frontendWalletAddress = currentUserFrontendWalletAddress;
      if (!frontendWalletAddress) {
        return JSON.stringify({ 
          success: false, 
          error: 'User not authenticated. Please try again.' 
        });
      }

      // Get user from database
      const user = await MongoDBService.getWalletByFrontendAddress(frontendWalletAddress);
      if (!user) {
        return JSON.stringify({ 
          success: false, 
          error: 'User wallet not found in database' 
        });
      }

              const { xfiAmount, usdcAmount, slippage = 5 } = input;
      
              // Get user from User model for blockchain operations
        const userModel = await User.findOne({ frontendWalletAddress });
        if (!userModel) {
          return JSON.stringify({ 
            success: false, 
            error: 'User not found in database' 
          });
        }
        
        return JSON.stringify({
          success: false,
          error: 'Add liquidity functionality is not currently available'
        });
    } catch (error: any) {
      console.error('Error in add_liquidity:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message 
      });
    }
  }
}

// Execute Swap Tool
class ExecuteSwapTool extends StructuredTool {
  name = "execute_swap";
  description = "ACTUALLY EXECUTES a token swap on the blockchain. Use this when user says 'swap', 'execute', 'trade', 'now swap', 'perform swap', or 'do the swap'. This will create a real transaction. Working pairs include: XFI↔USDT, XFI↔USDC, WXFI↔FOMO, WXFI↔WETH, WXFI↔USDC, WXFI↔WBTC, WXFI↔USDT, WXFI↔BNB, WXFI↔SOL, WXFI↔XUSD, USDC↔XUSD, USDT↔XUSD";
  schema = z.object({
    fromToken: z.enum(["XFI", "CFI", "WXFI", "FOMO", "WETH", "USDC", "WBTC", "USDT", "BNB", "SOL", "XUSD"]).describe("Token to swap from"),
    toToken: z.enum(["XFI", "CFI", "WXFI", "FOMO", "WETH", "USDC", "WBTC", "USDT", "BNB", "SOL", "XUSD"]).describe("Token to swap to"),
    fromAmount: z.string().describe("Amount of fromToken to swap"),
    slippage: z.union([z.number(), z.string()]).optional().describe("Maximum slippage percentage (default: 5%). Can be a number or string.")
  });

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      const frontendWalletAddress = currentUserFrontendWalletAddress;
      if (!frontendWalletAddress) {
        return JSON.stringify({ 
          success: false, 
          error: 'User not authenticated. Please try again.' 
        });
      }

      // Get user from database
      const user = await MongoDBService.getWalletByFrontendAddress(frontendWalletAddress);
      if (!user) {
        return JSON.stringify({ 
          success: false, 
          error: 'User wallet not found in database' 
        });
      }

      const { fromToken, toToken, fromAmount, slippage } = input;
      
      // Convert slippage to number if it's a string, default to 5
      let slippageNumber: number = 5;
      if (slippage !== undefined) {
        slippageNumber = typeof slippage === 'string' ? parseFloat(slippage) : slippage;
        if (isNaN(slippageNumber)) {
          return JSON.stringify({ success: false, error: 'Invalid slippage value. Must be a number.' });
        }
      }

      // Map XFI to CFI since they point to the same address
      const mappedFromToken = fromToken === 'XFI' ? 'CFI' : fromToken;
      const mappedToToken = toToken === 'XFI' ? 'CFI' : toToken;

      // Validate that tokens are different
      if (mappedFromToken === mappedToToken) {
        return JSON.stringify({
          success: false,
          error: 'Cannot swap a token for itself. Please choose different tokens.'
        });
      }

      // Get user from User model for SwapService
      const userModel = await User.findOne({ frontendWalletAddress });
      if (!userModel) {
        return JSON.stringify({ 
          success: false, 
          error: 'User not found in database' 
        });
      }

      // First get a quote to validate the swap
      const quote = await SwapService.getSwapQuote({
        fromToken: mappedFromToken,
        toToken: mappedToToken,
        fromAmount,
        slippage: slippageNumber
      });

      // Validate the swap
      const validation = await SwapService.validateSwap(userModel, {
        fromToken: mappedFromToken,
        toToken: mappedToToken,
        fromAmount,
        slippage: slippageNumber
      });

      if (!validation.valid) {
        return JSON.stringify({
          success: false,
          error: validation.error || 'Swap validation failed',
          warnings: validation.warnings,
          balance: validation.balance,
          allowance: validation.allowance,
          needsApproval: validation.needsApproval
        });
      }

      // Execute the swap
      const swapResult = await SwapService.executeSwap(userModel, {
        fromToken: mappedFromToken,
        toToken: mappedToToken,
        fromAmount,
        slippage: slippageNumber
      });

      if (swapResult.success) {
        // Emit real-time events
        try {
          const io = getIO();
          
          // Emit transaction success
          emitTransactionSuccess(io, user.walletAddress, {
            transactionHash: swapResult.transactionHash,
            from: user.walletAddress,
            to: 'Swap Contract',
            value: `${fromAmount} ${fromToken} → ${swapResult.toAmount} ${toToken}`,
            status: 'success',
            explorerUrl: `${process.env.ENVIRONMENT === 'production' ? 'https://xfiscan.com' : 'https://test.xfiscan.com'}/tx/${swapResult.transactionHash}`
          });

          // Emit new transaction
          emitNewTransaction(io, user.walletAddress, {
            hash: swapResult.transactionHash,
            from: user.walletAddress,
            to: 'Swap Contract',
            value: `${fromAmount} ${fromToken} → ${swapResult.toAmount} ${toToken}`,
            status: 'success',
            timestamp: new Date().toISOString()
          });

          // Get and emit updated balance
          setTimeout(async () => {
            try {
              const balance = await BlockchainService.getBalance(user.walletAddress);
              emitBalanceUpdate(io, user.walletAddress, {
                address: balance.address,
                balance: balance.balance,
                formatted: balance.formatted,
                symbol: 'XFI'
              });
            } catch (balanceError) {
              console.error('Error fetching updated balance:', balanceError);
            }
          }, 1000); // Wait 1 second for blockchain to update

        } catch (socketError) {
          console.error('Error emitting real-time events:', socketError);
          // Don't fail the transaction if real-time updates fail
        }

        return JSON.stringify({
          success: true,
          transactionHash: swapResult.transactionHash,
          fromToken,
          toToken,
          fromAmount,
          toAmount: swapResult.toAmount,
          gasUsed: swapResult.gasUsed,
          gasPrice: swapResult.gasPrice,
          explorerUrl: `${process.env.ENVIRONMENT === 'production' ? 'https://xfiscan.com' : 'https://test.xfiscan.com'}/tx/${swapResult.transactionHash}`,
          message: `Successfully swapped ${fromAmount} ${fromToken} for ${swapResult.toAmount} ${toToken}`
        });
      } else {
        return JSON.stringify({
          success: false,
          error: swapResult.error || 'Swap execution failed',
          errorCode: swapResult.errorCode
        });
      }

    } catch (error: any) {
      console.error('Error in execute_swap:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message 
      });
    }
  }
}

// Get Supported Swap Tokens Tool
class GetSupportedSwapTokensTool extends StructuredTool {
  name = "get_supported_swap_tokens";
  description = "Gets the list of supported tokens for swapping";
  schema = z.object({});

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      const supportedTokens = SwapService.getSupportedPairs();
      const swapConfig = SwapService.getSwapConfig();
      
      return JSON.stringify({
        success: true,
        supportedTokens: swapConfig.SUPPORTED_TOKENS,
        tradingPairs: supportedTokens.map(pair => ({
          from: pair.from,
          to: pair.to,
          description: pair.description
        })),
        totalPairs: supportedTokens.length,
        config: {
          defaultSlippage: swapConfig.DEFAULT_SLIPPAGE,
          minSlippage: swapConfig.MIN_SLIPPAGE,
          maxSlippage: swapConfig.MAX_SLIPPAGE,
          deadlineMinutes: swapConfig.DEADLINE_MINUTES
        }
      });
    } catch (error: any) {
      console.error('Error in get_supported_swap_tokens:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message 
      });
    }
  }
}

// Export tools list
export const ALL_TOOLS_LIST = [
  // Wallet & Transaction Tools
  new GetWalletInfoTool(),
  new GetWalletForOperationsTool(),
  new GetBalanceTool(),
  new SendTransactionTool(),
  new SendTokenTool(),
  new GetTransactionHistoryTool(),
  
  // Gamification Tools
  new GetUserStatsTool(),
  new GetLeaderboardTool(),
  new SetUsernameTool(),
  
  // Payment Link Tools
  new CreateGlobalPaymentLinkTool(),
  new CreatePaymentLinksTool(),
  new PayFixedPaymentLinkTool(),
  new ContributeToGlobalPaymentLinkTool(),
  new CheckPaymentLinkStatusTool(),
  
  // Crypto Assistant Tools - CrossFi Ecosystem Insights
  ...CRYPTO_ASSISTANT_TOOLS,

  // XFI Price Analysis Tools
  XFIPriceChartTool,
  XFIMarketDataTool,
  XFITradingSignalsTool,
  XFIPricePredictionTool,
  XFIMarketComparisonTool,

  // DCA (Dollar Cost Averaging) Tools
  new CreateDCAOrderTool(),
  new GetUserDCAOrdersTool(),
  new CancelDCAOrderTool(),
  new GetDCAOrderStatusTool(),
  new GetSwapQuoteTool(),
  new GetDCASystemStatusTool(),
  new GetUserTokenBalancesTool(),
  
  // Swap Tools
  new ExecuteSwapTool(),
  new GetSupportedSwapTokensTool(),
  
  // Liquidity Tools
  new AddLiquidityTool(),
];

// Create Intelligent Tool with access to all other tools
const intelligentTool = new IntelligentTool(ALL_TOOLS_LIST);

// Add Intelligent Tool to the beginning of the list
export const ALL_TOOLS_LIST_WITH_INTELLIGENT = [
  intelligentTool,
  ...ALL_TOOLS_LIST
]; 