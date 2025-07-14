import { Request, Response } from 'express';
import { DCAService, CreateDCAOrderParams } from '../services/dca.js';
import { PriceMonitorService } from '../services/price-monitor.js';
import { DCAExecutorService } from '../services/dca-executor.js';
import { SwapService } from '../services/swap.js';
import { WalletService } from '../services/wallet.js';
import { validateTriggerPrice, validateSlippage, DCA_LIMITS } from '../constants/tokens.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { TokenService } from '../services/tokens.js';

export class DCAController {
  /**
   * Create a new DCA order
   * POST /api/dca/orders
   */
  static async createOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { orderType, amount, triggerPrice, triggerCondition, slippage, expirationDays } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // Validate required fields
      if (!orderType || !amount || !triggerPrice || !triggerCondition) {
        res.status(400).json({ 
          error: 'Missing required fields: orderType, amount, triggerPrice, triggerCondition' 
        });
        return;
      }

      // Validate order type
      if (!['buy', 'sell'].includes(orderType)) {
        res.status(400).json({ error: 'Invalid order type. Must be "buy" or "sell"' });
        return;
      }

      // Validate trigger condition
      if (!['above', 'below'].includes(triggerCondition)) {
        res.status(400).json({ error: 'Invalid trigger condition. Must be "above" or "below"' });
        return;
      }

      // Validate trigger price
      if (!validateTriggerPrice(triggerPrice)) {
        res.status(400).json({ 
          error: `Trigger price must be between $${DCA_LIMITS.MIN_TRIGGER_PRICE} and $${DCA_LIMITS.MAX_TRIGGER_PRICE}` 
        });
        return;
      }

      // Validate slippage if provided
      if (slippage !== undefined && !validateSlippage(slippage)) {
        res.status(400).json({ 
          error: `Slippage must be between ${DCA_LIMITS.MIN_SLIPPAGE}% and ${DCA_LIMITS.MAX_SLIPPAGE}%` 
        });
        return;
      }

      // Get user wallet
      const user = await WalletService.getWalletByPrivyId(userId);
      if (!user) {
        res.status(404).json({ error: 'User wallet not found' });
        return;
      }

      // Calculate expiration date
      const expiresAt = expirationDays 
        ? new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000)
        : undefined;

      // Create DCA order parameters
      const dcaParams: CreateDCAOrderParams = {
        userId,
        walletAddress: user.walletAddress,
        orderType,
        fromAmount: amount.toString(),
        triggerPrice: parseFloat(triggerPrice),
        triggerCondition,
        maxSlippage: slippage || DCA_LIMITS.DEFAULT_SLIPPAGE,
        expiresAt,
      };

      // Create the order
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
    } catch (error: any) {
      console.error('Error creating DCA order:', error);
      res.status(500).json({ 
        error: 'Failed to create DCA order',
        message: error.message 
      });
    }
  }

  /**
   * Get user's DCA orders
   * GET /api/dca/orders
   */
  static async getUserOrders(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { status, limit } = req.query;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const orders = await DCAService.getUserDCAOrders(
        userId,
        status as string,
        limit ? parseInt(limit as string) : undefined
      );

      res.json({
        success: true,
        data: orders,
        count: orders.length,
      });
    } catch (error: any) {
      console.error('Error getting user DCA orders:', error);
      res.status(500).json({ 
        error: 'Failed to get DCA orders',
        message: error.message 
      });
    }
  }

  /**
   * Get specific DCA order by ID
   * GET /api/dca/orders/:orderId
   */
  static async getOrderById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const order = await DCAService.getDCAOrderById(orderId, userId);

      if (!order) {
        res.status(404).json({ error: 'DCA order not found' });
        return;
      }

      res.json({
        success: true,
        data: order,
      });
    } catch (error: any) {
      console.error('Error getting DCA order:', error);
      res.status(500).json({ 
        error: 'Failed to get DCA order',
        message: error.message 
      });
    }
  }

  /**
   * Update DCA order
   * PUT /api/dca/orders/:orderId
   */
  static async updateOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const userId = req.user?.id;
      const updates = req.body;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // Validate updates
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

      const updatedOrder = await DCAService.updateDCAOrder(orderId, userId, updates);

      res.json({
        success: true,
        message: 'DCA order updated successfully',
        data: updatedOrder,
      });
    } catch (error: any) {
      console.error('Error updating DCA order:', error);
      res.status(500).json({ 
        error: 'Failed to update DCA order',
        message: error.message 
      });
    }
  }

  /**
   * Cancel DCA order
   * DELETE /api/dca/orders/:orderId
   */
  static async cancelOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const cancelled = await DCAService.cancelDCAOrder(orderId, userId);

      if (!cancelled) {
        res.status(404).json({ error: 'DCA order not found or cannot be cancelled' });
        return;
      }

      res.json({
        success: true,
        message: 'DCA order cancelled successfully',
      });
    } catch (error: any) {
      console.error('Error cancelling DCA order:', error);
      res.status(500).json({ 
        error: 'Failed to cancel DCA order',
        message: error.message 
      });
    }
  }

  /**
   * Get DCA statistics for user
   * GET /api/dca/stats
   */
  static async getUserStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const stats = await DCAService.getUserDCAStats(userId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      console.error('Error getting user DCA stats:', error);
      res.status(500).json({ 
        error: 'Failed to get DCA statistics',
        message: error.message 
      });
    }
  }

  /**
   * Get user's token balances for DCA tokens
   * GET /api/dca/balances
   */
  static async getUserTokenBalances(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // Get user wallet
      const user = await WalletService.getWalletByPrivyId(userId);
      if (!user) {
        res.status(404).json({ error: 'User wallet not found' });
        return;
      }

      // Get token balances
      const balances = await TokenService.getDCATokenBalances(user.walletAddress);

      res.json({
        success: true,
        data: balances,
      });
    } catch (error: any) {
      console.error('Error getting user token balances:', error);
      res.status(500).json({ 
        error: 'Failed to get token balances',
        message: error.message 
      });
    }
  }

  /**
   * Get system status
   * GET /api/dca/system/status
   */
  static async getSystemStatus(req: Request, res: Response): Promise<void> {
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
    } catch (error: any) {
      console.error('Error getting system status:', error);
      res.status(500).json({ 
        error: 'Failed to get system status',
        message: error.message 
      });
    }
  }

  /**
   * Force execute eligible orders (admin endpoint)
   * POST /api/dca/system/execute
   */
  static async forceExecuteOrders(req: Request, res: Response): Promise<void> {
    try {
      const result = await DCAExecutorService.forceExecuteOrders();

      res.json({
        success: true,
        message: 'Force execution completed',
        data: result,
      });
    } catch (error: any) {
      console.error('Error force executing orders:', error);
      res.status(500).json({ 
        error: 'Failed to force execute orders',
        message: error.message 
      });
    }
  }

  /**
   * Simulate price check (testing endpoint)
   * POST /api/dca/system/simulate
   */
  static async simulatePriceCheck(req: Request, res: Response): Promise<void> {
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
    } catch (error: any) {
      console.error('Error simulating price check:', error);
      res.status(500).json({ 
        error: 'Failed to simulate price check',
        message: error.message 
      });
    }
  }

  /**
   * Get swap quote
   * POST /api/dca/quote
   */
  static async getSwapQuote(req: Request, res: Response): Promise<void> {
    try {
      const { fromToken, toToken, amount, slippage } = req.body;

      if (!fromToken || !toToken || !amount) {
        res.status(400).json({ error: 'fromToken, toToken, and amount are required' });
        return;
      }

      const quote = await SwapService.getSwapQuote(fromToken, toToken, amount, slippage);

      res.json({
        success: true,
        data: quote,
      });
    } catch (error: any) {
      console.error('Error getting swap quote:', error);
      res.status(500).json({ 
        error: 'Failed to get swap quote',
        message: error.message 
      });
    }
  }

  /**
   * Start DCA executor (admin endpoint)
   * POST /api/dca/system/start
   */
  static async startExecutor(req: Request, res: Response): Promise<void> {
    try {
      const config = req.body;
      const started = DCAExecutorService.startExecutor(config);

      if (started) {
        res.json({
          success: true,
          message: 'DCA Executor started successfully',
        });
      } else {
        res.status(400).json({
          error: 'Failed to start DCA Executor (may already be running)',
        });
      }
    } catch (error: any) {
      console.error('Error starting DCA executor:', error);
      res.status(500).json({ 
        error: 'Failed to start DCA executor',
        message: error.message 
      });
    }
  }

  /**
   * Stop DCA executor (admin endpoint)
   * POST /api/dca/system/stop
   */
  static async stopExecutor(req: Request, res: Response): Promise<void> {
    try {
      const stopped = DCAExecutorService.stopExecutor();

      if (stopped) {
        res.json({
          success: true,
          message: 'DCA Executor stopped successfully',
        });
      } else {
        res.status(400).json({
          error: 'Failed to stop DCA Executor (may not be running)',
        });
      }
    } catch (error: any) {
      console.error('Error stopping DCA executor:', error);
      res.status(500).json({ 
        error: 'Failed to stop DCA executor',
        message: error.message 
      });
    }
  }

  /**
   * Get executor configuration (admin endpoint)
   * GET /api/dca/system/config
   */
  static async getExecutorConfig(req: Request, res: Response): Promise<void> {
    try {
      const config = DCAExecutorService.getConfig();

      res.json({
        success: true,
        data: config,
      });
    } catch (error: any) {
      console.error('Error getting executor config:', error);
      res.status(500).json({ 
        error: 'Failed to get executor config',
        message: error.message 
      });
    }
  }

  /**
   * Update executor configuration (admin endpoint)
   * PUT /api/dca/system/config
   */
  static async updateExecutorConfig(req: Request, res: Response): Promise<void> {
    try {
      const newConfig = req.body;
      const updated = DCAExecutorService.updateConfig(newConfig);

      if (updated) {
        res.json({
          success: true,
          message: 'Executor configuration updated successfully',
          data: DCAExecutorService.getConfig(),
        });
      } else {
        res.status(400).json({
          error: 'Failed to update executor configuration',
        });
      }
    } catch (error: any) {
      console.error('Error updating executor config:', error);
      res.status(500).json({ 
        error: 'Failed to update executor config',
        message: error.message 
      });
    }
  }
} 