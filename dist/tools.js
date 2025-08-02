import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { MongoDBService } from "./services/mongodb.js";
import { BlockchainService } from "./services/blockchain.js";
import { GamificationService } from "./services/gamification.js";
import { User } from "./models/User.js";
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
import { AnalyticsService } from "./services/analytics.js";
dotenv.config();
import { XFIPriceChartTool, XFIMarketDataTool, XFITradingSignalsTool, XFIPricePredictionTool, XFIMarketComparisonTool } from './tools/price-analysis.js';
import { createDCAOrder, getUserDCAOrders, cancelDCAOrder, getDCAOrderStatus, getSwapQuote, getDCASystemStatus, getUserTokenBalances } from './tools/dca.js';
let currentUserFrontendWalletAddress = null;
export const setCurrentUserFrontendWalletAddress = (frontendWalletAddress) => {
    currentUserFrontendWalletAddress = frontendWalletAddress;
};
export const getCurrentUserFrontendWalletAddress = () => {
    return currentUserFrontendWalletAddress;
};
class GetWalletInfoTool extends StructuredTool {
    name = "get_wallet_info";
    description = "Gets information about the user's wallet";
    schema = z.object({});
    async _call(input, runManager) {
        try {
            const frontendWalletAddress = currentUserFrontendWalletAddress;
            if (!frontendWalletAddress) {
                return JSON.stringify({
                    success: false,
                    error: 'User wallet address not found. Please try again.'
                });
            }
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
        }
        catch (error) {
            console.error('Error in get_wallet_info:', error);
            return JSON.stringify({
                success: false,
                error: error.message
            });
        }
    }
}
class GetWalletForOperationsTool extends StructuredTool {
    name = "get_wallet_for_operations";
    description = "Gets the user's wallet information for blockchain operations (includes private key)";
    schema = z.object({});
    async _call(input, runManager) {
        try {
            const frontendWalletAddress = currentUserFrontendWalletAddress;
            if (!frontendWalletAddress) {
                return JSON.stringify({
                    success: false,
                    error: 'User wallet address not found. Please try again.'
                });
            }
            const user = await MongoDBService.getWalletByFrontendAddress(frontendWalletAddress);
            if (!user) {
                return JSON.stringify({
                    success: false,
                    error: 'User wallet not found in database'
                });
            }
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
            });
        }
        catch (error) {
            console.error('Error in get_wallet_for_operations:', error);
            return JSON.stringify({
                success: false,
                error: error.message
            });
        }
    }
}
class GetBalanceTool extends StructuredTool {
    name = "get_balance";
    description = "Gets the balance of the user's wallet including XFI and USDC tokens";
    schema = z.object({});
    async _call(input, runManager) {
        try {
            const frontendWalletAddress = currentUserFrontendWalletAddress;
            if (!frontendWalletAddress) {
                return JSON.stringify({
                    success: false,
                    error: 'User wallet address not found. Please try again.'
                });
            }
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
            console.log(`🔍 GetBalanceTool Debug:`);
            console.log(`  - Environment: ${process.env.ENVIRONMENT}`);
            console.log(`  - RPC URL: ${process.env.RPC_URL}`);
            console.log(`  - Chain ID: ${process.env.CHAIN_ID}`);
            console.log(`  - User Address: ${user.walletAddress}`);
            const xfiBalance = await BlockchainService.getBalance(user.walletAddress);
            let usdcBalance = null;
            try {
                const tokenBalances = await TokenService.getDCATokenBalances(user.walletAddress);
                const usdcToken = tokenBalances.find(token => token.symbol === 'USDC');
                if (usdcToken) {
                    usdcBalance = {
                        balance: usdcToken.balance,
                        formatted: usdcToken.formatted,
                        symbol: 'USDC',
                        decimals: usdcToken.decimals
                    };
                }
            }
            catch (error) {
                console.log(`  - USDC balance fetch failed: ${error}`);
            }
            console.log(`  - XFI Balance Result:`, xfiBalance);
            console.log(`  - USDC Balance Result:`, usdcBalance);
            return JSON.stringify({
                success: true,
                address: xfiBalance.address,
                xfi: {
                    balance: xfiBalance.balance,
                    formatted: xfiBalance.formatted,
                    symbol: 'XFI'
                },
                usdc: usdcBalance,
                debug: {
                    environment: process.env.ENVIRONMENT,
                    rpcUrl: process.env.RPC_URL,
                    chainId: process.env.CHAIN_ID
                }
            });
        }
        catch (error) {
            console.error('Error in get_balance:', error);
            return JSON.stringify({
                success: false,
                error: error.message
            });
        }
    }
}
class SendTransactionTool extends StructuredTool {
    name = "send_transaction";
    description = "Sends a transaction from the user's wallet to another address";
    schema = z.object({
        to: z.string().describe("The recipient wallet address"),
        amount: z.string().describe("The amount to send in XFI (e.g., '0.1')"),
        data: z.string().optional().describe("Optional transaction data (hex string)")
    });
    async _call(input, runManager) {
        try {
            const { to, amount, data } = input;
            const frontendWalletAddress = currentUserFrontendWalletAddress;
            if (!frontendWalletAddress) {
                return JSON.stringify({
                    success: false,
                    error: 'User wallet address not found. Please try again.'
                });
            }
            if (!BlockchainService.isValidAddress(to)) {
                return JSON.stringify({
                    success: false,
                    error: 'Invalid recipient address format'
                });
            }
            const user = await MongoDBService.getWalletByFrontendAddress(frontendWalletAddress);
            if (!user) {
                return JSON.stringify({
                    success: false,
                    error: 'User wallet not found in database'
                });
            }
            const userModel = await User.findOne({ frontendWalletAddress });
            if (!userModel) {
                return JSON.stringify({
                    success: false,
                    error: 'User not found in database'
                });
            }
            const transaction = await BlockchainService.sendTransaction(userModel, to, amount, data);
            const response = {
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
                response.points = transaction.points;
            }
            try {
                const io = getIO();
                emitTransactionSuccess(io, user.walletAddress, {
                    transactionHash: transaction.hash,
                    from: transaction.from,
                    to: transaction.to,
                    value: transaction.value,
                    status: transaction.status,
                    explorerUrl: transaction.transactionUrl || null
                });
                emitNewTransaction(io, user.walletAddress, {
                    hash: transaction.hash,
                    from: transaction.from,
                    to: transaction.to,
                    value: transaction.value,
                    status: transaction.status,
                    timestamp: new Date().toISOString()
                });
                if (transaction.reward) {
                    emitPointsEarned(io, user.walletAddress, {
                        points: transaction.reward.totalPoints,
                        reason: transaction.reward.reason,
                        transactionHash: transaction.hash
                    });
                }
                try {
                    await AnalyticsService.recordTransaction(frontendWalletAddress, user.walletAddress, amount, 'XFI', 'send', transaction.hash, 'completed');
                }
                catch (analyticsError) {
                    console.warn('⚠️ Failed to record transaction analytics:', analyticsError);
                }
                setTimeout(async () => {
                    try {
                        const balance = await BlockchainService.getBalance(user.walletAddress);
                        emitBalanceUpdate(io, user.walletAddress, {
                            address: balance.address,
                            balance: balance.balance,
                            formatted: balance.formatted,
                            symbol: 'XFI'
                        });
                    }
                    catch (balanceError) {
                        console.error('Error fetching updated balance:', balanceError);
                    }
                }, 1000);
            }
            catch (socketError) {
                console.error('Error emitting real-time events:', socketError);
            }
            return JSON.stringify(response);
        }
        catch (error) {
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
    description = "Sends USDC tokens from the user's wallet to another address. Use this when user says 'send USDC', 'transfer USDC', 'send 10 USDC to address', etc. Note: USDT is temporarily disabled due to incorrect pricing.";
    schema = z.object({
        token: z.enum(["USDC"]).describe("The token to send (USDT temporarily disabled)"),
        to: z.string().describe("The recipient wallet address"),
        amount: z.string().describe("The amount to send (e.g., '10.5')")
    });
    async _call(input, runManager) {
        try {
            const { token, to, amount } = input;
            const frontendWalletAddress = currentUserFrontendWalletAddress;
            if (!frontendWalletAddress) {
                return JSON.stringify({
                    success: false,
                    error: 'User wallet address not found. Please try again.'
                });
            }
            if (!BlockchainService.isValidAddress(to)) {
                return JSON.stringify({
                    success: false,
                    error: 'Invalid recipient address format'
                });
            }
            const user = await MongoDBService.getWalletByFrontendAddress(frontendWalletAddress);
            if (!user) {
                return JSON.stringify({
                    success: false,
                    error: 'User wallet not found in database'
                });
            }
            const userModel = await User.findOne({ frontendWalletAddress });
            if (!userModel) {
                return JSON.stringify({
                    success: false,
                    error: 'User not found in database'
                });
            }
            const tokenAddress = TOKEN_ADDRESSES[token];
            if (!tokenAddress) {
                return JSON.stringify({
                    success: false,
                    error: `Token ${token} not supported`
                });
            }
            const validation = await TokenService.validateSufficientBalance(tokenAddress, user.walletAddress, amount);
            if (!validation.sufficient) {
                return JSON.stringify({
                    success: false,
                    error: `Insufficient ${token} balance. Required: ${amount}, Available: ${validation.balance}`,
                    balance: validation.balance,
                    required: validation.required
                });
            }
            const result = await TokenService.transferToken(userModel, tokenAddress, to, amount);
            if (!result.success) {
                return JSON.stringify({
                    success: false,
                    error: result.error || 'Token transfer failed'
                });
            }
            const response = {
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
            try {
                const io = getIO();
                emitTransactionSuccess(io, user.walletAddress, {
                    transactionHash: result.transactionHash,
                    from: user.walletAddress,
                    to: to,
                    value: `${amount} ${token}`,
                    status: 'success',
                    explorerUrl: response.explorerUrl
                });
                emitNewTransaction(io, user.walletAddress, {
                    hash: result.transactionHash,
                    from: user.walletAddress,
                    to: to,
                    value: `${amount} ${token}`,
                    status: 'success',
                    timestamp: new Date().toISOString()
                });
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
                    }
                    catch (balanceError) {
                        console.error('Error fetching updated balance:', balanceError);
                    }
                }, 1000);
            }
            catch (socketError) {
                console.error('Error emitting real-time events:', socketError);
            }
            return JSON.stringify(response);
        }
        catch (error) {
            console.error('Error in send_token:', error);
            return JSON.stringify({
                success: false,
                error: error.message
            });
        }
    }
}
class GetTransactionHistoryTool extends StructuredTool {
    name = "get_transaction_history";
    description = "Gets transaction history for the user's wallet";
    schema = z.object({
        limit: z.number().optional().describe("Number of transactions to return (default: 10)")
    });
    async _call(input, runManager) {
        try {
            const { limit = 10 } = input;
            const frontendWalletAddress = currentUserFrontendWalletAddress;
            if (!frontendWalletAddress) {
                return JSON.stringify({
                    success: false,
                    error: 'User ID not found. Please try again.'
                });
            }
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
        }
        catch (error) {
            console.error('Error in get_transaction_history:', error);
            return JSON.stringify({
                success: false,
                error: error.message
            });
        }
    }
}
class GetUserStatsTool extends StructuredTool {
    name = "get_user_stats";
    description = "Gets the current user's gamification stats (points, rank, achievements)";
    schema = z.object({});
    async _call(input, runManager) {
        try {
            const frontendWalletAddress = currentUserFrontendWalletAddress;
            if (!frontendWalletAddress) {
                return JSON.stringify({
                    success: false,
                    error: 'User ID not found. Please try again.'
                });
            }
            const user = await MongoDBService.getWalletByFrontendAddress(frontendWalletAddress);
            if (!user) {
                return JSON.stringify({
                    success: false,
                    error: 'User wallet not found in database'
                });
            }
            const stats = await GamificationService.getUserStats(frontendWalletAddress);
            if (!stats) {
                return JSON.stringify({
                    success: false,
                    error: 'Failed to get user stats'
                });
            }
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
        }
        catch (error) {
            console.error('Error in get_user_stats:', error);
            return JSON.stringify({
                success: false,
                error: error.message
            });
        }
    }
}
class GetLeaderboardTool extends StructuredTool {
    name = "get_leaderboard";
    description = "Gets the global leaderboard showing top users by points";
    schema = z.object({
        limit: z.number().optional().describe("Number of top users to return (default: 10)")
    });
    async _call(input, runManager) {
        try {
            const { limit = 10 } = input;
            const leaderboard = await GamificationService.getLeaderboard(limit);
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
        }
        catch (error) {
            console.error('Error in get_leaderboard:', error);
            return JSON.stringify({
                success: false,
                error: error.message
            });
        }
    }
}
class SetUsernameTool extends StructuredTool {
    name = "set_username";
    description = "Set or update the user's public username (3-20 chars, alphanumeric or underscores, must be unique)";
    schema = z.object({
        username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/).describe("The new username to set")
    });
    async _call(input, runManager) {
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
            if (!username || typeof username !== 'string' || username.length < 3 || username.length > 20 || !/^[a-zA-Z0-9_]+$/.test(username)) {
                return JSON.stringify({ success: false, error: 'Invalid username. Must be 3-20 characters, alphanumeric or underscores.' });
            }
            const existing = await User.findOne({ username: username });
            if (existing && existing.frontendWalletAddress !== frontendWalletAddress) {
                return JSON.stringify({ success: false, error: 'Username already taken' });
            }
            const userModel = await User.findOne({ frontendWalletAddress });
            if (userModel) {
                userModel.username = username;
                await userModel.save();
            }
            return JSON.stringify({ success: true, username });
        }
        catch (error) {
            console.error('Error in set_username:', error);
            return JSON.stringify({ success: false, error: error.message });
        }
    }
}
class CreateGlobalPaymentLinkTool extends StructuredTool {
    name = "create_global_payment_link";
    description = "Explicitly creates a global payment link that can accept any amount of contributions from multiple users. Note: The general create_payment_links tool automatically creates global links when no amount is specified.";
    schema = z.object({});
    async _call(input, runManager) {
        try {
            const frontendWalletAddress = currentUserFrontendWalletAddress;
            if (!frontendWalletAddress) {
                return JSON.stringify({
                    success: false,
                    error: 'User ID not found. Please try again.'
                });
            }
            const user = await MongoDBService.getWalletByFrontendAddress(frontendWalletAddress);
            if (!user) {
                return JSON.stringify({
                    success: false,
                    error: 'User wallet not found in database'
                });
            }
            const globalLinkID = nanoid(10);
            const walletForOps = await MongoDBService.getWalletForOperations(frontendWalletAddress);
            if (!walletForOps) {
                return JSON.stringify({
                    success: false,
                    error: 'Failed to get wallet for operations'
                });
            }
            const transactionHash = await PaymentLinkService.createGlobalPaymentLinkOnChain(walletForOps.privateKey, globalLinkID);
            const paymentLink = await PaymentLinkService.createGlobalPaymentLink(frontendWalletAddress, globalLinkID);
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
        }
        catch (error) {
            console.error('Error in create_global_payment_link:', error);
            return JSON.stringify({
                success: false,
                error: error.message
            });
        }
    }
}
class CreatePaymentLinksTool extends StructuredTool {
    name = "create_payment_links";
    description = "Creates a payment link. If amount is specified, creates a fixed payment link. If no amount is specified, creates a global payment link that accepts any contributions.";
    schema = z.object({
        amount: z.string().optional().describe("Optional: The amount for a fixed payment link in XFI (e.g., '0.1'). If not provided, creates a global payment link.")
    });
    async _call(input, runManager) {
        try {
            const { amount } = input;
            const frontendWalletAddress = currentUserFrontendWalletAddress;
            if (!frontendWalletAddress) {
                return JSON.stringify({
                    success: false,
                    error: 'User ID not found. Please try again.'
                });
            }
            const user = await MongoDBService.getWalletByFrontendAddress(frontendWalletAddress);
            if (!user) {
                return JSON.stringify({
                    success: false,
                    error: 'User wallet not found in database'
                });
            }
            const paymentLinkID = nanoid(10);
            const walletForOps = await MongoDBService.getWalletForOperations(frontendWalletAddress);
            if (!walletForOps) {
                return JSON.stringify({
                    success: false,
                    error: 'Failed to get wallet for operations'
                });
            }
            const isGlobal = !amount || amount.trim() === '';
            if (isGlobal) {
                const transactionHash = await PaymentLinkService.createGlobalPaymentLinkOnChain(walletForOps.privateKey, paymentLinkID);
                const paymentLink = await PaymentLinkService.createGlobalPaymentLink(user.walletAddress, paymentLinkID);
                try {
                    await AnalyticsService.recordPaymentLink(frontendWalletAddress, user.walletAddress, '0', 'XFI');
                }
                catch (analyticsError) {
                    console.warn('⚠️ Failed to record payment link analytics:', analyticsError);
                }
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
            }
            else {
                const transactionHash = await PaymentLinkService.createPaymentLinkOnChain(walletForOps.privateKey, paymentLinkID, amount);
                const paymentLink = await PaymentLinkService.createPaymentLink(user.walletAddress, Number(amount), paymentLinkID);
                try {
                    await AnalyticsService.recordPaymentLink(frontendWalletAddress, user.walletAddress, amount, 'XFI');
                }
                catch (analyticsError) {
                    console.warn('⚠️ Failed to record payment link analytics:', analyticsError);
                }
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
        }
        catch (error) {
            console.error('Error in create_payment_links:', error);
            return JSON.stringify({
                success: false,
                error: error.message
            });
        }
    }
}
class PayFixedPaymentLinkTool extends StructuredTool {
    name = "pay_fixed_payment_link";
    description = "Pays a fixed payment link using the link ID";
    schema = z.object({
        linkId: z.string().describe("The ID of the payment link to pay")
    });
    async _call(input, runManager) {
        try {
            const { linkId } = input;
            const frontendWalletAddress = currentUserFrontendWalletAddress;
            if (!frontendWalletAddress) {
                return JSON.stringify({
                    success: false,
                    error: 'User ID not found. Please try again.'
                });
            }
            const user = await MongoDBService.getWalletByFrontendAddress(frontendWalletAddress);
            if (!user) {
                return JSON.stringify({
                    success: false,
                    error: 'User wallet not found in database'
                });
            }
            const paymentLink = await PaymentLink.findOne({ linkId });
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
            const walletForOps = await MongoDBService.getWalletForOperations(frontendWalletAddress);
            if (!walletForOps) {
                return JSON.stringify({
                    success: false,
                    error: 'Failed to get wallet for operations'
                });
            }
            const { ContractService } = await import('./services/contract.js');
            const contractService = new ContractService(walletForOps.privateKey);
            const result = await contractService.payFixedPaymentLink(linkId, paymentLink.amount.toString());
            if (result.success) {
                paymentLink.status = 'paid';
                await paymentLink.save();
                try {
                    const io = getIO();
                    emitTransactionSuccess(io, user.walletAddress, {
                        transactionHash: result.data.transactionHash,
                        from: user.walletAddress,
                        to: linkId,
                        value: paymentLink.amount.toString(),
                        status: 'success',
                        explorerUrl: `${process.env.ENVIRONMENT === 'production' ? 'https://xfiscan.com' : 'https://test.xfiscan.com'}/tx/${result.data.transactionHash}`
                    });
                    emitNewTransaction(io, user.walletAddress, {
                        hash: result.data.transactionHash,
                        from: user.walletAddress,
                        to: linkId,
                        value: paymentLink.amount.toString(),
                        status: 'success',
                        timestamp: new Date().toISOString()
                    });
                    setTimeout(async () => {
                        try {
                            const balance = await BlockchainService.getBalance(user.walletAddress);
                            emitBalanceUpdate(io, user.walletAddress, {
                                address: balance.address,
                                balance: balance.balance,
                                formatted: balance.formatted,
                                symbol: 'XFI'
                            });
                        }
                        catch (balanceError) {
                            console.error('Error fetching updated balance:', balanceError);
                        }
                    }, 1000);
                }
                catch (socketError) {
                    console.error('Error emitting real-time events:', socketError);
                }
                return JSON.stringify({
                    success: true,
                    linkId: linkId,
                    amount: paymentLink.amount,
                    transactionHash: result.data.transactionHash,
                    message: `Successfully paid ${paymentLink.amount} XFI for payment link ${linkId}`
                });
            }
            else {
                return JSON.stringify({
                    success: false,
                    error: result.error || 'Failed to process payment'
                });
            }
        }
        catch (error) {
            console.error('Error in pay_fixed_payment_link:', error);
            return JSON.stringify({
                success: false,
                error: error.message
            });
        }
    }
}
class ContributeToGlobalPaymentLinkTool extends StructuredTool {
    name = "contribute_to_global_payment_link";
    description = "Allows users to contribute any amount to an existing global payment link";
    schema = z.object({
        linkId: z.string().describe("The ID of the global payment link to contribute to"),
        amount: z.string().describe("The amount to contribute in XFI (e.g., '0.1')")
    });
    async _call(input, runManager) {
        try {
            const { linkId, amount } = input;
            const frontendWalletAddress = currentUserFrontendWalletAddress;
            if (!frontendWalletAddress) {
                return JSON.stringify({
                    success: false,
                    error: 'User ID not found. Please try again.'
                });
            }
            const user = await MongoDBService.getWalletByFrontendAddress(frontendWalletAddress);
            if (!user) {
                return JSON.stringify({
                    success: false,
                    error: 'User wallet not found in database'
                });
            }
            const contractReadService = new ContractReadService();
            const linkStatus = await contractReadService.checkGlobalPaymentLinkStatus(linkId);
            if (!linkStatus.success) {
                return JSON.stringify({
                    success: false,
                    error: `Global payment link '${linkId}' does not exist. Please verify the link ID.`
                });
            }
            const walletForOps = await MongoDBService.getWalletForOperations(frontendWalletAddress);
            if (!walletForOps) {
                return JSON.stringify({
                    success: false,
                    error: 'Failed to get wallet for operations'
                });
            }
            const { ContractService } = await import('./services/contract.js');
            const contractService = new ContractService(walletForOps.privateKey);
            const result = await contractService.contributeToGlobalPaymentLink(linkId, amount);
            if (result.success) {
                try {
                    const io = getIO();
                    emitTransactionSuccess(io, user.walletAddress, {
                        transactionHash: result.data.transactionHash,
                        from: user.walletAddress,
                        to: linkId,
                        value: amount,
                        status: 'success',
                        explorerUrl: `${process.env.ENVIRONMENT === 'production' ? 'https://xfiscan.com' : 'https://test.xfiscan.com'}/tx/${result.data.transactionHash}`
                    });
                    emitNewTransaction(io, user.walletAddress, {
                        hash: result.data.transactionHash,
                        from: user.walletAddress,
                        to: linkId,
                        value: amount,
                        status: 'success',
                        timestamp: new Date().toISOString()
                    });
                    setTimeout(async () => {
                        try {
                            const balance = await BlockchainService.getBalance(user.walletAddress);
                            emitBalanceUpdate(io, user.walletAddress, {
                                address: balance.address,
                                balance: balance.balance,
                                formatted: balance.formatted,
                                symbol: 'XFI'
                            });
                        }
                        catch (balanceError) {
                            console.error('Error fetching updated balance:', balanceError);
                        }
                    }, 1000);
                }
                catch (socketError) {
                    console.error('Error emitting real-time events:', socketError);
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
            }
            else {
                return JSON.stringify({
                    success: false,
                    error: result.error || 'Failed to contribute to global payment link'
                });
            }
        }
        catch (error) {
            console.error('Error in contribute_to_global_payment_link:', error);
            return JSON.stringify({
                success: false,
                error: error.message || 'An error occurred while contributing to the global payment link'
            });
        }
    }
}
class CheckPaymentLinkStatusTool extends StructuredTool {
    name = "check_payment_link_status";
    description = "Checks the status of a payment link directly from the smart contract. Defaults to checking fixed payment links first, then tries global if not found.";
    schema = z.object({
        linkId: z.string().describe("The ID of the payment link to check"),
        type: z.enum(["fixed", "global"]).optional().describe("Type of payment link (default: fixed - will try global as fallback)")
    });
    async _call(input, runManager) {
        try {
            const { linkId, type } = input;
            const contractReadService = new ContractReadService();
            let result;
            let detectedType = type;
            const firstType = type || "fixed";
            const secondType = firstType === "fixed" ? "global" : "fixed";
            if (firstType === "global") {
                result = await contractReadService.checkGlobalPaymentLinkStatus(linkId);
            }
            else {
                result = await contractReadService.checkPaymentLinkStatus(linkId);
            }
            if (!result.success) {
                if (secondType === "global") {
                    result = await contractReadService.checkGlobalPaymentLinkStatus(linkId);
                }
                else {
                    result = await contractReadService.checkPaymentLinkStatus(linkId);
                }
                if (result.success) {
                    detectedType = secondType;
                    if (result.data) {
                        result.data.type = secondType;
                    }
                }
            }
            else {
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
            }
            else {
                return JSON.stringify({
                    success: false,
                    error: `Payment link '${linkId}' not found as either fixed or global payment link`,
                    linkId: linkId
                });
            }
        }
        catch (error) {
            console.error('Error in check_payment_link_status:', error);
            return JSON.stringify({
                success: false,
                error: error.message || 'An error occurred while checking payment link status'
            });
        }
    }
}
class CreateDCAOrderTool extends StructuredTool {
    name = "create_dca_order";
    description = "Creates an automated DCA (Dollar Cost Averaging) order to swap tokens when the price reaches a trigger condition. IMPORTANT: orderType must be 'swap' (not 'buy' or 'sell'). Examples: 'swap 10 USDC to XFI when XFI reaches $0.05' = orderType: 'swap', fromToken: 'USDC', toToken: 'XFI', amount: '10', triggerPrice: 0.05, triggerCondition: 'below'. 'swap 5 XFI to USDC when XFI reaches $0.04' = orderType: 'swap', fromToken: 'XFI', toToken: 'USDC', amount: '5', triggerPrice: 0.04, triggerCondition: 'above'. All numeric values (triggerPrice, slippage, expirationDays) must be numbers, not strings.";
    schema = z.object({
        orderType: z.enum(["swap"]).describe("Order type: 'swap' (swap between USDC and XFI)"),
        fromToken: z.enum(["USDC", "XFI"]).describe("Token to swap from: 'USDC' or 'XFI'"),
        toToken: z.enum(["USDC", "XFI"]).describe("Token to swap to: 'USDC' or 'XFI'"),
        amount: z.string().describe("Amount to swap (e.g., '10' for 10 USDC or '5' for 5 XFI)"),
        triggerPrice: z.number().describe("Trigger price in USD (e.g., 0.05 for $0.05)"),
        triggerCondition: z.enum(["above", "below"]).describe("Trigger condition: 'above' (execute when price goes above trigger) or 'below' (execute when price goes below trigger)"),
        slippage: z.number().optional().describe("Maximum slippage percentage as number (e.g., 5 for 5%, default: 5)"),
        expirationDays: z.number().optional().describe("Order expiration in days as number (e.g., 30 for 30 days, default: 30)")
    });
    async _call(input, runManager) {
        try {
            const frontendWalletAddress = currentUserFrontendWalletAddress;
            if (!frontendWalletAddress) {
                return JSON.stringify({ success: false, error: 'User not authenticated. Please try again.' });
            }
            const { orderType, amount, triggerPrice, triggerCondition, slippage, expirationDays } = input;
            if (!orderType) {
                return JSON.stringify({ success: false, error: 'Missing orderType. Must be "swap".' });
            }
            if (orderType !== 'swap') {
                return JSON.stringify({ success: false, error: `Invalid orderType: "${orderType}". Must be "swap".` });
            }
            if (!amount) {
                return JSON.stringify({ success: false, error: 'Missing amount to swap.' });
            }
            if (triggerPrice === undefined || triggerPrice === null) {
                return JSON.stringify({ success: false, error: 'Missing triggerPrice. Must be a number (e.g., 0.05 for $0.05).' });
            }
            if (typeof triggerPrice !== 'number') {
                return JSON.stringify({ success: false, error: `Invalid triggerPrice: "${triggerPrice}". Must be a number, not a string.` });
            }
            if (!triggerCondition) {
                return JSON.stringify({ success: false, error: 'Missing triggerCondition. Must be "above" or "below".' });
            }
            if (triggerCondition !== 'above' && triggerCondition !== 'below') {
                return JSON.stringify({ success: false, error: `Invalid triggerCondition: "${triggerCondition}". Must be "above" or "below".` });
            }
            const params = {
                userId: frontendWalletAddress,
                orderType,
                fromToken: input.fromToken,
                toToken: input.toToken,
                amount,
                triggerPrice,
                triggerCondition,
                slippage,
                expirationDays
            };
            console.log(`🔍 CreateDCAOrderTool: Creating DCA order with params:`, params);
            const result = await createDCAOrder(params);
            if (result.success) {
                try {
                    const user = await MongoDBService.getWalletByFrontendAddress(frontendWalletAddress);
                    if (user) {
                        await AnalyticsService.recordDCAOrder(frontendWalletAddress, user.walletAddress, amount, input.fromToken);
                    }
                }
                catch (analyticsError) {
                    console.warn('⚠️ Failed to record DCA order analytics:', analyticsError);
                }
            }
            return JSON.stringify(result);
        }
        catch (error) {
            console.error('Error in create_dca_order:', error);
            return JSON.stringify({ success: false, error: error.message });
        }
    }
}
class GetUserDCAOrdersTool extends StructuredTool {
    name = "get_user_dca_orders";
    description = "Lists the user's DCA orders with their current status. Can filter by status (active, executed, cancelled, failed, expired)";
    schema = z.object({
        status: z.enum(["active", "executed", "cancelled", "failed", "expired"]).optional().describe("Filter by order status"),
        limit: z.number().optional().describe("Maximum number of orders to return (default: 10)")
    });
    async _call(input, runManager) {
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
        }
        catch (error) {
            console.error('Error in get_user_dca_orders:', error);
            return JSON.stringify({
                success: false,
                error: error.message
            });
        }
    }
}
class CancelDCAOrderTool extends StructuredTool {
    name = "cancel_dca_order";
    description = "Cancels an active DCA order by order ID";
    schema = z.object({
        orderId: z.string().describe("The ID of the DCA order to cancel")
    });
    async _call(input, runManager) {
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
        }
        catch (error) {
            console.error('Error in cancel_dca_order:', error);
            return JSON.stringify({ success: false, error: error.message });
        }
    }
}
class GetDCAOrderStatusTool extends StructuredTool {
    name = "get_dca_order_status";
    description = "Gets detailed status information for a specific DCA order";
    schema = z.object({
        orderId: z.string().describe("The ID of the DCA order to check")
    });
    async _call(input, runManager) {
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
        }
        catch (error) {
            console.error('Error in get_dca_order_status:', error);
            return JSON.stringify({ success: false, error: error.message });
        }
    }
}
class GetSwapQuoteTool extends StructuredTool {
    name = "get_swap_quote";
    description = "Gets a quote/estimate for a token swap WITHOUT executing it. Use this when user asks for 'quote', 'estimate', 'how much will I get', or 'check price'. DO NOT use this when user says 'swap', 'execute', 'trade', or 'now swap'. PRIMARY PAIRS: USDC↔XFI (recommended), XFI↔USDC. When swapping USDC to XFI, users get NATIVE XFI tokens (not WXFI). Other pairs: WXFI↔FOMO, WXFI↔WETH, WXFI↔WBTC, WXFI↔BNB, WXFI↔SOL, WXFI↔XUSD, USDC↔XUSD. NOTE: USDT swaps are temporarily disabled due to incorrect pricing.";
    schema = z.object({
        fromToken: z.enum(["XFI", "CFI", "WXFI", "FOMO", "WETH", "USDC", "WBTC", "BNB", "SOL", "XUSD"]).describe("Token to swap from (USDT temporarily disabled)"),
        toToken: z.enum(["XFI", "CFI", "WXFI", "FOMO", "WETH", "USDC", "WBTC", "BNB", "SOL", "XUSD"]).describe("Token to swap to (USDT temporarily disabled)"),
        amount: z.string().describe("Amount to swap"),
        slippage: z.union([z.number(), z.string()]).optional().describe("Maximum slippage percentage (default: 5%). Can be a number or string.")
    });
    async _call(input, runManager) {
        try {
            const { fromToken, toToken, amount, slippage } = input;
            if (!fromToken || !toToken || !amount) {
                return JSON.stringify({ success: false, error: 'Missing required swap quote fields.' });
            }
            let slippageNumber = undefined;
            if (slippage !== undefined) {
                slippageNumber = typeof slippage === 'string' ? parseFloat(slippage) : slippage;
                if (isNaN(slippageNumber)) {
                    return JSON.stringify({ success: false, error: 'Invalid slippage value. Must be a number.' });
                }
            }
            const mappedFromToken = fromToken === 'XFI' ? 'CFI' : fromToken;
            const mappedToToken = toToken === 'XFI' ? 'CFI' : toToken;
            const params = {
                fromToken: mappedFromToken,
                toToken: mappedToToken,
                amount
            };
            if (slippageNumber !== undefined) {
                params.slippage = slippageNumber;
            }
            const result = await getSwapQuote(params);
            if (!result.success && result.message.includes('getAmountsOut') && result.message.includes('reverted')) {
                const workingPairs = [
                    'WXFI ↔ FOMO', 'WXFI ↔ WETH', 'WXFI ↔ USDC', 'WXFI ↔ WBTC',
                    'WXFI ↔ BNB', 'WXFI ↔ SOL', 'WXFI ↔ XUSD',
                    'USDC ↔ XUSD'
                ];
                return JSON.stringify({
                    success: false,
                    message: `No liquidity pool found for ${params.fromToken} to ${params.toToken}. Most tokens need to be swapped through WXFI as an intermediary. Working pairs: ${workingPairs.join(', ')}. Try swapping ${params.fromToken} to WXFI first, then WXFI to ${params.toToken}.`
                });
            }
            return JSON.stringify(result);
        }
        catch (error) {
            console.error('Error in get_swap_quote:', error);
            return JSON.stringify({ success: false, error: error.message });
        }
    }
}
class GetDCASystemStatusTool extends StructuredTool {
    name = "get_dca_system_status";
    description = "Gets the current status of the DCA monitoring and execution system";
    schema = z.object({});
    async _call(input, runManager) {
        try {
            const result = await getDCASystemStatus();
            return JSON.stringify(result);
        }
        catch (error) {
            console.error('Error in get_dca_system_status:', error);
            return JSON.stringify({
                success: false,
                error: error.message
            });
        }
    }
}
class GetUserTokenBalancesTool extends StructuredTool {
    name = "get_user_token_balances";
    description = "Gets the user's current balances for DCA-supported tokens (XFI, USDC). Note: USDT is temporarily disabled due to incorrect pricing.";
    schema = z.object({});
    async _call(input, runManager) {
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
        }
        catch (error) {
            console.error('Error in get_user_token_balances:', error);
            return JSON.stringify({
                success: false,
                error: error.message
            });
        }
    }
}
class AddLiquidityTool extends StructuredTool {
    name = "add_liquidity";
    description = "Adds liquidity to the XFI/USDC swap pool. Both XFI and USDC amounts are required to maintain the pool balance.";
    schema = z.object({
        xfiAmount: z.string().describe("Amount of XFI to add to the pool"),
        usdcAmount: z.string().describe("Amount of USDC to add to the pool"),
        slippage: z.number().optional().describe("Maximum slippage percentage (default: 5%)")
    });
    async _call(input, runManager) {
        try {
            const frontendWalletAddress = currentUserFrontendWalletAddress;
            if (!frontendWalletAddress) {
                return JSON.stringify({
                    success: false,
                    error: 'User not authenticated. Please try again.'
                });
            }
            const user = await MongoDBService.getWalletByFrontendAddress(frontendWalletAddress);
            if (!user) {
                return JSON.stringify({
                    success: false,
                    error: 'User wallet not found in database'
                });
            }
            const { xfiAmount, usdcAmount, slippage = 5 } = input;
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
        }
        catch (error) {
            console.error('Error in add_liquidity:', error);
            return JSON.stringify({
                success: false,
                error: error.message
            });
        }
    }
}
class ExecuteSwapTool extends StructuredTool {
    name = "execute_swap";
    description = "ACTUALLY EXECUTES a token swap on the blockchain. Use this when user says 'swap', 'execute', 'trade', 'now swap', 'perform swap', or 'do the swap'. This will create a real transaction. PRIMARY PAIRS: USDC↔XFI (recommended), XFI↔USDC. When swapping USDC to XFI, users get NATIVE XFI tokens (not WXFI). Approvals are handled automatically - no need to approve tokens separately. IMPORTANT: User must have their wallet properly configured in the system for transactions to work. Other pairs: WXFI↔FOMO, WXFI↔WETH, WXFI↔WBTC, WXFI↔BNB, WXFI↔SOL, WXFI↔XUSD, USDC↔XUSD. NOTE: USDT swaps are temporarily disabled due to incorrect pricing.";
    schema = z.object({
        fromToken: z.enum(["XFI", "CFI", "WXFI", "FOMO", "WETH", "USDC", "WBTC", "BNB", "SOL", "XUSD"]).describe("Token to swap from (USDT temporarily disabled)"),
        toToken: z.enum(["XFI", "CFI", "WXFI", "FOMO", "WETH", "USDC", "WBTC", "BNB", "SOL", "XUSD"]).describe("Token to swap to (USDT temporarily disabled)"),
        fromAmount: z.string().describe("Amount of fromToken to swap"),
        slippage: z.union([z.number(), z.string()]).optional().describe("Maximum slippage percentage (default: 5%). Can be a number or string.")
    });
    async _call(input, runManager) {
        try {
            console.log('🔄 ExecuteSwapTool: Starting swap execution...');
            console.log('📝 Input parameters:', JSON.stringify(input, null, 2));
            const frontendWalletAddress = currentUserFrontendWalletAddress;
            console.log('👤 Frontend wallet address:', frontendWalletAddress);
            if (!frontendWalletAddress) {
                console.log('❌ ExecuteSwapTool: No frontend wallet address found');
                return JSON.stringify({
                    success: false,
                    error: 'User not authenticated. Please try again.'
                });
            }
            console.log('🔍 ExecuteSwapTool: Looking up user in database...');
            const user = await MongoDBService.getWalletByFrontendAddress(frontendWalletAddress);
            console.log('👤 User found in database:', user ? '✅ Yes' : '❌ No');
            if (!user) {
                console.log('❌ ExecuteSwapTool: User wallet not found in database');
                return JSON.stringify({
                    success: false,
                    error: 'User wallet not found in database'
                });
            }
            console.log('🔑 ExecuteSwapTool: Checking encrypted private key...');
            console.log('🔑 User wallet address:', user.walletAddress);
            console.log('🔑 Has encrypted private key:', user.encryptedPrivateKey ? '✅ Yes' : '❌ No');
            console.log('🔑 Private key length:', user.encryptedPrivateKey ? user.encryptedPrivateKey.length : 0);
            if (!user.encryptedPrivateKey) {
                console.log('❌ ExecuteSwapTool: User wallet not configured for transactions');
                return JSON.stringify({
                    success: false,
                    error: 'User wallet not configured for transactions. Please connect your wallet through the frontend first.'
                });
            }
            const { fromToken, toToken, fromAmount, slippage } = input;
            console.log('💰 ExecuteSwapTool: Swap details:');
            console.log('   From Token:', fromToken);
            console.log('   To Token:', toToken);
            console.log('   Amount:', fromAmount);
            console.log('   Slippage:', slippage);
            let slippageNumber = 5;
            if (slippage !== undefined) {
                slippageNumber = typeof slippage === 'string' ? parseFloat(slippage) : slippage;
                if (isNaN(slippageNumber)) {
                    console.log('❌ ExecuteSwapTool: Invalid slippage value');
                    return JSON.stringify({ success: false, error: 'Invalid slippage value. Must be a number.' });
                }
            }
            console.log('📊 ExecuteSwapTool: Processed slippage:', slippageNumber);
            let mappedFromToken = fromToken;
            let mappedToToken = toToken;
            if (fromToken === 'USDC' && toToken === 'XFI') {
                mappedToToken = 'WXFI';
                console.log('🔄 ExecuteSwapTool: USDC to XFI swap detected - will swap to WXFI then unwrap');
            }
            else if (fromToken === 'XFI' && toToken === 'USDC') {
                mappedFromToken = 'WXFI';
                console.log('🔄 ExecuteSwapTool: XFI to USDC swap detected - will unwrap XFI to WXFI first');
            }
            console.log('🔄 ExecuteSwapTool: Token mapping:');
            console.log('   From:', fromToken, '→', mappedFromToken);
            console.log('   To:', toToken, '→', mappedToToken);
            if (mappedFromToken === mappedToToken) {
                console.log('❌ ExecuteSwapTool: Cannot swap token for itself');
                return JSON.stringify({
                    success: false,
                    error: 'Cannot swap a token for itself. Please choose different tokens.'
                });
            }
            console.log('🔍 ExecuteSwapTool: Getting user model for SwapService...');
            const userModel = await User.findOne({ frontendWalletAddress });
            console.log('👤 User model found:', userModel ? '✅ Yes' : '❌ No');
            if (!userModel) {
                console.log('❌ ExecuteSwapTool: User not found in User model');
                return JSON.stringify({
                    success: false,
                    error: 'User not found in database'
                });
            }
            console.log('🔧 ExecuteSwapTool: Using database wallet for all operations');
            console.log('   Database wallet:', userModel.walletAddress);
            console.log('   Frontend wallet:', frontendWalletAddress);
            console.log('   Note: All operations use database wallet address');
            if (fromToken === 'USDC') {
                console.log('💰 ExecuteSwapTool: Checking USDC balance in database wallet...');
                try {
                    const { publicClient } = await import('./config/viem.js');
                    const { getTokenBySymbol } = await import('./constants/tokens.js');
                    const { parseUnits, formatUnits } = await import('viem');
                    const usdcToken = getTokenBySymbol('USDC');
                    const balance = await publicClient.readContract({
                        address: usdcToken.address,
                        abi: [
                            {
                                inputs: [{ name: 'account', type: 'address' }],
                                name: 'balanceOf',
                                outputs: [{ name: '', type: 'uint256' }],
                                stateMutability: 'view',
                                type: 'function'
                            }
                        ],
                        functionName: 'balanceOf',
                        args: [userModel.walletAddress]
                    });
                    const balanceFormatted = formatUnits(balance, usdcToken.decimals);
                    const requiredAmount = parseFloat(fromAmount);
                    console.log(`   USDC Balance: ${balanceFormatted}`);
                    console.log(`   Required: ${requiredAmount}`);
                    console.log(`   Sufficient: ${parseFloat(balanceFormatted) >= requiredAmount ? '✅ Yes' : '❌ No'}`);
                    if (parseFloat(balanceFormatted) < requiredAmount) {
                        return JSON.stringify({
                            success: false,
                            error: `Insufficient USDC balance. Required: ${requiredAmount}, Available: ${balanceFormatted}`
                        });
                    }
                }
                catch (error) {
                    console.log('   ❌ Error checking USDC balance:', error);
                }
            }
            console.log('💰 ExecuteSwapTool: Getting swap quote...');
            const quote = await SwapService.getSwapQuote({
                fromToken: mappedFromToken,
                toToken: mappedToToken,
                fromAmount,
                slippage: slippageNumber
            });
            console.log('✅ ExecuteSwapTool: Quote received successfully');
            console.log('   Quote details:', {
                fromAmount: quote.fromAmountFormatted,
                toAmount: quote.toAmountFormatted,
                price: quote.price,
                path: quote.path
            });
            console.log('🚀 ExecuteSwapTool: Executing swap transaction...');
            const swapResult = await SwapService.executeSwap(userModel, {
                fromToken: mappedFromToken,
                toToken: mappedToToken,
                fromAmount,
                slippage: slippageNumber
            });
            console.log('📊 ExecuteSwapTool: Swap result received');
            console.log('   Success:', swapResult.success);
            console.log('   Transaction hash:', swapResult.transactionHash);
            console.log('   Error:', swapResult.error);
            console.log('   Error code:', swapResult.errorCode);
            if (swapResult.success) {
                console.log('✅ ExecuteSwapTool: Swap successful!');
                console.log('   Transaction hash:', swapResult.transactionHash);
                console.log('   From amount:', swapResult.fromAmount);
                console.log('   To amount:', swapResult.toAmount);
                console.log('   Gas used:', swapResult.gasUsed);
                console.log('   Gas price:', swapResult.gasPrice);
                console.log('   Unwrap hash:', swapResult.unwrapTransactionHash || 'None');
                console.log('   Final token:', swapResult.finalToken || 'Not specified');
                try {
                    console.log('📡 ExecuteSwapTool: Emitting real-time events...');
                    const io = getIO();
                    emitTransactionSuccess(io, user.walletAddress, {
                        transactionHash: swapResult.transactionHash,
                        from: user.walletAddress,
                        to: 'Swap Contract',
                        value: `${fromAmount} ${fromToken} → ${swapResult.toAmount} ${toToken}`,
                        status: 'success',
                        explorerUrl: `${process.env.ENVIRONMENT === 'production' ? 'https://xfiscan.com' : 'https://test.xfiscan.com'}/tx/${swapResult.transactionHash}`
                    });
                    emitNewTransaction(io, user.walletAddress, {
                        hash: swapResult.transactionHash,
                        from: user.walletAddress,
                        to: 'Swap Contract',
                        value: `${fromAmount} ${fromToken} → ${swapResult.toAmount} ${toToken}`,
                        status: 'success',
                        timestamp: new Date().toISOString()
                    });
                    setTimeout(async () => {
                        try {
                            const balance = await BlockchainService.getBalance(user.walletAddress);
                            emitBalanceUpdate(io, user.walletAddress, {
                                address: balance.address,
                                balance: balance.balance,
                                formatted: balance.formatted,
                                symbol: 'XFI'
                            });
                        }
                        catch (balanceError) {
                            console.error('Error fetching updated balance:', balanceError);
                        }
                    }, 1000);
                }
                catch (socketError) {
                    console.error('❌ ExecuteSwapTool: Error emitting real-time events:', socketError);
                }
                console.log('📝 ExecuteSwapTool: Building success response...');
                let message = `Successfully swapped ${fromAmount} ${fromToken} for ${swapResult.toAmount} ${toToken}`;
                if (swapResult.unwrapTransactionHash) {
                    message += ` (converted to native XFI)`;
                }
                const result = {
                    success: true,
                    transactionHash: swapResult.transactionHash,
                    fromToken,
                    toToken,
                    fromAmount,
                    toAmount: swapResult.toAmount,
                    gasUsed: swapResult.gasUsed,
                    gasPrice: swapResult.gasPrice,
                    explorerUrl: `${process.env.ENVIRONMENT === 'production' ? 'https://xfiscan.com' : 'https://test.xfiscan.com'}/tx/${swapResult.transactionHash}`,
                    message
                };
                if (swapResult.unwrapTransactionHash) {
                    result.unwrapTransactionHash = swapResult.unwrapTransactionHash;
                    result.unwrapExplorerUrl = `${process.env.ENVIRONMENT === 'production' ? 'https://xfiscan.com' : 'https://test.xfiscan.com'}/tx/${swapResult.unwrapTransactionHash}`;
                    result.finalToken = swapResult.finalToken;
                }
                console.log('✅ ExecuteSwapTool: Returning success response');
                return JSON.stringify(result);
            }
            else {
                console.log('❌ ExecuteSwapTool: Swap failed');
                console.log('   Error:', swapResult.error);
                console.log('   Error code:', swapResult.errorCode);
                return JSON.stringify({
                    success: false,
                    error: swapResult.error || 'Swap execution failed',
                    errorCode: swapResult.errorCode
                });
            }
        }
        catch (error) {
            console.error('❌ ExecuteSwapTool: Unexpected error:', error);
            console.error('   Error message:', error.message);
            console.error('   Error stack:', error.stack);
            return JSON.stringify({
                success: false,
                error: error.message
            });
        }
    }
}
class GetSupportedSwapTokensTool extends StructuredTool {
    name = "get_supported_swap_tokens";
    description = "Gets the list of supported tokens for swapping. PRIMARY PAIRS: USDC↔XFI (recommended for stablecoin swaps). Note: USDT is temporarily disabled due to incorrect pricing.";
    schema = z.object({});
    async _call(input, runManager) {
        try {
            const supportedTokens = SwapService.getSupportedPairs();
            const swapConfig = SwapService.getSwapConfig();
            const filteredPairs = supportedTokens.filter(pair => pair.from !== 'USDT' && pair.to !== 'USDT');
            return JSON.stringify({
                success: true,
                supportedTokens: swapConfig.SUPPORTED_TOKENS,
                tradingPairs: filteredPairs.map(pair => ({
                    from: pair.from,
                    to: pair.to,
                    description: pair.description
                })),
                totalPairs: filteredPairs.length,
                primaryPairs: filteredPairs.filter(pair => (pair.from === 'USDC' && pair.to === 'XFI') ||
                    (pair.from === 'XFI' && pair.to === 'USDC')),
                note: "USDT swaps are temporarily disabled due to incorrect pricing. USDC↔XFI is the recommended stablecoin pair with accurate pricing (~13.12 XFI per 1 USDC).",
                config: {
                    defaultSlippage: swapConfig.DEFAULT_SLIPPAGE,
                    minSlippage: swapConfig.MIN_SLIPPAGE,
                    maxSlippage: swapConfig.MAX_SLIPPAGE,
                    deadlineMinutes: swapConfig.DEADLINE_MINUTES
                }
            });
        }
        catch (error) {
            console.error('Error in get_supported_swap_tokens:', error);
            return JSON.stringify({
                success: false,
                error: error.message
            });
        }
    }
}
export const ALL_TOOLS_LIST = [
    new GetWalletInfoTool(),
    new GetWalletForOperationsTool(),
    new GetBalanceTool(),
    new SendTransactionTool(),
    new SendTokenTool(),
    new GetTransactionHistoryTool(),
    new GetUserStatsTool(),
    new GetLeaderboardTool(),
    new SetUsernameTool(),
    new CreateGlobalPaymentLinkTool(),
    new CreatePaymentLinksTool(),
    new PayFixedPaymentLinkTool(),
    new ContributeToGlobalPaymentLinkTool(),
    new CheckPaymentLinkStatusTool(),
    ...CRYPTO_ASSISTANT_TOOLS,
    XFIPriceChartTool,
    XFIMarketDataTool,
    XFITradingSignalsTool,
    XFIPricePredictionTool,
    XFIMarketComparisonTool,
    new CreateDCAOrderTool(),
    new GetUserDCAOrdersTool(),
    new CancelDCAOrderTool(),
    new GetDCAOrderStatusTool(),
    new GetSwapQuoteTool(),
    new GetDCASystemStatusTool(),
    new GetUserTokenBalancesTool(),
    new ExecuteSwapTool(),
    new GetSupportedSwapTokensTool(),
    new AddLiquidityTool(),
];
const intelligentTool = new IntelligentTool(ALL_TOOLS_LIST);
export const ALL_TOOLS_LIST_WITH_INTELLIGENT = [
    intelligentTool,
    ...ALL_TOOLS_LIST
];
//# sourceMappingURL=tools.js.map