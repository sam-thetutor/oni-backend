import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { WalletService } from "./services/wallet.js";
import { BlockchainService } from "./services/blockchain.js";
import { GamificationService } from "./services/gamification.js";
import { User } from "./models/User.js";
import { PaymentLink } from "./models/PaymentLink.js";
import { nanoid } from "nanoid";
import { PaymentLinkService } from "./services/paymentlinks.js";
import { ContractReadService } from "./services/contractread.js";
import { CRYPTO_ASSISTANT_TOOLS } from "./tools/crypto-assistant.js";
import { SwapService } from "./services/swap.js";
import { XFIPriceChartTool, XFIMarketDataTool, XFITradingSignalsTool, XFIPricePredictionTool, XFIMarketComparisonTool } from './tools/price-analysis.js';
import { createDCAOrder, getUserDCAOrders, cancelDCAOrder, getDCAOrderStatus, getSwapQuote, getDCASystemStatus, getUserTokenBalances } from './tools/dca.js';
import { emitBalanceUpdate, emitNewTransaction, emitPointsEarned, emitTransactionSuccess } from './socket/events.js';
import { getIO } from './socket/index.js';
let currentUserId = null;
export const setCurrentUserId = (userId) => {
    currentUserId = userId;
};
class GetWalletInfoTool extends StructuredTool {
    name = "get_wallet_info";
    description = "Gets information about the user's wallet";
    schema = z.object({});
    async _call(input, runManager) {
        try {
            const walletAddress = currentUserId;
            if (!walletAddress) {
                return JSON.stringify({
                    success: false,
                    error: 'Wallet address not found. Please try again.'
                });
            }
            const user = await WalletService.getWalletByAddress(walletAddress);
            if (!user) {
                return JSON.stringify({
                    success: false,
                    error: 'User wallet not found in database'
                });
            }
            return JSON.stringify({
                success: true,
                walletAddress: user.walletAddress,
                chainId: user.chainId,
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
            const walletAddress = currentUserId;
            if (!walletAddress) {
                return JSON.stringify({
                    success: false,
                    error: 'Wallet address not found. Please try again.'
                });
            }
            const user = await WalletService.getWalletByAddress(walletAddress);
            if (!user) {
                return JSON.stringify({
                    success: false,
                    error: 'User wallet not found in database'
                });
            }
            const walletForOps = await WalletService.getWalletForOperations(user.privyId);
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
    description = "Gets the balance of the user's wallet";
    schema = z.object({});
    async _call(input, runManager) {
        try {
            const walletAddress = currentUserId;
            if (!walletAddress) {
                return JSON.stringify({
                    success: false,
                    error: 'Wallet address not found. Please try again.'
                });
            }
            if (!BlockchainService.isValidAddress(walletAddress)) {
                return JSON.stringify({
                    success: false,
                    error: 'Invalid wallet address format'
                });
            }
            const balance = await BlockchainService.getBalance(walletAddress);
            return JSON.stringify({
                success: true,
                address: balance.address,
                balance: balance.balance,
                formatted: balance.formatted,
                symbol: 'XFI'
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
            const walletAddress = currentUserId;
            if (!walletAddress) {
                return JSON.stringify({
                    success: false,
                    error: 'Wallet address not found. Please try again.'
                });
            }
            if (!BlockchainService.isValidAddress(to)) {
                return JSON.stringify({
                    success: false,
                    error: 'Invalid recipient address format'
                });
            }
            const user = await WalletService.getWalletByAddress(walletAddress);
            if (!user) {
                return JSON.stringify({
                    success: false,
                    error: 'User wallet not found in database'
                });
            }
            const transaction = await BlockchainService.sendTransaction(user, to, amount, data);
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

            // Emit real-time events
            try {
                const io = getIO();
                
                // Emit transaction success
                emitTransactionSuccess(io, walletAddress, {
                    transactionHash: transaction.hash,
                    from: transaction.from,
                    to: transaction.to,
                    value: transaction.value,
                    status: transaction.status,
                    explorerUrl: transaction.transactionUrl || null
                });

                // Emit new transaction
                emitNewTransaction(io, walletAddress, {
                    hash: transaction.hash,
                    from: transaction.from,
                    to: transaction.to,
                    value: transaction.value,
                    status: transaction.status,
                    timestamp: new Date().toISOString()
                });

                // Emit points earned if any
                if (transaction.reward) {
                    emitPointsEarned(io, walletAddress, {
                        points: transaction.reward.totalPoints,
                        reason: transaction.reward.reason,
                        transactionHash: transaction.hash
                    });
                }

                // Get and emit updated balance
                setTimeout(async () => {
                    try {
                        const balance = await BlockchainService.getBalance(walletAddress);
                        emitBalanceUpdate(io, walletAddress, {
                            address: balance.address,
                            balance: balance.balance,
                            formatted: balance.formatted,
                            symbol: 'XFI'
                        });
                    } catch (balanceError) {
                        console.error('Error fetching updated balance:', balanceError);
                    }
                }, 2000); // Wait 2 seconds for blockchain to update

            } catch (socketError) {
                console.error('Error emitting real-time events:', socketError);
                // Don't fail the transaction if real-time updates fail
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
class GetTransactionHistoryTool extends StructuredTool {
    name = "get_transaction_history";
    description = "Gets transaction history for the user's wallet";
    schema = z.object({
        limit: z.number().optional().describe("Number of transactions to return (default: 10)")
    });
    async _call(input, runManager) {
        try {
            const { limit = 10 } = input;
            const walletAddress = currentUserId;
            if (!walletAddress) {
                return JSON.stringify({
                    success: false,
                    error: 'Wallet address not found. Please try again.'
                });
            }
            if (!BlockchainService.isValidAddress(walletAddress)) {
                return JSON.stringify({
                    success: false,
                    error: 'Invalid wallet address format'
                });
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
            const walletAddress = currentUserId;
            if (!walletAddress) {
                return JSON.stringify({
                    success: false,
                    error: 'Wallet address not found. Please try again.'
                });
            }
            const user = await WalletService.getWalletByAddress(walletAddress);
            if (!user) {
                return JSON.stringify({
                    success: false,
                    error: 'User wallet not found in database'
                });
            }
            const stats = await GamificationService.getUserStats(user.privyId);
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
            const walletAddress = currentUserId;
            if (!walletAddress) {
                return JSON.stringify({ success: false, error: 'Wallet address not found. Please try again.' });
            }
            const user = await WalletService.getWalletByAddress(walletAddress);
            if (!user) {
                return JSON.stringify({ success: false, error: 'User wallet not found in database' });
            }
            if (!username || typeof username !== 'string' || username.length < 3 || username.length > 20 || !/^[a-zA-Z0-9_]+$/.test(username)) {
                return JSON.stringify({ success: false, error: 'Invalid username. Must be 3-20 characters, alphanumeric or underscores.' });
            }
            const existing = await User.findOne({ username: username });
            if (existing && existing.privyId !== user.privyId) {
                return JSON.stringify({ success: false, error: 'Username already taken' });
            }
            user.username = username;
            await user.save();
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
            const walletAddress = currentUserId;
            if (!walletAddress) {
                return JSON.stringify({
                    success: false,
                    error: 'Wallet address not found. Please try again.'
                });
            }
            const user = await WalletService.getWalletByAddress(walletAddress);
            if (!user) {
                return JSON.stringify({
                    success: false,
                    error: 'User wallet not found in database'
                });
            }
            const globalLinkID = nanoid(10);
            const walletForOps = await WalletService.getWalletForOperations(user.privyId);
            if (!walletForOps) {
                return JSON.stringify({
                    success: false,
                    error: 'Failed to get wallet for operations'
                });
            }
            const transactionHash = await PaymentLinkService.createGlobalPaymentLinkOnChain(walletForOps.privateKey, globalLinkID);
            const paymentLink = await PaymentLinkService.createGlobalPaymentLink(user.privyId, globalLinkID);
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
            const walletAddress = currentUserId;
            if (!walletAddress) {
                return JSON.stringify({
                    success: false,
                    error: 'Wallet address not found. Please try again.'
                });
            }
            const user = await WalletService.getWalletByAddress(walletAddress);
            if (!user) {
                return JSON.stringify({
                    success: false,
                    error: 'User wallet not found in database'
                });
            }
            const paymentLinkID = nanoid(10);
            const walletForOps = await WalletService.getWalletForOperations(user.privyId);
            if (!walletForOps) {
                return JSON.stringify({
                    success: false,
                    error: 'Failed to get wallet for operations'
                });
            }
            const isGlobal = !amount || amount.trim() === '';
            if (isGlobal) {
                const transactionHash = await PaymentLinkService.createGlobalPaymentLinkOnChain(walletForOps.privateKey, paymentLinkID);
                const paymentLink = await PaymentLinkService.createGlobalPaymentLink(user.privyId, paymentLinkID);
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
                const paymentLink = await PaymentLinkService.createPaymentLink(user.privyId, Number(amount), paymentLinkID);
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
            const walletAddress = currentUserId;
            if (!walletAddress) {
                return JSON.stringify({
                    success: false,
                    error: 'Wallet address not found. Please try again.'
                });
            }
            const user = await WalletService.getWalletByAddress(walletAddress);
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
            const walletForOps = await WalletService.getWalletForOperations(user.privyId);
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
            const walletAddress = currentUserId;
            if (!walletAddress) {
                return JSON.stringify({
                    success: false,
                    error: 'Wallet address not found. Please try again.'
                });
            }
            const user = await WalletService.getWalletByAddress(walletAddress);
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
            const walletForOps = await WalletService.getWalletForOperations(user.privyId);
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
                return JSON.stringify({
                    success: true,
                    linkId: linkId,
                    contributionAmount: amount,
                    contributionAmountXFI: Number(amount),
                    transactionHash: result.data.transactionHash,
                    linkCreator: linkStatus.data.creator,
                    previousTotal: linkStatus.data.totalContributionsInXFI,
                    newEstimatedTotal: linkStatus.data.totalContributionsInXFI + Number(amount),
                    explorerUrl: `https://test.xfiscan.com/tx/${result.data.transactionHash}`,
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
    description = "Creates an automated DCA (Dollar Cost Averaging) order to buy or sell XFI when the price reaches a trigger condition. Users can say things like 'buy 10 tUSDC when XFI hits $0.05' or 'sell 5 XFI if price drops below $0.04'";
    schema = z.object({
        orderType: z.enum(["buy", "sell"]).describe("Order type: 'buy' or 'sell'"),
        amount: z.string().describe("Amount to buy or sell"),
        triggerPrice: z.number().describe("Trigger price for the order"),
        triggerCondition: z.enum(["above", "below"]).describe("Trigger condition: 'above' or 'below'"),
        slippage: z.number().optional().describe("Maximum slippage percentage (default: 5%)"),
        expirationDays: z.number().optional().describe("Order expiration in days (default: 30)")
    });
    async _call(input, runManager) {
        try {
            const userId = currentUserId;
            if (!userId) {
                return JSON.stringify({ success: false, error: 'User not authenticated. Please try again.' });
            }
            const { orderType, amount, triggerPrice, triggerCondition, slippage, expirationDays } = input;
            if (!orderType || !amount || triggerPrice === undefined || !triggerCondition) {
                return JSON.stringify({ success: false, error: 'Missing required DCA order fields.' });
            }
            const params = {
                userId,
                orderType,
                amount,
                triggerPrice,
                triggerCondition,
                slippage,
                expirationDays
            };
            const result = await createDCAOrder(params);
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
            const userId = currentUserId;
            if (!userId) {
                return JSON.stringify({
                    success: false,
                    error: 'User not authenticated. Please try again.'
                });
            }
            const result = await getUserDCAOrders({
                userId,
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
            const userId = currentUserId;
            if (!userId) {
                return JSON.stringify({ success: false, error: 'User not authenticated. Please try again.' });
            }
            const { orderId } = input;
            if (!orderId) {
                return JSON.stringify({ success: false, error: 'Missing required orderId.' });
            }
            const params = { userId, orderId };
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
            const userId = currentUserId;
            if (!userId) {
                return JSON.stringify({ success: false, error: 'User not authenticated. Please try again.' });
            }
            const { orderId } = input;
            if (!orderId) {
                return JSON.stringify({ success: false, error: 'Missing required orderId.' });
            }
            const params = { userId, orderId };
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
    description = "Gets a quote for an immediate token swap between XFI and tUSDC";
    schema = z.object({
        fromToken: z.enum(["XFI", "tUSDC"]).describe("Token to swap from"),
        toToken: z.enum(["XFI", "tUSDC"]).describe("Token to swap to"),
        amount: z.string().describe("Amount to swap"),
        slippage: z.number().optional().describe("Maximum slippage percentage (default: 5%)")
    });
    async _call(input, runManager) {
        try {
            const { fromToken, toToken, amount, slippage } = input;
            if (!fromToken || !toToken || !amount) {
                return JSON.stringify({ success: false, error: 'Missing required swap quote fields.' });
            }
            const params = {
                fromToken,
                toToken,
                amount
            };
            if (slippage !== undefined) {
                params.slippage = slippage;
            }
            const result = await getSwapQuote(params);
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
    description = "Gets the user's current balances for DCA-supported tokens (XFI and tUSDC)";
    schema = z.object({});
    async _call(input, runManager) {
        try {
            const userId = currentUserId;
            if (!userId) {
                return JSON.stringify({
                    success: false,
                    error: 'User not authenticated. Please try again.'
                });
            }
            const result = await getUserTokenBalances({ userId });
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
    description = "Adds liquidity to the XFI/tUSDC swap pool. Both XFI and tUSDC amounts are required to maintain the pool balance.";
    schema = z.object({
        xfiAmount: z.string().describe("Amount of XFI to add to the pool"),
        tUSDCAmount: z.string().describe("Amount of tUSDC to add to the pool"),
        slippage: z.number().optional().describe("Maximum slippage percentage (default: 5%)")
    });
    async _call(input, runManager) {
        try {
            const userId = currentUserId;
            if (!userId) {
                return JSON.stringify({
                    success: false,
                    error: 'User not authenticated. Please try again.'
                });
            }
            const user = await WalletService.getWalletByAddress(userId);
            if (!user) {
                return JSON.stringify({
                    success: false,
                    error: 'User wallet not found in database'
                });
            }
            const { xfiAmount, tUSDCAmount, slippage = 5 } = input;
            const result = await SwapService.addLiquidity(user, xfiAmount, tUSDCAmount, slippage);
            if (result.success) {
                return JSON.stringify({
                    success: true,
                    message: `✅ Successfully added ${xfiAmount} XFI + ${tUSDCAmount} tUSDC to the liquidity pool!`,
                    transactionHash: result.transactionHash,
                    xfiAmount,
                    tUSDCAmount,
                    slippage
                });
            }
            else {
                return JSON.stringify({
                    success: false,
                    error: result.error || 'Failed to add liquidity'
                });
            }
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
export const ALL_TOOLS_LIST = [
    new GetWalletInfoTool(),
    new GetWalletForOperationsTool(),
    new GetBalanceTool(),
    new SendTransactionTool(),
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
    new AddLiquidityTool(),
];
//# sourceMappingURL=tools.js.map