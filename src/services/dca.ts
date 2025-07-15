import { DCAOrder, IDCAOrder } from '../models/DCAOrder.js';
import { SwapService, SwapResult } from './swap.js';
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
  orderType: 'buy' | 'sell';
  fromAmount: string;
  triggerPrice: number;
  triggerCondition: 'above' | 'below';
  maxSlippage?: number;
  expiresAt?: Date;
}

export interface DCAOrderSummary {
  id: string;
  orderType: 'buy' | 'sell';
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

      // Determine tokens based on order type
      const { fromToken, toToken } = this.getTokensForOrderType(params.orderType);

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
          TOKEN_METADATA[params.orderType === 'buy' ? 'tUSDC' : 'XFI'].decimals
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
   */
  static shouldExecuteOrder(order: IDCAOrder, currentPrice: number): boolean {
    const { triggerPrice, triggerCondition } = order;
    
    if (triggerCondition === 'above') {
      return currentPrice >= triggerPrice;
    } else if (triggerCondition === 'below') {
      return currentPrice <= triggerPrice;
    }
    
    return false;
  }

  /**
   * Execute a DCA order
   */
  static async executeDCAOrder(order: IDCAOrder): Promise<SwapResult> {
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

      // Convert stored amount back to human-readable format
      const fromTokenMeta = TOKEN_METADATA[order.orderType === 'buy' ? 'tUSDC' : 'XFI'];
      const fromAmount = TokenService.formatTokenAmount(order.fromAmount, fromTokenMeta.decimals);

      // Execute the swap
      const swapResult = await SwapService.executeSwap(
        user,
        fromTokenMeta.symbol,
        order.orderType === 'buy' ? 'XFI' : 'tUSDC',
        fromAmount,
        order.maxSlippage
      );

      // Update order based on swap result
      if (swapResult.success) {
        order.status = 'executed';
        order.executedAt = new Date();
        order.executedPrice = currentPrice;
        order.executedAmount = swapResult.toAmount;
        order.transactionHash = swapResult.transactionHash;
        
        console.log(`DCA order ${order._id} executed successfully`);
      } else {
        order.retryCount += 1;
        order.failureReason = swapResult.error;
        
        if (order.retryCount >= order.maxRetries) {
          order.status = 'failed';
          console.log(`DCA order ${order._id} failed after ${order.retryCount} attempts`);
        } else {
          console.log(`DCA order ${order._id} failed, will retry (attempt ${order.retryCount}/${order.maxRetries})`);
        }
      }

      await order.save();
      return swapResult;
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

      // Validate slippage
      const slippage = params.maxSlippage || DCA_LIMITS.DEFAULT_SLIPPAGE;
      if (!validateSlippage(slippage)) {
        return {
          valid: false,
          error: `Slippage must be between ${DCA_LIMITS.MIN_SLIPPAGE}% and ${DCA_LIMITS.MAX_SLIPPAGE}%`
        };
      }

      // Validate amount based on order type
      const tokenSymbol = params.orderType === 'buy' ? 'tUSDC' : 'XFI';
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
        fromToken: TOKEN_ADDRESSES.tUSDC,
        toToken: TOKEN_ADDRESSES.XFI
      };
    } else {
      return {
        fromToken: TOKEN_ADDRESSES.XFI,
        toToken: TOKEN_ADDRESSES.tUSDC
      };
    }
  }

  private static formatDCAOrderSummary(order: IDCAOrder): DCAOrderSummary {
    const fromTokenSymbol = order.orderType === 'buy' ? 'tUSDC' : 'XFI';
    const toTokenSymbol = order.orderType === 'buy' ? 'XFI' : 'tUSDC';
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