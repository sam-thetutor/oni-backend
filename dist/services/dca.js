import { DCAOrder } from '../models/DCAOrder.js';
import { TokenService } from './tokens.js';
import { PriceAnalyticsService } from './price-analytics.js';
import { WalletService } from './wallet.js';
import { TOKEN_ADDRESSES, TOKEN_METADATA, DCA_LIMITS, validateTokenAmount, validateTriggerPrice, validateSlippage } from '../constants/tokens.js';
export class DCAService {
    static async createDCAOrder(params) {
        try {
            const validation = await this.validateDCAOrderParams(params);
            if (!validation.valid) {
                throw new Error(validation.error);
            }
            const existingOrders = await DCAOrder.find({
                userId: params.userId,
                status: 'active'
            });
            if (existingOrders.length >= DCA_LIMITS.MAX_ORDERS_PER_USER) {
                throw new Error(`Maximum ${DCA_LIMITS.MAX_ORDERS_PER_USER} active orders allowed per user`);
            }
            const fromToken = params.fromToken;
            const toToken = params.toToken;
            const expiresAt = params.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            const dcaOrder = new DCAOrder({
                userId: params.userId,
                walletAddress: params.walletAddress,
                orderType: params.orderType,
                fromToken,
                toToken,
                fromAmount: TokenService.parseTokenAmount(params.fromAmount, TOKEN_METADATA[fromToken].decimals),
                triggerPrice: params.triggerPrice,
                triggerCondition: params.triggerCondition,
                maxSlippage: params.maxSlippage || DCA_LIMITS.DEFAULT_SLIPPAGE,
                expiresAt,
                status: 'active',
                retryCount: 0,
                maxRetries: 3,
            });
            await dcaOrder.save();
            return dcaOrder;
        }
        catch (error) {
            console.error('Error creating DCA order:', error);
            throw error;
        }
    }
    static async getUserDCAOrders(userId, status, limit = 50) {
        try {
            const query = { userId };
            if (status) {
                query.status = status;
            }
            const orders = await DCAOrder.find(query)
                .sort({ createdAt: -1 })
                .limit(limit);
            return orders.map(order => this.formatDCAOrderSummary(order));
        }
        catch (error) {
            console.error('Error getting user DCA orders:', error);
            throw new Error('Failed to get DCA orders');
        }
    }
    static async getActiveOrdersForExecution() {
        try {
            const now = new Date();
            return await DCAOrder.find({
                status: 'active',
                $or: [
                    { expiresAt: { $exists: false } },
                    { expiresAt: { $gt: now } }
                ],
                retryCount: { $lt: 3 }
            }).sort({ createdAt: 1 });
        }
        catch (error) {
            console.error('Error getting active orders for execution:', error);
            return [];
        }
    }
    static shouldExecuteOrder(order, currentPrice) {
        const { triggerPrice, triggerCondition } = order;
        if (triggerCondition === 'above') {
            return currentPrice >= triggerPrice;
        }
        else if (triggerCondition === 'below') {
            return currentPrice <= triggerPrice;
        }
        return false;
    }
    static isOrderReadyForExecution(order, currentPrice) {
        const { triggerPrice, triggerCondition } = order;
        if (triggerCondition === 'above') {
            return currentPrice < triggerPrice;
        }
        else if (triggerCondition === 'below') {
            return currentPrice > triggerPrice;
        }
        return false;
    }
    static async executeDCAOrder(order) {
        try {
            console.log(`Executing DCA order ${order._id}`);
            const user = await WalletService.getWalletByAddress(order.walletAddress);
            if (!user) {
                throw new Error('User not found');
            }
            const currentPrice = await PriceAnalyticsService.getMarketData().then(data => data.current_price);
            if (!this.shouldExecuteOrder(order, currentPrice)) {
                throw new Error('Order no longer meets execution criteria');
            }
            console.log(`DCA order ${order._id} ready for execution - swap functionality needs to be implemented`);
            order.status = 'failed';
            order.failureReason = 'Swap functionality temporarily unavailable';
            order.retryCount += 1;
            await order.save();
            return {
                success: false,
                error: 'Swap functionality temporarily unavailable',
            };
        }
        catch (error) {
            console.error(`Error executing DCA order ${order._id}:`, error);
            order.retryCount += 1;
            order.failureReason = error.message;
            if (order.retryCount >= order.maxRetries) {
                order.status = 'failed';
            }
            await order.save();
            return {
                success: false,
                error: error.message,
            };
        }
    }
    static async cancelDCAOrder(orderId, userId) {
        try {
            const order = await DCAOrder.findOne({
                _id: orderId,
                userId,
                status: 'active'
            });
            if (!order) {
                throw new Error('Order not found or not cancellable');
            }
            order.status = 'cancelled';
            await order.save();
            return true;
        }
        catch (error) {
            console.error('Error cancelling DCA order:', error);
            throw error;
        }
    }
    static async deleteDCAOrder(userId, orderId) {
        try {
            const order = await DCAOrder.findOneAndDelete({ _id: orderId, userId });
            if (!order) {
                return null;
            }
            console.log(`DCA order ${orderId} permanently deleted for user ${userId}`);
            return order;
        }
        catch (error) {
            console.error('Error deleting DCA order:', error);
            return null;
        }
    }
    static async updateDCAOrder(orderId, userId, updates) {
        try {
            const order = await DCAOrder.findOne({
                _id: orderId,
                userId,
                status: 'active'
            });
            if (!order) {
                throw new Error('Order not found or not updatable');
            }
            if (updates.triggerPrice && !validateTriggerPrice(updates.triggerPrice)) {
                throw new Error('Invalid trigger price');
            }
            if (updates.maxSlippage && !validateSlippage(updates.maxSlippage)) {
                throw new Error('Invalid slippage value');
            }
            Object.assign(order, updates);
            await order.save();
            return order;
        }
        catch (error) {
            console.error('Error updating DCA order:', error);
            throw error;
        }
    }
    static async getDCAOrderById(orderId, userId) {
        try {
            const query = { _id: orderId };
            if (userId) {
                query.userId = userId;
            }
            return await DCAOrder.findOne(query);
        }
        catch (error) {
            console.error('Error getting DCA order by ID:', error);
            return null;
        }
    }
    static async cleanupExpiredOrders() {
        try {
            const now = new Date();
            const result = await DCAOrder.updateMany({
                status: 'active',
                expiresAt: { $lt: now }
            }, {
                $set: { status: 'expired' }
            });
            console.log(`Marked ${result.modifiedCount} orders as expired`);
            return result.modifiedCount;
        }
        catch (error) {
            console.error('Error cleaning up expired orders:', error);
            return 0;
        }
    }
    static async getUserDCAStats(userId) {
        try {
            const pipeline = [
                { $match: { userId } },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        totalVolume: { $sum: { $toDouble: '$fromAmount' } }
                    }
                }
            ];
            const stats = await DCAOrder.aggregate(pipeline);
            const summary = {
                total: 0,
                active: 0,
                executed: 0,
                cancelled: 0,
                failed: 0,
                expired: 0,
                totalVolume: 0,
            };
            stats.forEach(stat => {
                summary.total += stat.count;
                summary[stat._id] = stat.count;
                summary.totalVolume += stat.totalVolume || 0;
            });
            return summary;
        }
        catch (error) {
            console.error('Error getting user DCA stats:', error);
            throw new Error('Failed to get DCA statistics');
        }
    }
    static async validateDCAOrderParams(params) {
        try {
            if (!validateTriggerPrice(params.triggerPrice)) {
                return {
                    valid: false,
                    error: `Trigger price must be between $${DCA_LIMITS.MIN_TRIGGER_PRICE} and $${DCA_LIMITS.MAX_TRIGGER_PRICE}`
                };
            }
            const currentPrice = await PriceAnalyticsService.getMarketData().then(data => data.current_price);
            const slippage = params.maxSlippage || DCA_LIMITS.DEFAULT_SLIPPAGE;
            if (!validateSlippage(slippage)) {
                return {
                    valid: false,
                    error: `Slippage must be between ${DCA_LIMITS.MIN_SLIPPAGE}% and ${DCA_LIMITS.MAX_SLIPPAGE}%`
                };
            }
            const tokenSymbol = params.fromToken;
            if (!validateTokenAmount(tokenSymbol, params.fromAmount)) {
                return {
                    valid: false,
                    error: `Invalid amount for ${tokenSymbol}`
                };
            }
            const user = await WalletService.getWalletByAddress(params.walletAddress);
            if (!user) {
                return {
                    valid: false,
                    error: 'User not found'
                };
            }
            const tokenMeta = TOKEN_METADATA[tokenSymbol];
            const balanceCheck = await TokenService.validateSufficientBalance(tokenMeta.address, params.walletAddress, params.fromAmount);
            if (!balanceCheck.sufficient) {
                return {
                    valid: false,
                    error: `Insufficient ${tokenSymbol} balance. Required: ${balanceCheck.required}, Available: ${balanceCheck.balance}`
                };
            }
            return { valid: true };
        }
        catch (error) {
            console.error('Error validating DCA order params:', error);
            return {
                valid: false,
                error: 'Failed to validate order parameters'
            };
        }
    }
    static getTokensForOrderType(orderType) {
        if (orderType === 'buy') {
            return {
                fromToken: TOKEN_ADDRESSES.USDC,
                toToken: TOKEN_ADDRESSES.XFI
            };
        }
        else {
            return {
                fromToken: TOKEN_ADDRESSES.XFI,
                toToken: TOKEN_ADDRESSES.USDC
            };
        }
    }
    static formatDCAOrderSummary(order) {
        const fromTokenSymbol = order.fromToken;
        const toTokenSymbol = order.toToken;
        const fromTokenMeta = TOKEN_METADATA[fromTokenSymbol];
        return {
            id: order._id.toString(),
            orderType: order.orderType,
            fromToken: fromTokenSymbol,
            toToken: toTokenSymbol,
            fromAmount: order.fromAmount,
            fromAmountFormatted: TokenService.formatTokenAmount(order.fromAmount, fromTokenMeta.decimals),
            triggerPrice: order.triggerPrice,
            triggerCondition: order.triggerCondition,
            status: order.status,
            createdAt: order.createdAt,
            expiresAt: order.expiresAt,
        };
    }
}
//# sourceMappingURL=dca.js.map