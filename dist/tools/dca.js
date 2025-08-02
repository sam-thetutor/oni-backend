import { DCAService } from '../services/dca.js';
import { SwapService } from '../services/swap.js';
import { PriceMonitorService } from '../services/price-monitor.js';
import { DCAExecutorService } from '../services/dca-executor.js';
import { TokenService } from '../services/tokens.js';
import { PriceAnalyticsService } from '../services/price-analytics.js';
import { WalletService } from '../services/wallet.js';
import { MongoDBService } from '../services/mongodb.js';
import { DCA_LIMITS, validateTriggerPrice, validateSlippage } from '../constants/tokens.js';
export async function createDCAOrder(params) {
    try {
        const user = await MongoDBService.getWalletByFrontendAddress(params.userId);
        if (!user) {
            return {
                success: false,
                message: 'User wallet not found. Please connect your wallet first.',
            };
        }
        if (!validateTriggerPrice(params.triggerPrice)) {
            return {
                success: false,
                message: `Trigger price must be between $${DCA_LIMITS.MIN_TRIGGER_PRICE} and $${DCA_LIMITS.MAX_TRIGGER_PRICE}`,
            };
        }
        const slippage = params.slippage || DCA_LIMITS.DEFAULT_SLIPPAGE;
        if (!validateSlippage(slippage)) {
            return {
                success: false,
                message: `Slippage must be between ${DCA_LIMITS.MIN_SLIPPAGE}% and ${DCA_LIMITS.MAX_SLIPPAGE}%`,
            };
        }
        const expirationDays = params.expirationDays || 30;
        const expiresAt = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000);
        const dcaParams = {
            userId: user.walletAddress,
            walletAddress: user.walletAddress,
            orderType: params.orderType,
            fromToken: params.fromToken,
            toToken: params.toToken,
            fromAmount: params.amount,
            triggerPrice: params.triggerPrice,
            triggerCondition: params.triggerCondition,
            maxSlippage: slippage,
            expiresAt,
        };
        const order = await DCAService.createDCAOrder(dcaParams);
        const currentPrice = await PriceAnalyticsService.getMarketData().then(data => data.current_price);
        const conditionText = params.triggerCondition === 'above' ? 'reaches or exceeds' : 'drops to or below';
        const priceDirection = params.triggerCondition === 'above' ? 'UP' : 'DOWN';
        const priceDifference = Math.abs(currentPrice - params.triggerPrice);
        const percentageChange = ((priceDifference / currentPrice) * 100).toFixed(2);
        return {
            success: true,
            orderId: order._id.toString(),
            message: `✅ DCA order created successfully!\n\n` +
                `📊 Order Details:\n` +
                `• Type: Swap ${params.amount} ${params.fromToken} to ${params.toToken}\n` +
                `• Trigger: When XFI price ${conditionText} $${params.triggerPrice}\n` +
                `• Current Price: $${currentPrice.toFixed(6)}\n` +
                `• Price needs to move ${priceDirection} by ${percentageChange}% ($${priceDifference.toFixed(6)})\n` +
                `• Slippage: ${slippage}%\n` +
                `• Expires: ${expiresAt.toLocaleDateString()}\n\n` +
                `🔄 Your order will be automatically executed when the price moves ${priceDirection} to reach the trigger.`,
            orderDetails: {
                orderId: order._id.toString(),
                orderType: params.orderType,
                fromAmount: params.amount,
                fromToken: params.fromToken,
                toToken: params.toToken,
                triggerPrice: params.triggerPrice,
                triggerCondition: params.triggerCondition,
                currentPrice,
                slippage,
                expiresAt,
            },
        };
    }
    catch (error) {
        console.error('Error creating DCA order:', error);
        return {
            success: false,
            message: `Failed to create DCA order: ${error.message}`,
        };
    }
}
export async function getUserDCAOrders(params) {
    try {
        const user = await WalletService.getWalletByAddress(params.userId);
        if (!user) {
            return {
                success: false,
                message: 'User wallet not found. Please connect your wallet first.',
            };
        }
        const orders = await DCAService.getUserDCAOrders(user.walletAddress, params.status, params.limit || 10);
        if (orders.length === 0) {
            const statusText = params.status ? ` ${params.status}` : '';
            return {
                success: true,
                message: `No${statusText} DCA orders found. You can create a new order by saying something like "swap 20 USDC when XFI hits $0.10".`,
                orders: [],
            };
        }
        const currentPrice = await PriceAnalyticsService.getMarketData().then(data => data.current_price);
        const formattedOrders = orders.map(order => {
            const priceDistance = ((order.triggerPrice - currentPrice) / currentPrice * 100).toFixed(2);
            const distanceText = order.triggerCondition === 'above'
                ? `+${priceDistance}%`
                : `${priceDistance}%`;
            return {
                ...order,
                currentPrice,
                priceDistance: distanceText,
                statusEmoji: getStatusEmoji(order.status),
            };
        });
        const statusText = params.status ? ` ${params.status}` : '';
        let message = `📋 Your${statusText} DCA Orders (Current XFI Price: $${currentPrice.toFixed(6)}):\n\n`;
        formattedOrders.forEach((order, index) => {
            message += `${index + 1}. ${order.statusEmoji} Swap ${order.fromAmountFormatted} ${order.fromToken} to ${order.toToken}\n`;
            message += `   • Trigger: $${order.triggerPrice} (${order.priceDistance} from current)\n`;
            message += `   • Status: ${order.status}\n`;
            message += `   • Created: ${new Date(order.createdAt).toLocaleDateString()}\n\n`;
        });
        return {
            success: true,
            message,
            orders: formattedOrders,
        };
    }
    catch (error) {
        console.error('Error getting user DCA orders:', error);
        return {
            success: false,
            message: `Failed to get DCA orders: ${error.message}`,
        };
    }
}
export async function cancelDCAOrder(params) {
    try {
        const user = await WalletService.getWalletByAddress(params.userId);
        if (!user) {
            return {
                success: false,
                message: 'User wallet not found. Please connect your wallet first.',
            };
        }
        const cancelled = await DCAService.cancelDCAOrder(params.orderId, user.privyId);
        if (cancelled) {
            return {
                success: true,
                message: `✅ DCA order cancelled successfully. The order will no longer be executed.`,
            };
        }
        else {
            return {
                success: false,
                message: `❌ Could not cancel the order. It may not exist, may not belong to you, or may have already been executed.`,
            };
        }
    }
    catch (error) {
        console.error('Error cancelling DCA order:', error);
        return {
            success: false,
            message: `Failed to cancel DCA order: ${error.message}`,
        };
    }
}
export async function getDCAOrderStatus(params) {
    try {
        const user = await WalletService.getWalletByAddress(params.userId);
        if (!user) {
            return {
                success: false,
                message: 'User wallet not found. Please connect your wallet first.',
            };
        }
        const order = await DCAService.getDCAOrderById(params.orderId, user.privyId);
        if (!order) {
            return {
                success: false,
                message: `❌ DCA order not found. Please check the order ID and try again.`,
            };
        }
        const currentPrice = await PriceAnalyticsService.getMarketData().then(data => data.current_price);
        const shouldExecute = DCAService.shouldExecuteOrder(order, currentPrice);
        const priceDistance = ((order.triggerPrice - currentPrice) / currentPrice * 100).toFixed(2);
        const distanceText = order.triggerCondition === 'above'
            ? `${priceDistance}% above current`
            : `${Math.abs(parseFloat(priceDistance))}% below current`;
        let message = `📊 DCA Order Details (${order._id})\n\n`;
        message += `${getStatusEmoji(order.status)} Status: ${order.status.toUpperCase()}\n`;
        message += `💱 Type: Swap ${order.fromToken} to ${order.toToken}\n`;
        message += `💰 Amount: ${order.fromAmount} ${order.fromToken}\n`;
        message += `🎯 Trigger: $${order.triggerPrice} (${distanceText})\n`;
        message += `📈 Current Price: $${currentPrice.toFixed(6)}\n`;
        message += `📅 Created: ${order.createdAt.toLocaleString()}\n`;
        if (order.expiresAt) {
            message += `⏰ Expires: ${order.expiresAt.toLocaleString()}\n`;
        }
        if (order.status === 'active') {
            message += `\n🔍 Ready to Execute: ${shouldExecute ? 'YES ✅' : 'NO (waiting for trigger price)'}\n`;
        }
        if (order.status === 'executed') {
            message += `\n✅ Executed at: ${order.executedAt?.toLocaleString()}\n`;
            message += `💱 Execution Price: $${order.executedPrice?.toFixed(6)}\n`;
            if (order.transactionHash) {
                message += `🔗 Transaction: ${order.transactionHash}\n`;
            }
        }
        if (order.status === 'failed') {
            message += `\n❌ Failure Reason: ${order.failureReason}\n`;
            message += `🔄 Retry Count: ${order.retryCount}/${order.maxRetries}\n`;
        }
        return {
            success: true,
            message,
            orderDetails: {
                ...order.toObject(),
                currentPrice,
                shouldExecute,
                priceDistance,
            },
        };
    }
    catch (error) {
        console.error('Error getting DCA order status:', error);
        return {
            success: false,
            message: `Failed to get order status: ${error.message}`,
        };
    }
}
export async function getSwapQuote(params) {
    try {
        const mappedFromToken = params.fromToken === 'XFI' ? 'CFI' : params.fromToken;
        const mappedToToken = params.toToken === 'XFI' ? 'CFI' : params.toToken;
        const quote = await SwapService.getSwapQuote({
            fromToken: mappedFromToken,
            toToken: mappedToToken,
            fromAmount: params.amount,
            slippage: params.slippage || 5
        });
        const message = `💱 Swap Quote\n\n` +
            `📥 You give: ${quote.fromAmountFormatted} ${quote.fromToken}\n` +
            `📤 You get: ${quote.toAmountFormatted} ${quote.toToken}\n` +
            `💰 Price: $${quote.price.toFixed(6)} per XFI\n` +
            `🎯 Min. received: ${quote.minimumReceivedFormatted} ${quote.toToken}\n` +
            `⛽ Est. gas fee: ${quote.gasEstimateFormatted} XFI\n` +
            `📊 Slippage: ${quote.slippage}%\n\n` +
            `Note: This is an instant swap quote. For automated swaps based on price triggers, use DCA orders.`;
        return {
            success: true,
            message,
            quote,
        };
    }
    catch (error) {
        console.error('Error getting swap quote:', error);
        return {
            success: false,
            message: `Failed to get swap quote: ${error.message}`,
        };
    }
}
export async function getDCASystemStatus() {
    try {
        const executorStatus = await DCAExecutorService.getStatus();
        const priceMonitorStatus = PriceMonitorService.getMonitoringStatus();
        let message = `🔧 DCA System Status\n\n`;
        message += `📊 Executor: ${executorStatus.isRunning ? '🟢 Running' : '🔴 Stopped'}\n`;
        message += `📈 Price Monitor: ${priceMonitorStatus.isRunning ? '🟢 Active' : '🔴 Inactive'}\n`;
        message += `⏰ Last Check: ${priceMonitorStatus.lastCheck.toLocaleTimeString()}\n`;
        message += `💰 Last Price: $${priceMonitorStatus.lastPrice.toFixed(6)}\n`;
        message += `📊 Total Checks: ${priceMonitorStatus.totalChecks}\n`;
        message += `✅ Executed Orders: ${priceMonitorStatus.executedOrders}\n`;
        message += `❌ Errors: ${priceMonitorStatus.errors}\n`;
        message += `⏱️ Uptime: ${executorStatus.uptime}\n\n`;
        message += `🔄 Next check in ~${Math.ceil((priceMonitorStatus.nextCheck.getTime() - Date.now()) / 1000)}s`;
        return {
            success: true,
            message,
            status: {
                executor: executorStatus,
                priceMonitor: priceMonitorStatus,
            },
        };
    }
    catch (error) {
        console.error('Error getting DCA system status:', error);
        return {
            success: false,
            message: `Failed to get system status: ${error.message}`,
        };
    }
}
export async function getUserTokenBalances(params) {
    try {
        const user = await WalletService.getWalletByAddress(params.userId);
        if (!user) {
            return {
                success: false,
                message: 'User wallet not found. Please connect your wallet first.',
            };
        }
        const balances = await TokenService.getDCATokenBalances(user.walletAddress);
        let message = `💰 Your Token Balances\n\n`;
        balances.forEach(balance => {
            message += `${balance.symbol === 'XFI' ? '🔵' : '🟢'} ${balance.symbol}: ${parseFloat(balance.formatted).toFixed(6)}\n`;
        });
        message += `\n💡 You can create DCA orders to automatically swap between XFI and USDC based on price triggers. USDC↔XFI is the recommended stablecoin pair with accurate pricing (~13.12 XFI per 1 USDC). Note: USDT is temporarily disabled due to incorrect pricing.`;
        return {
            success: true,
            message,
            balances,
        };
    }
    catch (error) {
        console.error('Error getting user token balances:', error);
        return {
            success: false,
            message: `Failed to get token balances: ${error.message}`,
        };
    }
}
function getStatusEmoji(status) {
    switch (status) {
        case 'active': return '🟡';
        case 'executed': return '✅';
        case 'cancelled': return '❌';
        case 'failed': return '🔴';
        case 'expired': return '⏰';
        default: return '❓';
    }
}
//# sourceMappingURL=dca.js.map