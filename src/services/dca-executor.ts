import { PriceMonitorService } from './price-monitor.js';
import { DCAService } from './dca.js';
import { PriceAnalyticsService } from './price-analytics.js';
import { PRICE_CONFIG } from '../constants/tokens.js';

export interface DCAExecutorConfig {
  monitoringIntervalSeconds: number;
  maxConcurrentExecutions: number;
  enableAutoRestart: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface DCAExecutorStatus {
  isRunning: boolean;
  startTime: Date;
  uptime: string;
  priceMonitorStatus: any;
  executionStats: {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
  };
  systemHealth: {
    priceDataAvailable: boolean;
    databaseConnected: boolean;
    lastError?: string;
  };
}

export class DCAExecutorService {
  private static isRunning = false;
  private static startTime = new Date();
  private static executionStats = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    totalExecutionTime: 0,
  };
  private static config: DCAExecutorConfig = {
    monitoringIntervalSeconds: PRICE_CONFIG.UPDATE_INTERVAL_SECONDS,
    maxConcurrentExecutions: 5,
    enableAutoRestart: true,
    logLevel: 'info',
  };
  private static healthCheckInterval: NodeJS.Timeout | null = null;
  private static lastError: string | undefined;

  /**
   * Start the DCA execution engine
   */
  static startExecutor(customConfig?: Partial<DCAExecutorConfig>): boolean {
    try {
      if (this.isRunning) {
        this.log('warn', 'DCA Executor is already running');
        return false;
      }

      // Apply custom configuration
      if (customConfig) {
        this.config = { ...this.config, ...customConfig };
      }

      this.log('info', 'Starting DCA Execution Engine...');
      this.log('info', `Configuration: ${JSON.stringify(this.config, null, 2)}`);

      // Reset stats
      this.startTime = new Date();
      this.executionStats = {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        totalExecutionTime: 0,
      };

      // Start price monitoring
      PriceMonitorService.startMonitoring(this.config.monitoringIntervalSeconds);

      // Start health monitoring
      this.startHealthMonitoring();

      this.isRunning = true;
      this.log('info', '✅ DCA Execution Engine started successfully');

      return true;
    } catch (error) {
      this.log('error', `Failed to start DCA Executor: ${error}`);
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      return false;
    }
  }

  /**
   * Stop the DCA execution engine
   */
  static stopExecutor(): boolean {
    try {
      if (!this.isRunning) {
        this.log('warn', 'DCA Executor is not running');
        return false;
      }

      this.log('info', 'Stopping DCA Execution Engine...');

      // Stop price monitoring
      PriceMonitorService.stopMonitoring();

      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      this.isRunning = false;
      this.log('info', '✅ DCA Execution Engine stopped successfully');

      return true;
    } catch (error) {
      this.log('error', `Failed to stop DCA Executor: ${error}`);
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      return false;
    }
  }

  /**
   * Restart the DCA execution engine
   */
  static restartExecutor(): boolean {
    this.log('info', 'Restarting DCA Execution Engine...');
    
    const stopResult = this.stopExecutor();
    if (!stopResult) {
      return false;
    }

    // Wait a moment before restarting
    setTimeout(() => {
      this.startExecutor();
    }, 2000);

    return true;
  }

  /**
   * Get current executor status
   */
  static async getStatus(): Promise<DCAExecutorStatus> {
    const uptime = this.isRunning 
      ? this.formatUptime(Date.now() - this.startTime.getTime())
      : '0s';

    const avgExecutionTime = this.executionStats.totalExecutions > 0
      ? this.executionStats.totalExecutionTime / this.executionStats.totalExecutions
      : 0;

    // Check system health
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

  /**
   * Force execute all eligible orders
   */
  static async forceExecuteOrders(): Promise<{
    success: boolean;
    ordersProcessed: number;
    ordersExecuted: number;
    errors: string[];
  }> {
    try {
      this.log('info', 'Force executing eligible DCA orders...');
      
      const startTime = Date.now();
      const result = await PriceMonitorService.forcePriceCheck();
      const executionTime = Date.now() - startTime;

      // Update stats
      this.executionStats.totalExecutions++;
      this.executionStats.totalExecutionTime += executionTime;

      if (result.success) {
        this.executionStats.successfulExecutions++;
      } else {
        this.executionStats.failedExecutions++;
      }

      return {
        success: result.success,
        ordersProcessed: result.ordersChecked,
        ordersExecuted: result.ordersExecuted,
        errors: result.errors ? [result.errors] : [],
      };
    } catch (error) {
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

  /**
   * Get execution statistics
   */
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

  /**
   * Update executor configuration
   */
  static updateConfig(newConfig: Partial<DCAExecutorConfig>): boolean {
    try {
      const oldConfig = { ...this.config };
      this.config = { ...this.config, ...newConfig };
      
      this.log('info', `Configuration updated from ${JSON.stringify(oldConfig)} to ${JSON.stringify(this.config)}`);

      // If monitoring interval changed and executor is running, restart monitoring
      if (newConfig.monitoringIntervalSeconds && this.isRunning) {
        PriceMonitorService.stopMonitoring();
        PriceMonitorService.startMonitoring(this.config.monitoringIntervalSeconds);
      }

      return true;
    } catch (error) {
      this.log('error', `Failed to update config: ${error}`);
      return false;
    }
  }

  /**
   * Get current configuration
   */
  static getConfig(): DCAExecutorConfig {
    return { ...this.config };
  }

  /**
   * Simulate DCA execution with mock price
   */
  static async simulateExecution(mockPrice: number): Promise<{
    triggeredOrders: number;
    executedOrders: number;
    errors: string[];
    simulation: true;
  }> {
    try {
      this.log('info', `Simulating DCA execution with price: $${mockPrice}`);
      
      const result = await PriceMonitorService.simulatePriceCheck(mockPrice);
      
      return {
        ...result,
        simulation: true,
      };
    } catch (error) {
      this.log('error', `Error in simulation: ${error}`);
      return {
        triggeredOrders: 0,
        executedOrders: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        simulation: true,
      };
    }
  }

  /**
   * Private helper methods
   */
  private static async startHealthMonitoring(): Promise<void> {
    // Perform health checks every 5 minutes
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
      } catch (error) {
        this.log('error', `Health check failed: ${error}`);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  private static async checkSystemHealth() {
    let priceDataAvailable = false;
    let databaseConnected = false;

    try {
      // Check price data availability
      const marketData = await PriceAnalyticsService.getMarketData();
      priceDataAvailable = !!(marketData && marketData.current_price > 0);
    } catch (error) {
      this.log('debug', `Price data check failed: ${error}`);
    }

    try {
      // Check database connectivity by trying to count orders
      await DCAService.getUserDCAOrders('health-check', undefined, 1);
      databaseConnected = true;
    } catch (error) {
      this.log('debug', `Database check failed: ${error}`);
    }

    return {
      priceDataAvailable,
      databaseConnected,
      lastError: this.lastError,
    };
  }

  private static formatUptime(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private static log(level: string, message: string): void {
    const levels = ['debug', 'info', 'warn', 'error'];
    const configLevel = levels.indexOf(this.config.logLevel);
    const messageLevel = levels.indexOf(level);

    if (messageLevel >= configLevel) {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [DCA-EXECUTOR] [${level.toUpperCase()}]`;
      console.log(`${prefix} ${message}`);
    }
  }

  /**
   * Cleanup and graceful shutdown
   */
  static async gracefulShutdown(): Promise<void> {
    this.log('info', 'Initiating graceful shutdown...');
    
    try {
      // Stop accepting new executions
      this.stopExecutor();
      
      // Wait for any ongoing operations to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      this.log('info', 'Graceful shutdown completed');
    } catch (error) {
      this.log('error', `Error during graceful shutdown: ${error}`);
    }
  }
} 