import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { WalletService } from "./services/wallet.js";
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

// Global variable to store current user ID (set by the graph)
let currentUserId: string | null = null;

// Function to set current user ID (called by the graph)
export const setCurrentUserId = (userId: string) => {
  console.log('Setting currentUserId to:', userId);
  currentUserId = userId;
};

// Wallet Info Tool
class GetWalletInfoTool extends StructuredTool {
  name = "get_wallet_info";
  description = "Gets information about the user's wallet";
  schema = z.object({}) as any;

  async _call(input: z.infer<typeof this.schema>, runManager?: any) {
    try {
      // Get wallet address from global variable (this is our database wallet address)
      const walletAddress = currentUserId;

      console.log('Current wallet address:', currentUserId);
      
      if (!walletAddress) {
        return JSON.stringify({ 
          success: false, 
          error: 'Wallet address not found. Please try again.' 
        }) as any;
      }

      console.log('Getting wallet info for address:', walletAddress);

      // Get user from database using frontend wallet address
      const user = await WalletService.getWalletByAddress(walletAddress);

      console.log('User found:', !!user);
      
      if (!user) {
        return JSON.stringify({ 
          success: false, 
          error: 'User wallet not found in database' 
        }) as any;
      }

      return JSON.stringify({
        success: true,
        walletAddress: user.walletAddress,
        chainId: user.chainId,
        createdAt: user.createdAt,
      }) as any;
    } catch (error: any) {
      console.error('Error in get_wallet_info:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message 
      }) as any;
    }
  }
}

// Get Wallet for Operations Tool
class GetWalletForOperationsTool extends StructuredTool {
  name = "get_wallet_for_operations";
  description = "Gets the user's wallet information for blockchain operations (includes private key)";
  schema = z.object({}) as any;

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      // Get wallet address from global variable
      const walletAddress = currentUserId;
      
      
      if (!walletAddress) {
        return JSON.stringify({ 
          success: false, 
          error: 'Wallet address not found. Please try again.' 
        }) as any;
      }

      console.log('Getting wallet for operations:', walletAddress);

      // Get user from database using frontend wallet address
      const user = await WalletService.getWalletByAddress(walletAddress);
      
      if (!user) {
        return JSON.stringify({ 
          success: false, 
          error: 'User wallet not found in database' 
        }) as any;
      }

      // Get wallet info for operations (includes private key)
      const walletForOps = await WalletService.getWalletForOperations(user.privyId);

      if (!walletForOps) {
        return JSON.stringify({ 
          success: false, 
          error: 'Failed to get wallet for operations' 
        }) as any;
      }

      return JSON.stringify({
        success: true,
        walletAddress: walletForOps.address,
        chainId: walletForOps.chainId,
        hasPrivateKey: !!walletForOps.privateKey,
        // Note: private key is encrypted in database
      }) as any;
    } catch (error: any) {
      console.error('Error in get_wallet_for_operations:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message 
      }) as any;
    }
  }
}

// Get Balance Tool
class GetBalanceTool extends StructuredTool {
  name = "get_balance";
  description = "Gets the balance of the user's wallet";
  schema = z.object({}) as any;

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      // Get wallet address from global variable (user's wallet address from database)
      const walletAddress = currentUserId;
      
      console.log('GetBalanceTool - Current wallet address:', currentUserId);
      console.log('GetBalanceTool - walletAddress variable:', walletAddress);
      
      if (!walletAddress) {
        return JSON.stringify({ 
          success: false, 
          error: 'Wallet address not found. Please try again.' 
        }) as any;
      }

      if (!BlockchainService.isValidAddress(walletAddress)) {
        return JSON.stringify({ 
          success: false, 
          error: 'Invalid wallet address format' 
        }) as any;
      }

      const balance = await BlockchainService.getBalance(walletAddress);
      
      return JSON.stringify({
        success: true,
        address: balance.address,
        balance: balance.balance,
        formatted: balance.formatted,
        symbol: 'XFI'
      }) as any;
    } catch (error: any) {
      console.error('Error in get_balance:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message 
      }) as any;
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
  }) as any;

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      const { to, amount, data } = input;
      
      // Get wallet address from global variable
      const walletAddress = currentUserId;
      
      if (!walletAddress) {
        return JSON.stringify({ 
          success: false, 
          error: 'Wallet address not found. Please try again.' 
        }) as any;
      }

      // Validate addresses
      if (!BlockchainService.isValidAddress(to)) {
        return JSON.stringify({ 
          success: false, 
          error: 'Invalid recipient address format' 
        }) as any;
      }

      // Get user from database
      const user = await WalletService.getWalletByAddress(walletAddress);
      
      if (!user) {
        return JSON.stringify({ 
          success: false, 
          error: 'User wallet not found in database' 
        }) as any;
      }

      // Send transaction
      const transaction = await BlockchainService.sendTransaction(user, to, amount, data);
      
      return JSON.stringify({
        success: true,
        transactionHash: transaction.hash,
        from: transaction.from,
        to: transaction.to,
        value: transaction.value,
        status: transaction.status,
        reward: transaction.reward,
        transactionUrl: transaction.transactionUrl || null,
        transactionExplorerLink: transaction.transactionUrl
          ? `<a href="${transaction.transactionUrl}" target="_blank" rel="noopener noreferrer">view on explorer</a>`
          : null
      }) as any;
    } catch (error: any) {
      console.error('Error in send_transaction:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message 
      }) as any;
    }
  }
}

// Get Transaction History Tool
class GetTransactionHistoryTool extends StructuredTool {
  name = "get_transaction_history";
  description = "Gets transaction history for the user's wallet";
  schema = z.object({
    limit: z.number().optional().describe("Number of transactions to return (default: 10)")
  }) as any;

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      const { limit = 10 } = input;
      
      // Get wallet address from global variable (user's wallet address from database)
      const walletAddress = currentUserId;
      
      if (!walletAddress) {
        return JSON.stringify({ 
          success: false, 
          error: 'Wallet address not found. Please try again.' 
        }) as any;
      }

      if (!BlockchainService.isValidAddress(walletAddress)) {
        return JSON.stringify({ 
          success: false, 
          error: 'Invalid wallet address format' 
        }) as any;
      }

      const transactions = await BlockchainService.getTransactionHistory(walletAddress, limit);
      
      return JSON.stringify({
        success: true,
        address: walletAddress,
        transactions: transactions.map(tx => ({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: tx.value,
          status: tx.status
        }))
      }) as any;
    } catch (error: any) {
      console.error('Error in get_transaction_history:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message 
      }) as any;
    }
  }
}

// Get User Stats Tool
class GetUserStatsTool extends StructuredTool {
  name = "get_user_stats";
  description = "Gets the current user's gamification stats (points, rank, achievements)";
  schema = z.object({}) as any;

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      // Get wallet address from global variable
      const walletAddress = currentUserId;
      
      if (!walletAddress) {
        return JSON.stringify({ 
          success: false, 
          error: 'Wallet address not found. Please try again.' 
        }) as any;
      }

      // Get user from database
      const user = await WalletService.getWalletByAddress(walletAddress);
      
      if (!user) {
        return JSON.stringify({ 
          success: false, 
          error: 'User wallet not found in database' 
        }) as any;
      }

      // Get user stats
      const stats = await GamificationService.getUserStats(user.privyId);
      
      if (!stats) {
        return JSON.stringify({ 
          success: false, 
          error: 'Failed to get user stats' 
        }) as any;
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
      }) as any;
    } catch (error: any) {
      console.error('Error in get_user_stats:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message 
      }) as any;
    }
  }
}

// Get Leaderboard Tool
class GetLeaderboardTool extends StructuredTool {
  name = "get_leaderboard";
  description = "Gets the global leaderboard showing top users by points";
  schema = z.object({
    limit: z.number().optional().describe("Number of top users to return (default: 10)")
  }) as any;

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      const { limit = 10 } = input;
      
      // Get leaderboard
      const leaderboard = await GamificationService.getLeaderboard(limit);
      
      // Get current user's position if they're authenticated
      let userPosition = null;
      const walletAddress = currentUserId;
      
      if (walletAddress) {
        const user = await WalletService.getWalletByAddress(walletAddress);
        if (user) {
          userPosition = await GamificationService.getUserLeaderboardPosition(user.privyId);
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
      }) as any;
    } catch (error: any) {
      console.error('Error in get_leaderboard:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message 
      }) as any;
    }
  }
}

// Set Username Tool
class SetUsernameTool extends StructuredTool {
  name = "set_username";
  description = "Set or update the user's public username (3-20 chars, alphanumeric or underscores, must be unique)";
  schema = z.object({
    username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/).describe("The new username to set")
  }) as any;

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      const { username } = input;
      const walletAddress = currentUserId;
      if (!walletAddress) {
        return JSON.stringify({ success: false, error: 'Wallet address not found. Please try again.' }) as any;
      }
      const user = await WalletService.getWalletByAddress(walletAddress);
      if (!user) {
        return JSON.stringify({ success: false, error: 'User wallet not found in database' }) as any;
      }
      
      // Validate username format
      if (!username || typeof username !== 'string' || username.length < 3 || username.length > 20 || !/^[a-zA-Z0-9_]+$/.test(username)) {
        return JSON.stringify({ success: false, error: 'Invalid username. Must be 3-20 characters, alphanumeric or underscores.' }) as any;
      }
      
      // Check uniqueness
      const existing = await User.findOne({ username: username }) as any;
      if (existing && existing.privyId !== user.privyId) {
        return JSON.stringify({ success: false, error: 'Username already taken' }) as any;
      }
      
      // Update user
      user.username = username;
      await user.save();
      
      return JSON.stringify({ success: true, username }) as any;
    } catch (error: any) {
      console.error('Error in set_username:', error);
      return JSON.stringify({ success: false, error: error.message }) as any;
    }
  }
}

// Create Global Payment Link Tool (Explicit)
class CreateGlobalPaymentLinkTool extends StructuredTool {
  name = "create_global_payment_link";
  description = "Explicitly creates a global payment link that can accept any amount of contributions from multiple users. Note: The general create_payment_links tool automatically creates global links when no amount is specified.";
  schema = z.object({}) as any;

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      // Get wallet address from global variable
      const walletAddress = currentUserId;
      
      if (!walletAddress) {
        return JSON.stringify({ 
          success: false, 
          error: 'Wallet address not found. Please try again.' 
        }) as any;
      }

      // Get user from database
      const user = await WalletService.getWalletByAddress(walletAddress);
      
      if (!user) {
        return JSON.stringify({ 
          success: false, 
          error: 'User wallet not found in database' 
        }) as any;
      }

      // Generate a unique linkID
      const globalLinkID = nanoid(10);

      // Get wallet for operations (includes private key)
      const walletForOps = await WalletService.getWalletForOperations(user.privyId);

      if (!walletForOps) {
        return JSON.stringify({ 
          success: false, 
          error: 'Failed to get wallet for operations' 
        }) as any;
      }

      // Create global payment link on blockchain
      const transactionHash = await PaymentLinkService.createGlobalPaymentLinkOnChain(
        walletForOps.privateKey, 
        globalLinkID
      );

      // Create global payment link in database
      const paymentLink = await PaymentLinkService.createGlobalPaymentLink(
        user.privyId, 
        globalLinkID
      );

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
      }) as any;
    } catch (error: any) {
      console.error('Error in create_global_payment_link:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message 
      }) as any;
    }
  }
}

// Create Payment Links Tool
class CreatePaymentLinksTool extends StructuredTool {
  name = "create_payment_links";
  description = "Creates a payment link. If amount is specified, creates a fixed payment link. If no amount is specified, creates a global payment link that accepts any contributions.";
  schema = z.object({
    amount: z.string().optional().describe("Optional: The amount for a fixed payment link in XFI (e.g., '0.1'). If not provided, creates a global payment link.")
  }) as any;

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      const { amount } = input;
      
      // Get wallet address from global variable
      const walletAddress = currentUserId;
      
      if (!walletAddress) {
        return JSON.stringify({ 
          success: false, 
          error: 'Wallet address not found. Please try again.' 
        }) as any;
      }

      // Get user from database
      const user = await WalletService.getWalletByAddress(walletAddress);
      
      if (!user) {
        return JSON.stringify({ 
          success: false, 
          error: 'User wallet not found in database' 
        }) as any;
      }

      // Generate a unique linkID
      const paymentLinkID = nanoid(10);

      // Get wallet for operations (includes private key)
      const walletForOps = await WalletService.getWalletForOperations(user.privyId);

      if (!walletForOps) {
        return JSON.stringify({ 
          success: false, 
          error: 'Failed to get wallet for operations' 
        }) as any;
      }

      // Determine if this should be a global or fixed payment link
      const isGlobal = !amount || amount.trim() === '';
      
      if (isGlobal) {
        console.log('Creating global payment link (no amount specified)');
        
        // Create global payment link on blockchain
        const transactionHash = await PaymentLinkService.createGlobalPaymentLinkOnChain(
          walletForOps.privateKey, 
          paymentLinkID
        );

        // Create global payment link in database
        const paymentLink = await PaymentLinkService.createGlobalPaymentLink(
          user.privyId, 
          paymentLinkID
        );

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
        }) as any;
      } else {
        console.log(`Creating fixed payment link with amount: ${amount} XFI`);
        
        // Create fixed payment link on blockchain
        const transactionHash = await PaymentLinkService.createPaymentLinkOnChain(
          walletForOps.privateKey, 
          paymentLinkID, 
          amount
        );

        // Create fixed payment link in database
        const paymentLink = await PaymentLinkService.createPaymentLink(
          user.privyId, 
          Number(amount), 
          paymentLinkID
        );

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
        }) as any;
      }
    } catch (error: any) {
      console.error('Error in create_payment_links:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message 
      }) as any;
    }
  }
}

// Pay Fixed Payment Link Tool
class PayFixedPaymentLinkTool extends StructuredTool {
  name = "pay_fixed_payment_link";
  description = "Pays a fixed payment link using the link ID";
  schema = z.object({
    linkId: z.string().describe("The ID of the payment link to pay")
  }) as any;

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      const { linkId } = input;
      
      // Get wallet address from global variable
      const walletAddress = currentUserId;
      
      if (!walletAddress) {
        return JSON.stringify({ 
          success: false, 
          error: 'Wallet address not found. Please try again.' 
        } ) as any;
      }

      // Get user from database
      const user = await WalletService.getWalletByAddress(walletAddress);
      
      if (!user) {
        return JSON.stringify({ 
          success: false, 
          error: 'User wallet not found in database' 
        }) as any;
      }

      // Get payment link details
      const paymentLink = await PaymentLink.findOne({ linkId }) as any;
      
      if (!paymentLink) {
        return JSON.stringify({ 
          success: false, 
          error: 'Payment link not found' 
        }) as any;
      }

      if (paymentLink.status !== 'active') {
        return JSON.stringify({ 
          success: false, 
          error: 'Payment link is no longer active' 
        }) as any;
      }

      // Get wallet for operations (includes private key)
      const walletForOps = await WalletService.getWalletForOperations(user.privyId);

      if (!walletForOps) {
        return JSON.stringify({ 
          success: false, 
          error: 'Failed to get wallet for operations' 
        }) as any;
      }

      // Use blockchain service to pay the payment link
      const { ContractService } = await import('./services/contract.js');
      const contractService = new ContractService(walletForOps.privateKey);
      
      const result = await contractService.payFixedPaymentLink(linkId, paymentLink.amount.toString());
      
      if (result.success) {
        // Update payment link status to paid
        paymentLink.status = 'paid';
        await paymentLink.save();

        return JSON.stringify({
          success: true,
          linkId: linkId,
          amount: paymentLink.amount,
          transactionHash: result.data.transactionHash,
          message: `Successfully paid ${paymentLink.amount} XFI for payment link ${linkId}`
        }) as any;
      } else {
        return JSON.stringify({ 
          success: false, 
          error: result.error || 'Failed to process payment' 
        }) as any;
      }

    } catch (error: any) {
      console.error('Error in pay_fixed_payment_link:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message 
      }) as any;
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
  }) as any;

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      const { linkId, amount } = input;
      
      console.log(`Tool called: contribute to global payment link ${linkId} with amount ${amount} XFI`);

      // Get wallet address from global variable
      const walletAddress = currentUserId;
      
      if (!walletAddress) {
        return JSON.stringify({ 
          success: false, 
          error: 'Wallet address not found. Please try again.' 
        }) as any;
      }

      // Get user from database
      const user = await WalletService.getWalletByAddress(walletAddress);
      
      if (!user) {
        return JSON.stringify({ 
          success: false, 
          error: 'User wallet not found in database' 
        }) as any;
      }

      // First, check if the global payment link exists
      const contractReadService = new ContractReadService();
      const linkStatus = await contractReadService.checkGlobalPaymentLinkStatus(linkId);
      
      if (!linkStatus.success) {
        return JSON.stringify({ 
          success: false, 
          error: `Global payment link '${linkId}' does not exist. Please verify the link ID.` 
        }) as any;
      }

      console.log('Global payment link found:', linkStatus.data);

      // Get wallet for operations (includes private key)
      const walletForOps = await WalletService.getWalletForOperations(user.privyId);

      if (!walletForOps) {
        return JSON.stringify({ 
          success: false, 
          error: 'Failed to get wallet for operations' 
        }) as any;
      }

      // Use contract service to contribute to the global payment link
      const { ContractService } = await import('./services/contract.js');
      const contractService = new ContractService(walletForOps.privateKey);
      
      const result = await contractService.contributeToGlobalPaymentLink(linkId, amount);
      
      if (result.success) {
        return JSON.stringify({
          success: true,
          linkId: linkId,
          contributionAmount: amount,
          contributionAmountXFI: Number(amount),
          transactionHash: result.data.transactionHash,
          linkCreator: linkStatus.data.creator,
          previousTotal: linkStatus.data.totalContributionsInXFI,
          newEstimatedTotal: linkStatus.data.totalContributionsInXFI + Number(amount),
          message: `Successfully contributed ${amount} XFI to global payment link ${linkId}`,
          transactionUrl: `https://test.xfiscan.com/tx/${result.data.transactionHash}`,
          explorerLink: `<a href="https://test.xfiscan.com/tx/${result.data.transactionHash}" target="_blank" rel="noopener noreferrer">View on Explorer</a>`
        }) as any;
      } else {
        return JSON.stringify({ 
          success: false, 
          error: result.error || 'Failed to contribute to global payment link' 
        }) as any;
      }

    } catch (error: any) {
      console.error('Error in contribute_to_global_payment_link:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message || 'An error occurred while contributing to the global payment link'
      }) as any;
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
  }) as any;

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      const { linkId, type } = input;
      
      console.log(`Tool called with linkId: ${linkId}, type: ${type || 'not specified (will auto-detect)'}`);

      const contractReadService = new ContractReadService();
      
      let result;
      let detectedType = type;

      // If type is specified, try it first, otherwise start with fixed
      const firstType = type || "fixed";
      const secondType = firstType === "fixed" ? "global" : "fixed";

      console.log(`Trying ${firstType} payment link first...`);
      
      if (firstType === "global") {
        console.log('Checking global payment link status...', linkId,type);
        result = await contractReadService.checkGlobalPaymentLinkStatus(linkId);
      } else {
        result = await contractReadService.checkPaymentLinkStatus(linkId);
      }

      console.log(`${firstType} result:`, result.success ? 'SUCCESS' : `FAILED - ${result.error}`);

      // If first attempt fails, try the other type
      if (!result.success) {
        console.log(`Trying ${secondType} payment link...`);
        
        if (secondType === "global") {
          result = await contractReadService.checkGlobalPaymentLinkStatus(linkId);
        } else {
          result = await contractReadService.checkPaymentLinkStatus(linkId);
        }
        
        console.log(`${secondType} result:`, result.success ? 'SUCCESS' : `FAILED - ${result.error}`);
        
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
        }) as any;
      } else {
        return JSON.stringify({
          success: false,
          error: `Payment link '${linkId}' not found as either fixed or global payment link`,
          linkId: linkId
        } ) as any;
      }

    } catch (error: any) {
      console.error('Error in check_payment_link_status:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message || 'An error occurred while checking payment link status'
      }) as any;
    }
  }
}

// DCA (Dollar Cost Averaging) Tools

// Create DCA Order Tool
class CreateDCAOrderTool extends StructuredTool {
  name = "create_dca_order";
  description = "Creates an automated DCA (Dollar Cost Averaging) order to buy or sell XFI when the price reaches a trigger condition. Users can say things like 'buy 10 tUSDC when XFI hits $0.05' or 'sell 5 XFI if price drops below $0.04'";
  schema = z.object({
    orderType: z.enum(["buy", "sell"]).describe("'buy' to buy XFI with tUSDC, 'sell' to sell XFI for tUSDC"),
    amount: z.string().describe("Amount to swap (e.g., '10' for 10 tokens)"),
    triggerPrice: z.number().describe("Price trigger in USD (e.g., 0.05 for $0.05)"),
    triggerCondition: z.enum(["above", "below"]).describe("Execute when price goes 'above' or 'below' trigger"),
    slippage: z.number().optional().describe("Maximum slippage percentage (default: 5%)"),
    expirationDays: z.number().optional().describe("Order expiration in days (default: 30)")
  }) as any;

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      const userId = currentUserId;
      if (!userId) {
        return JSON.stringify({ 
          success: false, 
          error: 'User not authenticated. Please try again.' 
        }) as any;
      }

      const result = await createDCAOrder({
        userId,
        ...input
      });

      return JSON.stringify(result) as any;
    } catch (error: any) {
      console.error('Error in create_dca_order:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message 
      }) as any;
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
  }) as any;

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      const userId = currentUserId;
      if (!userId) {
        return JSON.stringify({ 
          success: false, 
          error: 'User not authenticated. Please try again.' 
        }) as any;
      }

      const result = await getUserDCAOrders({
        userId,
        ...input
      });

      return JSON.stringify(result) as any;
    } catch (error: any) {
      console.error('Error in get_user_dca_orders:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message 
      }) as any;
    }
  }
}

// Cancel DCA Order Tool
class CancelDCAOrderTool extends StructuredTool {
  name = "cancel_dca_order";
  description = "Cancels an active DCA order by order ID";
  schema = z.object({
    orderId: z.string().describe("The ID of the DCA order to cancel")
  }) as any;

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      const userId = currentUserId;
      if (!userId) {
        return JSON.stringify({ 
          success: false, 
          error: 'User not authenticated. Please try again.' 
        }) as any;
      }

      const result = await cancelDCAOrder({
        userId,
        ...input
      });

      return JSON.stringify(result) as any;
    } catch (error: any) {
      console.error('Error in cancel_dca_order:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message 
      }) as any;
    }
  }
}

// Get DCA Order Status Tool
class GetDCAOrderStatusTool extends StructuredTool {
  name = "get_dca_order_status";
  description = "Gets detailed status information for a specific DCA order";
  schema = z.object({
    orderId: z.string().describe("The ID of the DCA order to check")
  }) as any;

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      const userId = currentUserId;
      if (!userId) {
        return JSON.stringify({ 
          success: false, 
          error: 'User not authenticated. Please try again.' 
        }) as any;
      }

      const result = await getDCAOrderStatus({
        userId,
        ...input
      });

      return JSON.stringify(result) as any;
    } catch (error: any) {
      console.error('Error in get_dca_order_status:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message 
      }) as any;
    }
  }
}

// Get Swap Quote Tool
class GetSwapQuoteTool extends StructuredTool {
  name = "get_swap_quote";
  description = "Gets a quote for an immediate token swap between XFI and tUSDC";
  schema = z.object({
    fromToken: z.enum(["XFI", "tUSDC"]).describe("Token to swap from"),
    toToken: z.enum(["XFI", "tUSDC"]).describe("Token to swap to"),
    amount: z.string().describe("Amount to swap"),
    slippage: z.number().optional().describe("Maximum slippage percentage (default: 5%)")
  }) as any;

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      const result = await getSwapQuote(input);
      return JSON.stringify(result) as any;
    } catch (error: any) {
      console.error('Error in get_swap_quote:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message 
      }) as any;
    }
  }
}

// Get DCA System Status Tool
class GetDCASystemStatusTool extends StructuredTool {
  name = "get_dca_system_status";
  description = "Gets the current status of the DCA monitoring and execution system";
  schema = z.object({}) as any;

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      const result = await getDCASystemStatus();
      return JSON.stringify(result) as any;
    } catch (error: any) {
      console.error('Error in get_dca_system_status:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message 
      }) as any;
    }
  }
}

// Get User Token Balances Tool
class GetUserTokenBalancesTool extends StructuredTool {
  name = "get_user_token_balances";
  description = "Gets the user's current balances for DCA-supported tokens (XFI and tUSDC)";
  schema = z.object({}) as any;

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      const userId = currentUserId;
      if (!userId) {
        return JSON.stringify({ 
          success: false, 
          error: 'User not authenticated. Please try again.' 
        }) as any;
      }

      const result = await getUserTokenBalances({ userId });
      return JSON.stringify(result) as any;
    } catch (error: any) {
      console.error('Error in get_user_token_balances:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message 
      }) as any;
    }
  }
}

// Add Liquidity Tool
class AddLiquidityTool extends StructuredTool {
  name = "add_liquidity";
  description = "Adds liquidity to the XFI/tUSDC swap pool. Both XFI and tUSDC amounts are required to maintain the pool balance.";
  schema = z.object({
    xfiAmount: z.string().describe("Amount of XFI to add to the pool"),
    tUSDCAmount: z.string().describe("Amount of tUSDC to add to the pool"),
    slippage: z.number().optional().describe("Maximum slippage percentage (default: 5%)")
  }) as any;

  protected async _call(input: z.infer<typeof this.schema>, runManager?: any): Promise<string> {
    try {
      const userId = currentUserId;
      if (!userId) {
        return JSON.stringify({ 
          success: false, 
          error: 'User not authenticated. Please try again.' 
        }) as any;
      }

      // Get user from database
      const user = await WalletService.getWalletByAddress(userId);
      if (!user) {
        return JSON.stringify({ 
          success: false, 
          error: 'User wallet not found in database' 
        }) as any;
      }

      const { xfiAmount, tUSDCAmount, slippage = 5 } = input;
      
      // Add liquidity using SwapService
      const result = await SwapService.addLiquidity(
        user,
        xfiAmount,
        tUSDCAmount,
        slippage
      );

      if (result.success) {
        return JSON.stringify({
          success: true,
          message: `✅ Successfully added ${xfiAmount} XFI + ${tUSDCAmount} tUSDC to the liquidity pool!`,
          transactionHash: result.transactionHash,
          xfiAmount,
          tUSDCAmount,
          slippage
        }) as any;
      } else {
        return JSON.stringify({
          success: false,
          error: result.error || 'Failed to add liquidity'
        }) as any;
      }
    } catch (error: any) {
      console.error('Error in add_liquidity:', error);
      return JSON.stringify({ 
        success: false, 
        error: error.message 
      }) as any;
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
  
  // Liquidity Tools
  new AddLiquidityTool(),
]; 