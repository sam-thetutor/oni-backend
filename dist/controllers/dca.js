import { DCAService } from '../services/dca.js';
import { PriceMonitorService } from '../services/price-monitor.js';
import { DCAExecutorService } from '../services/dca-executor.js';
import { MongoDBService } from '../services/mongodb.js';
import { validateTriggerPrice, validateSlippage, DCA_LIMITS } from '../constants/tokens.js';
import { TokenService } from '../services/tokens.js';
export class DCAController {
    static async createOrder(req, res) {
        try {
            const { orderType, fromToken, toToken, amount, triggerPrice, triggerCondition, slippage, expirationDays } = req.body;
            const frontendWalletAddress = req.user?.frontendWalletAddress;
            if (!frontendWalletAddress) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            if (!orderType || !amount || !triggerPrice || !triggerCondition) {
                res.status(400).json({
                    error: 'Missing required fields: orderType, amount, triggerPrice, triggerCondition'
                });
                return;
            }
            if (orderType !== 'swap') {
                res.status(400).json({ error: 'Invalid order type. Must be "swap"' });
                return;
            }
            if (!['above', 'below'].includes(triggerCondition)) {
                res.status(400).json({ error: 'Invalid trigger condition. Must be "above" or "below"' });
                return;
            }
            if (!validateTriggerPrice(triggerPrice)) {
                res.status(400).json({
                    error: `Trigger price must be between $${DCA_LIMITS.MIN_TRIGGER_PRICE} and $${DCA_LIMITS.MAX_TRIGGER_PRICE}`
                });
                return;
            }
            if (slippage !== undefined && !validateSlippage(slippage)) {
                res.status(400).json({
                    error: `Slippage must be between ${DCA_LIMITS.MIN_SLIPPAGE}% and ${DCA_LIMITS.MAX_SLIPPAGE}%`
                });
                return;
            }
            const user = await MongoDBService.getWalletByFrontendAddress(frontendWalletAddress);
            if (!user) {
                res.status(404).json({ error: 'User wallet not found' });
                return;
            }
            const expiresAt = expirationDays
                ? new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000)
                : undefined;
            const dcaParams = {
                userId: user.walletAddress,
                walletAddress: user.walletAddress,
                orderType,
                fromToken,
                toToken,
                fromAmount: amount.toString(),
                triggerPrice: parseFloat(triggerPrice),
                triggerCondition,
                maxSlippage: slippage || DCA_LIMITS.DEFAULT_SLIPPAGE,
                expiresAt,
            };
            const order = await DCAService.createDCAOrder(dcaParams);
            res.status(201).json({
                success: true,
                message: 'DCA order created successfully',
                data: {
                    orderId: order._id,
                    orderType: order.orderType,
                    fromAmount: order.fromAmount,
                    triggerPrice: order.triggerPrice,
                    triggerCondition: order.triggerCondition,
                    status: order.status,
                    createdAt: order.createdAt,
                    expiresAt: order.expiresAt,
                },
            });
        }
        catch (error) {
            console.error('Error creating DCA order:', error);
            res.status(500).json({
                error: 'Failed to create DCA order',
                message: error.message
            });
        }
    }
    static async getUserOrders(req, res) {
        try {
            const frontendWalletAddress = req.user?.frontendWalletAddress;
            const { status, limit } = req.query;
            if (!frontendWalletAddress) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            const user = await MongoDBService.getWalletByFrontendAddress(frontendWalletAddress);
            if (!user) {
                res.status(404).json({ error: 'User wallet not found' });
                return;
            }
            const orders = await DCAService.getUserDCAOrders(user.walletAddress, status, limit ? parseInt(limit) : undefined);
            res.json({
                success: true,
                orders: orders,
                count: orders.length,
            });
        }
        catch (error) {
            console.error('Error getting user DCA orders:', error);
            res.status(500).json({
                error: 'Failed to get DCA orders',
                message: error.message
            });
        }
    }
    static async getOrderById(req, res) {
        try {
            const { orderId } = req.params;
            const frontendWalletAddress = req.user?.frontendWalletAddress;
            if (!frontendWalletAddress) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            const user = await MongoDBService.getWalletByFrontendAddress(frontendWalletAddress);
            if (!user) {
                res.status(404).json({ error: 'User wallet not found' });
                return;
            }
            const order = await DCAService.getDCAOrderById(orderId, user.walletAddress);
            if (!order) {
                res.status(404).json({ error: 'DCA order not found' });
                return;
            }
            res.json({
                success: true,
                data: order,
            });
        }
        catch (error) {
            console.error('Error getting DCA order:', error);
            res.status(500).json({
                error: 'Failed to get DCA order',
                message: error.message
            });
        }
    }
    static async updateOrder(req, res) {
        try {
            const { orderId } = req.params;
            const frontendWalletAddress = req.user?.frontendWalletAddress;
            const updates = req.body;
            if (!frontendWalletAddress) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            if (updates.triggerPrice && !validateTriggerPrice(updates.triggerPrice)) {
                res.status(400).json({
                    error: `Trigger price must be between $${DCA_LIMITS.MIN_TRIGGER_PRICE} and $${DCA_LIMITS.MAX_TRIGGER_PRICE}`
                });
                return;
            }
            if (updates.maxSlippage && !validateSlippage(updates.maxSlippage)) {
                res.status(400).json({
                    error: `Slippage must be between ${DCA_LIMITS.MIN_SLIPPAGE}% and ${DCA_LIMITS.MAX_SLIPPAGE}%`
                });
                return;
            }
            const user = await MongoDBService.getWalletByFrontendAddress(frontendWalletAddress);
            if (!user) {
                res.status(404).json({ error: 'User wallet not found' });
                return;
            }
            const updatedOrder = await DCAService.updateDCAOrder(orderId, user.walletAddress, updates);
            res.json({
                success: true,
                message: 'DCA order updated successfully',
                data: updatedOrder,
            });
        }
        catch (error) {
            console.error('Error updating DCA order:', error);
            res.status(500).json({
                error: 'Failed to update DCA order',
                message: error.message
            });
        }
    }
    static async cancelOrder(req, res) {
        try {
            const { orderId } = req.params;
            const frontendWalletAddress = req.user?.frontendWalletAddress;
            if (!frontendWalletAddress) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            const user = await MongoDBService.getWalletByFrontendAddress(frontendWalletAddress);
            if (!user) {
                res.status(404).json({ error: 'User wallet not found' });
                return;
            }
            const cancelled = await DCAService.cancelDCAOrder(orderId, user.walletAddress);
            if (!cancelled) {
                res.status(404).json({ error: 'DCA order not found or cannot be cancelled' });
                return;
            }
            res.json({
                success: true,
                message: 'DCA order cancelled successfully',
            });
        }
        catch (error) {
            console.error('Error cancelling DCA order:', error);
            res.status(500).json({
                error: 'Failed to cancel DCA order',
                message: error.message
            });
        }
    }
    static async getUserStats(req, res) {
        try {
            const frontendWalletAddress = req.user?.frontendWalletAddress;
            if (!frontendWalletAddress) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            const user = await MongoDBService.getWalletByFrontendAddress(frontendWalletAddress);
            if (!user) {
                res.status(404).json({ error: 'User wallet not found' });
                return;
            }
            const stats = await DCAService.getUserDCAStats(user.walletAddress);
            res.json({
                success: true,
                data: stats,
            });
        }
        catch (error) {
            console.error('Error getting user DCA stats:', error);
            res.status(500).json({
                error: 'Failed to get DCA statistics',
                message: error.message
            });
        }
    }
    static async getUserTokenBalances(req, res) {
        try {
            const frontendWalletAddress = req.user?.frontendWalletAddress;
            if (!frontendWalletAddress) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            const user = await MongoDBService.getWalletByFrontendAddress(frontendWalletAddress);
            if (!user) {
                res.status(404).json({ error: 'User wallet not found' });
                return;
            }
            const balances = await TokenService.getDCATokenBalances(user.walletAddress);
            res.json({
                success: true,
                data: balances,
            });
        }
        catch (error) {
            console.error('Error getting user token balances:', error);
            res.status(500).json({
                error: 'Failed to get token balances',
                message: error.message
            });
        }
    }
    static async getSystemStatus(req, res) {
        try {
            const executorStatus = await DCAExecutorService.getStatus();
            const priceMonitorStatus = PriceMonitorService.getMonitoringStatus();
            res.json({
                success: true,
                data: {
                    executor: executorStatus,
                    priceMonitor: priceMonitorStatus,
                    timestamp: new Date().toISOString(),
                },
            });
        }
        catch (error) {
            console.error('Error getting system status:', error);
            res.status(500).json({
                error: 'Failed to get system status',
                message: error.message
            });
        }
    }
    static async forceExecuteOrders(req, res) {
        try {
            const result = await DCAExecutorService.forceExecuteOrders();
            res.json({
                success: true,
                message: 'Force execution completed',
                data: result,
            });
        }
        catch (error) {
            console.error('Error force executing orders:', error);
            res.status(500).json({
                error: 'Failed to force execute orders',
                message: error.message
            });
        }
    }
    static async simulatePriceCheck(req, res) {
        try {
            const { price } = req.body;
            if (!price || typeof price !== 'number') {
                res.status(400).json({ error: 'Valid price number is required' });
                return;
            }
            const result = await DCAExecutorService.simulateExecution(price);
            res.json({
                success: true,
                message: 'Price simulation completed',
                data: result,
            });
        }
        catch (error) {
            console.error('Error simulating price check:', error);
            res.status(500).json({
                error: 'Failed to simulate price check',
                message: error.message
            });
        }
    }
    static async startExecutor(req, res) {
        try {
            const config = req.body;
            const started = DCAExecutorService.startExecutor(config);
            if (started) {
                res.json({
                    success: true,
                    message: 'DCA Executor started successfully',
                });
            }
            else {
                res.status(400).json({
                    error: 'Failed to start DCA Executor (may already be running)',
                });
            }
        }
        catch (error) {
            console.error('Error starting DCA executor:', error);
            res.status(500).json({
                error: 'Failed to start DCA executor',
                message: error.message
            });
        }
    }
    static async stopExecutor(req, res) {
        try {
            const stopped = DCAExecutorService.stopExecutor();
            if (stopped) {
                res.json({
                    success: true,
                    message: 'DCA Executor stopped successfully',
                });
            }
            else {
                res.status(400).json({
                    error: 'Failed to stop DCA Executor (may not be running)',
                });
            }
        }
        catch (error) {
            console.error('Error stopping DCA executor:', error);
            res.status(500).json({
                error: 'Failed to stop DCA executor',
                message: error.message
            });
        }
    }
    static async getExecutorConfig(req, res) {
        try {
            const config = DCAExecutorService.getConfig();
            res.json({
                success: true,
                data: config,
            });
        }
        catch (error) {
            console.error('Error getting executor config:', error);
            res.status(500).json({
                error: 'Failed to get executor config',
                message: error.message
            });
        }
    }
    static async updateExecutorConfig(req, res) {
        try {
            const newConfig = req.body;
            const updated = DCAExecutorService.updateConfig(newConfig);
            if (updated) {
                res.json({
                    success: true,
                    message: 'Executor configuration updated successfully',
                    data: DCAExecutorService.getConfig(),
                });
            }
            else {
                res.status(400).json({
                    error: 'Failed to update executor configuration',
                });
            }
        }
        catch (error) {
            console.error('Error updating executor config:', error);
            res.status(500).json({
                error: 'Failed to update executor config',
                message: error.message
            });
        }
    }
}
//# sourceMappingURL=dca.js.map