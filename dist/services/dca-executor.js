import { PriceMonitorService } from './price-monitor.js';
import { DCAService } from './dca.js';
import { PriceAnalyticsService } from './price-analytics.js';
import { PRICE_CONFIG } from '../constants/tokens.js';
export class DCAExecutorService {
    static isRunning = false;
    static startTime = new Date();
    static executionStats = {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        totalExecutionTime: 0,
    };
    static config = {
        monitoringIntervalSeconds: PRICE_CONFIG.UPDATE_INTERVAL_SECONDS,
        maxConcurrentExecutions: 5,
        enableAutoRestart: true,
        logLevel: 'info',
    };
    static healthCheckInterval = null;
    static lastError;
    static startExecutor(customConfig) {
        try {
            if (this.isRunning) {
                this.log('warn', 'DCA Executor is already running');
                return false;
            }
            if (customConfig) {
                this.config = { ...this.config, ...customConfig };
            }
            this.log('info', 'Starting DCA Execution Engine...');
            this.log('info', `Configuration: ${JSON.stringify(this.config, null, 2)}`);
            this.startTime = new Date();
            this.executionStats = {
                totalExecutions: 0,
                successfulExecutions: 0,
                failedExecutions: 0,
                totalExecutionTime: 0,
            };
            PriceMonitorService.startMonitoring(this.config.monitoringIntervalSeconds);
            this.startHealthMonitoring();
            this.isRunning = true;
            this.log('info', '✅ DCA Execution Engine started successfully');
            return true;
        }
        catch (error) {
            this.log('error', `Failed to start DCA Executor: ${error}`);
            this.lastError = error instanceof Error ? error.message : 'Unknown error';
            return false;
        }
    }
    static stopExecutor() {
        try {
            if (!this.isRunning) {
                this.log('warn', 'DCA Executor is not running');
                return false;
            }
            this.log('info', 'Stopping DCA Execution Engine...');
            PriceMonitorService.stopMonitoring();
            if (this.healthCheckInterval) {
                clearInterval(this.healthCheckInterval);
                this.healthCheckInterval = null;
            }
            this.isRunning = false;
            this.log('info', '✅ DCA Execution Engine stopped successfully');
            return true;
        }
        catch (error) {
            this.log('error', `Failed to stop DCA Executor: ${error}`);
            this.lastError = error instanceof Error ? error.message : 'Unknown error';
            return false;
        }
    }
    static restartExecutor() {
        this.log('info', 'Restarting DCA Execution Engine...');
        const stopResult = this.stopExecutor();
        if (!stopResult) {
            return false;
        }
        setTimeout(() => {
            this.startExecutor();
        }, 2000);
        return true;
    }
    static async getStatus() {
        const uptime = this.isRunning
            ? this.formatUptime(Date.now() - this.startTime.getTime())
            : '0s';
        const avgExecutionTime = this.executionStats.totalExecutions > 0
            ? this.executionStats.totalExecutionTime / this.executionStats.totalExecutions
            : 0;
        const systemHealth = await this.checkSystemHealth();
        return {
            isRunning: this.isRunning,
            startTime: this.startTime,
            uptime,
            priceMonitorStatus: PriceMonitorService.getMonitoringStatus(),
            executionStats: {
                totalExecutions: this.executionStats.totalExecutions,
                successfulExecutions: this.executionStats.successfulExecutions,
                failedExecutions: this.executionStats.failedExecutions,
                averageExecutionTime: Math.round(avgExecutionTime),
            },
            systemHealth,
        };
    }
    static async forceExecuteOrders() {
        try {
            this.log('info', 'Force executing eligible DCA orders...');
            const startTime = Date.now();
            const result = await PriceMonitorService.forcePriceCheck();
            const executionTime = Date.now() - startTime;
            this.executionStats.totalExecutions++;
            this.executionStats.totalExecutionTime += executionTime;
            if (result.success) {
                this.executionStats.successfulExecutions++;
            }
            else {
                this.executionStats.failedExecutions++;
            }
            return {
                success: result.success,
                ordersProcessed: result.ordersChecked,
                ordersExecuted: result.ordersExecuted,
                errors: result.errors ? [result.errors] : [],
            };
        }
        catch (error) {
            this.log('error', `Error in force execution: ${error}`);
            this.executionStats.totalExecutions++;
            this.executionStats.failedExecutions++;
            return {
                success: false,
                ordersProcessed: 0,
                ordersExecuted: 0,
                errors: [error instanceof Error ? error.message : 'Unknown error'],
            };
        }
    }
    static getExecutionStatistics() {
        const successRate = this.executionStats.totalExecutions > 0
            ? (this.executionStats.successfulExecutions / this.executionStats.totalExecutions) * 100
            : 0;
        const avgExecutionTime = this.executionStats.totalExecutions > 0
            ? this.executionStats.totalExecutionTime / this.executionStats.totalExecutions
            : 0;
        return {
            ...this.executionStats,
            successRate: Math.round(successRate * 100) / 100,
            averageExecutionTime: Math.round(avgExecutionTime),
            uptime: this.isRunning ? this.formatUptime(Date.now() - this.startTime.getTime()) : '0s',
        };
    }
    static updateConfig(newConfig) {
        try {
            const oldConfig = { ...this.config };
            this.config = { ...this.config, ...newConfig };
            this.log('info', `Configuration updated from ${JSON.stringify(oldConfig)} to ${JSON.stringify(this.config)}`);
            if (newConfig.monitoringIntervalSeconds && this.isRunning) {
                PriceMonitorService.stopMonitoring();
                PriceMonitorService.startMonitoring(this.config.monitoringIntervalSeconds);
            }
            return true;
        }
        catch (error) {
            this.log('error', `Failed to update config: ${error}`);
            return false;
        }
    }
    static getConfig() {
        return { ...this.config };
    }
    static async simulateExecution(mockPrice) {
        try {
            this.log('info', `Simulating DCA execution with price: $${mockPrice}`);
            const result = await PriceMonitorService.simulatePriceCheck(mockPrice);
            return {
                ...result,
                simulation: true,
            };
        }
        catch (error) {
            this.log('error', `Error in simulation: ${error}`);
            return {
                triggeredOrders: 0,
                executedOrders: 0,
                errors: [error instanceof Error ? error.message : 'Unknown error'],
                simulation: true,
            };
        }
    }
    static async startHealthMonitoring() {
        this.healthCheckInterval = setInterval(async () => {
            try {
                const health = await this.checkSystemHealth();
                if (!health.priceDataAvailable) {
                    this.log('warn', 'Price data unavailable - DCA execution may be impacted');
                }
                if (!health.databaseConnected) {
                    this.log('error', 'Database connection lost - attempting to reconnect...');
                    if (this.config.enableAutoRestart) {
                        this.log('info', 'Auto-restart enabled, restarting executor...');
                        this.restartExecutor();
                    }
                }
            }
            catch (error) {
                this.log('error', `Health check failed: ${error}`);
            }
        }, 5 * 60 * 1000);
    }
    static async checkSystemHealth() {
        let priceDataAvailable = false;
        let databaseConnected = false;
        try {
            const marketData = await PriceAnalyticsService.getMarketData();
            priceDataAvailable = !!(marketData && marketData.current_price > 0);
        }
        catch (error) {
            this.log('debug', `Price data check failed: ${error}`);
        }
        try {
            await DCAService.getUserDCAOrders('health-check', undefined, 1);
            databaseConnected = true;
        }
        catch (error) {
            this.log('debug', `Database check failed: ${error}`);
        }
        return {
            priceDataAvailable,
            databaseConnected,
            lastError: this.lastError,
        };
    }
    static formatUptime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        if (days > 0) {
            return `${days}d ${hours % 24}h ${minutes % 60}m`;
        }
        else if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        }
        else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        else {
            return `${seconds}s`;
        }
    }
    static log(level, message) {
        const levels = ['debug', 'info', 'warn', 'error'];
        const configLevel = levels.indexOf(this.config.logLevel);
        const messageLevel = levels.indexOf(level);
        if (messageLevel >= configLevel) {
            const timestamp = new Date().toISOString();
            const prefix = `[${timestamp}] [DCA-EXECUTOR] [${level.toUpperCase()}]`;
            console.log(`${prefix} ${message}`);
        }
    }
    static async gracefulShutdown() {
        this.log('info', 'Initiating graceful shutdown...');
        try {
            this.stopExecutor();
            await new Promise(resolve => setTimeout(resolve, 2000));
            this.log('info', 'Graceful shutdown completed');
        }
        catch (error) {
            this.log('error', `Error during graceful shutdown: ${error}`);
        }
    }
}
//# sourceMappingURL=dca-executor.js.map