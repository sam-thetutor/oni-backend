import { PriceAnalyticsService } from './price-analytics.js';
import { DCAService } from './dca.js';
import { PRICE_CONFIG } from '../constants/tokens.js';
export class PriceMonitorService {
    static isRunning = false;
    static lastPrice = 0;
    static lastCheck = new Date();
    static totalChecks = 0;
    static executedOrders = 0;
    static errors = 0;
    static monitorInterval = null;
    static startMonitoring(intervalSeconds = PRICE_CONFIG.UPDATE_INTERVAL_SECONDS) {
        if (this.isRunning) {
            console.log('Price monitoring is already running');
            return;
        }
        console.log(`Starting price monitoring with ${intervalSeconds}s interval`);
        this.isRunning = true;
        this.monitorInterval = setInterval(async () => {
            await this.checkPriceAndExecuteOrders();
        }, intervalSeconds * 1000);
        this.checkPriceAndExecuteOrders();
    }
    static stopMonitoring() {
        if (!this.isRunning) {
            console.log('Price monitoring is not running');
            return;
        }
        console.log('Stopping price monitoring');
        this.isRunning = false;
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
    }
    static getMonitoringStatus() {
        return {
            isRunning: this.isRunning,
            lastCheck: this.lastCheck,
            lastPrice: this.lastPrice,
            nextCheck: new Date(Date.now() + PRICE_CONFIG.UPDATE_INTERVAL_SECONDS * 1000),
            monitoredOrders: 0,
            totalChecks: this.totalChecks,
            executedOrders: this.executedOrders,
            errors: this.errors,
        };
    }
    static async checkPriceAndExecuteOrders() {
        try {
            this.totalChecks++;
            this.lastCheck = new Date();
            console.log(`Price check #${this.totalChecks} at ${this.lastCheck.toISOString()}`);
            const currentPrice = await this.getCurrentXFIPrice();
            if (currentPrice <= 0) {
                console.warn('Invalid price received, skipping this check');
                return;
            }
            const priceChange = this.lastPrice > 0 ? ((currentPrice - this.lastPrice) / this.lastPrice) * 100 : 0;
            this.lastPrice = currentPrice;
            console.log(`Current XFI price: $${currentPrice.toFixed(6)} (${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%)`);
            const activeOrders = await DCAService.getActiveOrdersForExecution();
            console.log(`Found ${activeOrders.length} active DCA orders to check`);
            if (activeOrders.length === 0) {
                return;
            }
            const eligibleOrders = activeOrders.filter(order => {
                const isReady = DCAService.isOrderReadyForExecution(order, currentPrice);
                const shouldExecute = DCAService.shouldExecuteOrder(order, currentPrice);
                return isReady && shouldExecute;
            });
            console.log(`${eligibleOrders.length} orders are eligible for execution`);
            for (const order of eligibleOrders) {
                try {
                    console.log(`Executing DCA order ${order._id} - ${order.orderType} ${order.fromAmount} when price ${order.triggerCondition} $${order.triggerPrice}`);
                    const result = await DCAService.executeDCAOrder(order);
                    if (result.success) {
                        this.executedOrders++;
                        console.log(`✅ Order ${order._id} executed successfully`);
                    }
                    else {
                        console.log(`❌ Order ${order._id} execution failed: ${result.error}`);
                    }
                }
                catch (error) {
                    console.error(`Error executing order ${order._id}:`, error);
                    this.errors++;
                }
            }
            const expiredCount = await DCAService.cleanupExpiredOrders();
            if (expiredCount > 0) {
                console.log(`Cleaned up ${expiredCount} expired orders`);
            }
        }
        catch (error) {
            console.error('Error in price monitoring check:', error);
            this.errors++;
        }
    }
    static async getCurrentXFIPrice() {
        try {
            const marketData = await PriceAnalyticsService.getMarketData();
            if (!marketData.current_price || marketData.current_price <= 0) {
                console.warn('Invalid market data price, using fallback');
                return 0.082;
            }
            return marketData.current_price;
        }
        catch (error) {
            console.error('Error getting current XFI price:', error);
            if (this.lastPrice > 0) {
                console.log(`Using last known price: $${this.lastPrice}`);
                return this.lastPrice;
            }
            return 0.082;
        }
    }
    static async checkSpecificOrders(orderIds) {
        try {
            const currentPrice = await this.getCurrentXFIPrice();
            const results = {};
            for (const orderId of orderIds) {
                const order = await DCAService.getDCAOrderById(orderId);
                if (order && order.status === 'active') {
                    results[orderId] = DCAService.shouldExecuteOrder(order, currentPrice);
                }
                else {
                    results[orderId] = false;
                }
            }
            return results;
        }
        catch (error) {
            console.error('Error checking specific orders:', error);
            return {};
        }
    }
    static async getOrdersTriggeredAtPrice(targetPrice) {
        try {
            const activeOrders = await DCAService.getActiveOrdersForExecution();
            return activeOrders.filter(order => DCAService.shouldExecuteOrder(order, targetPrice));
        }
        catch (error) {
            console.error('Error getting orders triggered at price:', error);
            return [];
        }
    }
    static async simulatePriceCheck(mockPrice) {
        try {
            console.log(`Simulating price check with mock price: $${mockPrice}`);
            const activeOrders = await DCAService.getActiveOrdersForExecution();
            const eligibleOrders = activeOrders.filter(order => DCAService.shouldExecuteOrder(order, mockPrice));
            console.log(`Simulation: ${eligibleOrders.length} orders would be triggered`);
            const errors = [];
            let executedCount = 0;
            for (const order of eligibleOrders) {
                try {
                    console.log(`Would execute: ${order.orderType} order ${order._id}`);
                    executedCount++;
                }
                catch (error) {
                    errors.push(`Order ${order._id}: ${error}`);
                }
            }
            return {
                triggeredOrders: eligibleOrders.length,
                executedOrders: executedCount,
                errors,
            };
        }
        catch (error) {
            console.error('Error in price simulation:', error);
            return {
                triggeredOrders: 0,
                executedOrders: 0,
                errors: [error instanceof Error ? error.message : 'Unknown error'],
            };
        }
    }
    static async checkForPriceAlerts(thresholdPercentage = 5) {
        try {
            const currentPrice = await this.getCurrentXFIPrice();
            if (this.lastPrice === 0) {
                this.lastPrice = currentPrice;
                return null;
            }
            const priceChangePercentage = Math.abs((currentPrice - this.lastPrice) / this.lastPrice) * 100;
            if (priceChangePercentage >= thresholdPercentage) {
                const triggeredOrders = await this.getOrdersTriggeredAtPrice(currentPrice);
                return {
                    price: currentPrice,
                    timestamp: new Date(),
                    change24h: priceChangePercentage,
                    triggeredOrders: triggeredOrders.map(order => order._id.toString()),
                };
            }
            return null;
        }
        catch (error) {
            console.error('Error checking for price alerts:', error);
            return null;
        }
    }
    static async forcePriceCheck() {
        try {
            const currentPrice = await this.getCurrentXFIPrice();
            const activeOrders = await DCAService.getActiveOrdersForExecution();
            const eligibleOrders = activeOrders.filter(order => DCAService.shouldExecuteOrder(order, currentPrice));
            let executedCount = 0;
            for (const order of eligibleOrders) {
                try {
                    const result = await DCAService.executeDCAOrder(order);
                    if (result.success) {
                        executedCount++;
                    }
                }
                catch (error) {
                    console.error(`Error executing order ${order._id}:`, error);
                }
            }
            return {
                success: true,
                price: currentPrice,
                ordersChecked: activeOrders.length,
                ordersExecuted: executedCount,
            };
        }
        catch (error) {
            console.error('Error in forced price check:', error);
            return {
                success: false,
                price: 0,
                ordersChecked: 0,
                ordersExecuted: 0,
                errors: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    static getStatistics() {
        return {
            totalChecks: this.totalChecks,
            executedOrders: this.executedOrders,
            errors: this.errors,
            successRate: this.totalChecks > 0 ? ((this.totalChecks - this.errors) / this.totalChecks) * 100 : 0,
            lastPrice: this.lastPrice,
            lastCheck: this.lastCheck,
            isRunning: this.isRunning,
        };
    }
    static resetStatistics() {
        this.totalChecks = 0;
        this.executedOrders = 0;
        this.errors = 0;
        console.log('Price monitoring statistics reset');
    }
}
//# sourceMappingURL=price-monitor.js.map