import { PriceAnalyticsService } from './price-analytics.js';
import { DCAService } from './dca.js';
import { IDCAOrder } from '../models/DCAOrder.js';
import { PRICE_CONFIG } from '../constants/tokens.js';

export interface PriceAlert {
  price: number;
  timestamp: Date;
  change24h: number;
  triggeredOrders: string[];
}

export interface PriceMonitorStatus {
  isRunning: boolean;
  lastCheck: Date;
  lastPrice: number;
  nextCheck: Date;
  monitoredOrders: number;
  totalChecks: number;
  executedOrders: number;
  errors: number;
}

export class PriceMonitorService {
  private static isRunning = false;
  private static lastPrice = 0;
  private static lastCheck = new Date();
  private static totalChecks = 0;
  private static executedOrders = 0;
  private static errors = 0;
  private static monitorInterval: NodeJS.Timeout | null = null;

  /**
   * Start the price monitoring service
   */
  static startMonitoring(intervalSeconds: number = PRICE_CONFIG.UPDATE_INTERVAL_SECONDS): void {
    if (this.isRunning) {
      console.log('Price monitoring is already running');
      return;
    }

    console.log(`Starting price monitoring with ${intervalSeconds}s interval`);
    this.isRunning = true;

    this.monitorInterval = setInterval(async () => {
      await this.checkPriceAndExecuteOrders();
    }, intervalSeconds * 1000);

    // Initial check
    this.checkPriceAndExecuteOrders();
  }

  /**
   * Stop the price monitoring service
   */
  static stopMonitoring(): void {
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

  /**
   * Get current monitoring status
   */
  static getMonitoringStatus(): PriceMonitorStatus {
    return {
      isRunning: this.isRunning,
      lastCheck: this.lastCheck,
      lastPrice: this.lastPrice,
      nextCheck: new Date(Date.now() + PRICE_CONFIG.UPDATE_INTERVAL_SECONDS * 1000),
      monitoredOrders: 0, // Will be updated in real-time
      totalChecks: this.totalChecks,
      executedOrders: this.executedOrders,
      errors: this.errors,
    };
  }

  /**
   * Main monitoring function - checks price and executes eligible orders
   */
  private static async checkPriceAndExecuteOrders(): Promise<void> {
    try {
      this.totalChecks++;
      this.lastCheck = new Date();

      console.log(`Price check #${this.totalChecks} at ${this.lastCheck.toISOString()}`);

      // Get current XFI price
      const currentPrice = await this.getCurrentXFIPrice();
      if (currentPrice <= 0) {
        console.warn('Invalid price received, skipping this check');
        return;
      }

      // Update last price
      const priceChange = this.lastPrice > 0 ? ((currentPrice - this.lastPrice) / this.lastPrice) * 100 : 0;
      this.lastPrice = currentPrice;

      console.log(`Current XFI price: $${currentPrice.toFixed(6)} (${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%)`);

      // Get active orders that might need execution
      const activeOrders = await DCAService.getActiveOrdersForExecution();
      console.log(`Found ${activeOrders.length} active DCA orders to check`);

      if (activeOrders.length === 0) {
        return;
      }

      // Check each order against current price
      // Only execute orders that are ready for execution (price direction is correct)
      const eligibleOrders = activeOrders.filter(order => {
        const isReady = DCAService.isOrderReadyForExecution(order, currentPrice);
        const shouldExecute = DCAService.shouldExecuteOrder(order, currentPrice);
        
        // Only execute if order is ready AND should execute
        return isReady && shouldExecute;
      });

      console.log(`${eligibleOrders.length} orders are eligible for execution`);

      // Execute eligible orders
      for (const order of eligibleOrders) {
        try {
          console.log(`Executing DCA order ${order._id} - ${order.orderType} ${order.fromAmount} when price ${order.triggerCondition} $${order.triggerPrice}`);
          
          const result = await DCAService.executeDCAOrder(order);
          
          if (result.success) {
            this.executedOrders++;
            console.log(`✅ Order ${order._id} executed successfully`);
          } else {
            console.log(`❌ Order ${order._id} execution failed: ${result.error}`);
          }
        } catch (error) {
          console.error(`Error executing order ${order._id}:`, error);
          this.errors++;
        }
      }

      // Clean up expired orders
      const expiredCount = await DCAService.cleanupExpiredOrders();
      if (expiredCount > 0) {
        console.log(`Cleaned up ${expiredCount} expired orders`);
      }

    } catch (error) {
      console.error('Error in price monitoring check:', error);
      this.errors++;
    }
  }

  /**
   * Get current XFI price with fallback and validation
   */
  private static async getCurrentXFIPrice(): Promise<number> {
    try {
      const marketData = await PriceAnalyticsService.getMarketData();
      
      if (!marketData.current_price || marketData.current_price <= 0) {
        console.warn('Invalid market data price, using fallback');
        return 0.082; // Fallback price
      }

      return marketData.current_price;
    } catch (error) {
      console.error('Error getting current XFI price:', error);
      
      // Return last known price as fallback
      if (this.lastPrice > 0) {
        console.log(`Using last known price: $${this.lastPrice}`);
        return this.lastPrice;
      }
      
      // Ultimate fallback
      return 0.082;
    }
  }

  /**
   * Check specific orders against current price (useful for testing)
   */
  static async checkSpecificOrders(orderIds: string[]): Promise<{ [orderId: string]: boolean }> {
    try {
      const currentPrice = await this.getCurrentXFIPrice();
      const results: { [orderId: string]: boolean } = {};

      for (const orderId of orderIds) {
        const order = await DCAService.getDCAOrderById(orderId);
        if (order && order.status === 'active') {
          results[orderId] = DCAService.shouldExecuteOrder(order, currentPrice);
        } else {
          results[orderId] = false;
        }
      }

      return results;
    } catch (error) {
      console.error('Error checking specific orders:', error);
      return {};
    }
  }

  /**
   * Get orders that would be triggered at a specific price
   */
  static async getOrdersTriggeredAtPrice(targetPrice: number): Promise<IDCAOrder[]> {
    try {
      const activeOrders = await DCAService.getActiveOrdersForExecution();
      
      return activeOrders.filter(order => 
        DCAService.shouldExecuteOrder(order, targetPrice)
      );
    } catch (error) {
      console.error('Error getting orders triggered at price:', error);
      return [];
    }
  }

  /**
   * Simulate price monitoring for testing
   */
  static async simulatePriceCheck(mockPrice: number): Promise<{
    triggeredOrders: number;
    executedOrders: number;
    errors: string[];
  }> {
    try {
      console.log(`Simulating price check with mock price: $${mockPrice}`);
      
      const activeOrders = await DCAService.getActiveOrdersForExecution();
      const eligibleOrders = activeOrders.filter(order => 
        DCAService.shouldExecuteOrder(order, mockPrice)
      );

      console.log(`Simulation: ${eligibleOrders.length} orders would be triggered`);

      const errors: string[] = [];
      let executedCount = 0;

      // Note: This is simulation only - doesn't actually execute orders
      for (const order of eligibleOrders) {
        try {
          console.log(`Would execute: ${order.orderType} order ${order._id}`);
          executedCount++;
        } catch (error) {
          errors.push(`Order ${order._id}: ${error}`);
        }
      }

      return {
        triggeredOrders: eligibleOrders.length,
        executedOrders: executedCount,
        errors,
      };
    } catch (error) {
      console.error('Error in price simulation:', error);
      return {
        triggeredOrders: 0,
        executedOrders: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Get price alerts for significant price movements
   */
  static async checkForPriceAlerts(thresholdPercentage: number = 5): Promise<PriceAlert | null> {
    try {
      const currentPrice = await this.getCurrentXFIPrice();
      
      if (this.lastPrice === 0) {
        this.lastPrice = currentPrice;
        return null;
      }

      const priceChangePercentage = Math.abs((currentPrice - this.lastPrice) / this.lastPrice) * 100;
      
      if (priceChangePercentage >= thresholdPercentage) {
        // Get orders that would be triggered by this price movement
        const triggeredOrders = await this.getOrdersTriggeredAtPrice(currentPrice);
        
        return {
          price: currentPrice,
          timestamp: new Date(),
          change24h: priceChangePercentage,
          triggeredOrders: triggeredOrders.map(order => order._id.toString()),
        };
      }

      return null;
    } catch (error) {
      console.error('Error checking for price alerts:', error);
      return null;
    }
  }

  /**
   * Force a single price check (useful for manual triggers)
   */
  static async forcePriceCheck(): Promise<{
    success: boolean;
    price: number;
    ordersChecked: number;
    ordersExecuted: number;
    errors?: string;
  }> {
    try {
      const currentPrice = await this.getCurrentXFIPrice();
      const activeOrders = await DCAService.getActiveOrdersForExecution();
      const eligibleOrders = activeOrders.filter(order => 
        DCAService.shouldExecuteOrder(order, currentPrice)
      );

      let executedCount = 0;
      
      for (const order of eligibleOrders) {
        try {
          const result = await DCAService.executeDCAOrder(order);
          if (result.success) {
            executedCount++;
          }
        } catch (error) {
          console.error(`Error executing order ${order._id}:`, error);
        }
      }

      return {
        success: true,
        price: currentPrice,
        ordersChecked: activeOrders.length,
        ordersExecuted: executedCount,
      };
    } catch (error) {
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

  /**
   * Get monitoring statistics
   */
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

  /**
   * Reset monitoring statistics
   */
  static resetStatistics(): void {
    this.totalChecks = 0;
    this.executedOrders = 0;
    this.errors = 0;
    console.log('Price monitoring statistics reset');
  }
} 