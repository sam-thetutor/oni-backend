import { DCAOrder, IDCAOrder } from '../models/DCAOrder.js';
import { TokenService } from './tokens.js';
import { PriceAnalyticsService } from './price-analytics.js';
import { IUser } from '../models/User.js';
import { WalletService } from './wallet.js';
import { 
  TOKEN_ADDRESSES, 
  TOKEN_METADATA, 
  DCA_LIMITS, 
  validateTokenAmount, 
  validateTriggerPrice, 
  validateSlippage 
} from '../constants/tokens.js';

export interface CreateDCAOrderParams {
  userId: string;
  walletAddress: string;
  orderType: 'swap';
  fromToken: 'USDC' | 'XFI';
  toToken: 'USDC' | 'XFI';
  fromAmount: string;
  triggerPrice: number;
  triggerCondition: 'above' | 'below';
  maxSlippage?: number;
  expiresAt?: Date;
}

export interface DCAOrderSummary {
  id: string;
  orderType: 'swap';
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAmountFormatted: string;
  triggerPrice: number;
  triggerCondition: 'above' | 'below';
  status: string;
  createdAt: Date;
  expiresAt?: Date;
  estimatedReceiveAmount?: string;
}

export interface DCAExecutionContext {
  order: IDCAOrder;
  currentPrice: number;
  user: IUser;
}

export class DCAService {
  /**
   * Create a new DCA order
   */
  static async createDCAOrder(params: CreateDCAOrderParams): Promise<IDCAOrder> {
    try {
      // Validate parameters
      const validation = await this.validateDCAOrderParams(params);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Check user's existing orders limit
      const existingOrders = await DCAOrder.find({
        userId: params.userId,
        status: 'active'
      });

      if (existingOrders.length >= DCA_LIMITS.MAX_ORDERS_PER_USER) {
        throw new Error(`Maximum ${DCA_LIMITS.MAX_ORDERS_PER_USER} active orders allowed per user`);
      }

      // Use provided tokens directly
      const fromToken = params.fromToken;
      const toToken = params.toToken;

      // Set expiration if not provided (default 30 days)
      const expiresAt = params.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      // Create DCA order
      const dcaOrder = new DCAOrder({
        userId: params.userId,
        walletAddress: params.walletAddress,
        orderType: params.orderType,
        fromToken,
        toToken,
        fromAmount: TokenService.parseTokenAmount(
          params.fromAmount,
          TOKEN_METADATA[fromToken].decimals
        ),
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
    } catch (error) {
      console.error('Error creating DCA order:', error);
      throw error;
    }
  }

  /**
   * Get DCA orders for a user
   */
  static async getUserDCAOrders(
    userId: string,
    status?: string,
    limit: number = 50
  ): Promise<DCAOrderSummary[]> {
    try {
      const query: any = { userId };
      if (status) {
        query.status = status;
      }

      const orders = await DCAOrder.find(query)
        .sort({ createdAt: -1 })
        .limit(limit);

      return orders.map(order => this.formatDCAOrderSummary(order));
    } catch (error) {
      console.error('Error getting user DCA orders:', error);
      throw new Error('Failed to get DCA orders');
    }
  }

  /**
   * Get active DCA orders ready for execution
   */
  static async getActiveOrdersForExecution(): Promise<IDCAOrder[]> {
    try {
      const now = new Date();
      
      return await DCAOrder.find({
        status: 'active',
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: now } }
        ],
        retryCount: { $lt: 3 } // Don't include orders that have failed too many times
      }).sort({ createdAt: 1 });
    } catch (error) {
      console.error('Error getting active orders for execution:', error);
      return [];
    }
  }

  /**
   * Check if DCA order should be executed based on current price
   * Only executes if price has moved in the correct direction to reach the trigger
   */
  static shouldExecuteOrder(order: IDCAOrder, currentPrice: number): boolean {
    const { triggerPrice, triggerCondition } = order;
    
    if (triggerCondition === 'above') {
      // For "above" trigger: only execute if current price has moved UP to reach or exceed trigger
      // This means the price was previously below the trigger and has now reached it
      return currentPrice >= triggerPrice;
    } else if (triggerCondition === 'below') {
      // For "below" trigger: only execute if current price has moved DOWN to reach or go below trigger
      // This means the price was previously above the trigger and has now reached it
      return currentPrice <= triggerPrice;
    }
    
    return false;
  }

  /**
   * Check if DCA order is ready for execution (price direction is correct)
   * This prevents immediate execution when order is created
   */
  static isOrderReadyForExecution(order: IDCAOrder, currentPrice: number): boolean {
    const { triggerPrice, triggerCondition } = order;
    
    if (triggerCondition === 'above') {
      // For "above" trigger: order is ready if current price is BELOW trigger (needs to go up)
      return currentPrice < triggerPrice;
    } else if (triggerCondition === 'below') {
      // For "below" trigger: order is ready if current price is ABOVE trigger (needs to go down)
      return currentPrice > triggerPrice;
    }
    
    return false;
  }

  /**
   * Execute a DCA order
   * Note: Swap functionality has been removed - this is a placeholder
   */
  static async executeDCAOrder(order: IDCAOrder): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`Executing DCA order ${order._id}`);

      // Get user data
      const user = await WalletService.getWalletByAddress(order.walletAddress);
      if (!user) {
        throw new Error('User not found');
      }

      // Get current price to double-check
      const currentPrice = await PriceAnalyticsService.getMarketData().then(data => data.current_price);
      
      if (!this.shouldExecuteOrder(order, currentPrice)) {
        throw new Error('Order no longer meets execution criteria');
      }

      // TODO: Implement new swap functionality
      console.log(`DCA order ${order._id} ready for execution - swap functionality needs to be implemented`);
      
      // For now, mark as failed since swap service is not available
      order.status = 'failed';
      order.failureReason = 'Swap functionality temporarily unavailable';
      order.retryCount += 1;
      
      await order.save();
      
      return {
        success: false,
        error: 'Swap functionality temporarily unavailable',
      };
    } catch (error: any) {
      console.error(`Error executing DCA order ${order._id}:`, error);
      
      // Update order with failure
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

  /**
   * Cancel a DCA order
   */
  static async cancelDCAOrder(orderId: string, userId: string): Promise<boolean> {
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
    } catch (error) {
      console.error('Error cancelling DCA order:', error);
      throw error;
    }
  }

  /**
   * Permanently delete a DCA order
   */
  static async deleteDCAOrder(userId: string, orderId: string): Promise<IDCAOrder | null> {
    try {
      const order = await DCAOrder.findOneAndDelete({ _id: orderId, userId });

      if (!order) {
        return null;
      }

      console.log(`DCA order ${orderId} permanently deleted for user ${userId}`);
      return order;
    } catch (error) {
      console.error('Error deleting DCA order:', error);
      return null;
    }
  }

  /**
   * Update DCA order parameters
   */
  static async updateDCAOrder(
    orderId: string,
    userId: string,
    updates: Partial<{
      triggerPrice: number;
      triggerCondition: 'above' | 'below';
      maxSlippage: number;
      expiresAt: Date;
    }>
  ): Promise<IDCAOrder> {
    try {
      const order = await DCAOrder.findOne({
        _id: orderId,
        userId,
        status: 'active'
      });

      if (!order) {
        throw new Error('Order not found or not updatable');
      }

      // Validate updates
      if (updates.triggerPrice && !validateTriggerPrice(updates.triggerPrice)) {
        throw new Error('Invalid trigger price');
      }
      
      if (updates.maxSlippage && !validateSlippage(updates.maxSlippage)) {
        throw new Error('Invalid slippage value');
      }

      // Apply updates
      Object.assign(order, updates);
      await order.save();
      
      
      return order;
    } catch (error) {
      console.error('Error updating DCA order:', error);
      throw error;
    }
  }

  /**
   * Get DCA order by ID
   */
  static async getDCAOrderById(orderId: string, userId?: string): Promise<IDCAOrder | null> {
    try {
      const query: any = { _id: orderId };
      if (userId) {
        query.userId = userId;
      }

      return await DCAOrder.findOne(query);
    } catch (error) {
      console.error('Error getting DCA order by ID:', error);
      return null;
    }
  }

  /**
   * Clean up expired orders
   */
  static async cleanupExpiredOrders(): Promise<number> {
    try {
      const now = new Date();
      
      const result = await DCAOrder.updateMany(
        {
          status: 'active',
          expiresAt: { $lt: now }
        },
        {
          $set: { status: 'expired' }
        }
      );

      console.log(`Marked ${result.modifiedCount} orders as expired`);
      return result.modifiedCount;
    } catch (error) {
      console.error('Error cleaning up expired orders:', error);
      return 0;
    }
  }

  /**
   * Get DCA statistics for a user
   */
  static async getUserDCAStats(userId: string) {
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
        summary[stat._id as keyof typeof summary] = stat.count;
        summary.totalVolume += stat.totalVolume || 0;
      });

      return summary;
    } catch (error) {
      console.error('Error getting user DCA stats:', error);
      throw new Error('Failed to get DCA statistics');
    }
  }

  /**
   * Private helper methods
   */
  private static async validateDCAOrderParams(params: CreateDCAOrderParams) {
    try {
      // Validate trigger price
      if (!validateTriggerPrice(params.triggerPrice)) {
        return {
          valid: false,
          error: `Trigger price must be between $${DCA_LIMITS.MIN_TRIGGER_PRICE} and $${DCA_LIMITS.MAX_TRIGGER_PRICE}`
        };
      }

      // Get current price to validate trigger logic
      const currentPrice = await PriceAnalyticsService.getMarketData().then(data => data.current_price);
      
      // Validate that trigger makes sense relative to current price
      // For "below" trigger: order executes when price drops to or below trigger price
      // For "above" trigger: order executes when price rises to or above trigger price
      // Both conditions allow immediate execution if current price already meets the condition
      
      // No validation needed - all trigger prices are valid
      // The system will execute immediately if the condition is already met

      // Validate slippage
      const slippage = params.maxSlippage || DCA_LIMITS.DEFAULT_SLIPPAGE;
      if (!validateSlippage(slippage)) {
        return {
          valid: false,
          error: `Slippage must be between ${DCA_LIMITS.MIN_SLIPPAGE}% and ${DCA_LIMITS.MAX_SLIPPAGE}%`
        };
      }

      // Validate amount based on fromToken
      const tokenSymbol = params.fromToken;
      if (!validateTokenAmount(tokenSymbol, params.fromAmount)) {
        return {
          valid: false,
          error: `Invalid amount for ${tokenSymbol}`
        };
      }

      // Validate user has sufficient balance
      const user = await WalletService.getWalletByAddress(params.walletAddress);
      if (!user) {
        return {
          valid: false,
          error: 'User not found'
        };
      }

      const tokenMeta = TOKEN_METADATA[tokenSymbol as keyof typeof TOKEN_METADATA];
      const balanceCheck = await TokenService.validateSufficientBalance(
        tokenMeta.address,
        params.walletAddress,
        params.fromAmount
      );

      if (!balanceCheck.sufficient) {
        return {
          valid: false,
          error: `Insufficient ${tokenSymbol} balance. Required: ${balanceCheck.required}, Available: ${balanceCheck.balance}`
        };
      }

      return { valid: true };
    } catch (error) {
      console.error('Error validating DCA order params:', error);
      return {
        valid: false,
        error: 'Failed to validate order parameters'
      };
    }
  }

  private static getTokensForOrderType(orderType: 'buy' | 'sell') {
    if (orderType === 'buy') {
      return {
        fromToken: TOKEN_ADDRESSES.USDC,
        toToken: TOKEN_ADDRESSES.XFI
      };
    } else {
      return {
        fromToken: TOKEN_ADDRESSES.XFI,
        toToken: TOKEN_ADDRESSES.USDC
      };
    }
  }

  private static formatDCAOrderSummary(order: IDCAOrder): DCAOrderSummary {
    const fromTokenSymbol = order.fromToken;
    const toTokenSymbol = order.toToken;
    const fromTokenMeta = TOKEN_METADATA[fromTokenSymbol as keyof typeof TOKEN_METADATA];
    
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